// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../msw/server";
import { db } from "../msw/handlers";
import DisplayPage from "@/app/page";

beforeEach(() => {
    db.reset();
    // Keep the clock/poll/slideshow intervals from firing in the background.
    vi.spyOn(globalThis, "setInterval").mockReturnValue(0 as unknown as ReturnType<typeof setInterval>);
    vi.spyOn(globalThis, "clearInterval").mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
});

/** Render and wait for the initial /api/images + /api/style fetches to settle. */
async function renderDisplay() {
    const utils = render(<DisplayPage />);
    await act(async () => {
        await Promise.resolve();
    });
    return utils;
}

describe("DisplayPage empty state", () => {
    it("shows the Moments title when there are no photos", async () => {
        await renderDisplay();
        expect(await screen.findByText("Moments")).toBeInTheDocument();
    });

    it("prompts the user to open /upload", async () => {
        await renderDisplay();
        expect(await screen.findByText("/upload")).toBeInTheDocument();
    });

    it("renders no slide image when empty", async () => {
        const { container } = await renderDisplay();
        await screen.findByText("Moments");
        expect(container.querySelector("img.slide")).toBeNull();
    });
});

describe("DisplayPage with photos", () => {
    it("renders a slide image for the current photo", async () => {
        db.photos = ["/api/photo/a.jpg"];
        const { container } = await renderDisplay();
        await waitFor(() => expect(container.querySelector("img.slide")).not.toBeNull());
        expect(container.querySelector("img.slide")!.getAttribute("src")).toBe("/api/photo/a.jpg");
    });

    it("does not show the empty-state prompt when photos exist", async () => {
        db.photos = ["/api/photo/a.jpg"];
        const { container } = await renderDisplay();
        await waitFor(() => expect(container.querySelector("img.slide")).not.toBeNull());
        expect(screen.queryByText("/upload")).toBeNull();
    });

    it("renders the clock with a HH:MM time", async () => {
        db.photos = ["/api/photo/a.jpg"];
        await renderDisplay();
        expect(await screen.findByText(/\d{1,2}:\d{2}/)).toBeInTheDocument();
    });

    it("uses an empty alt for the decorative slide", async () => {
        db.photos = ["/api/photo/a.jpg"];
        const { container } = await renderDisplay();
        await waitFor(() => expect(container.querySelector("img.slide")).not.toBeNull());
        expect(container.querySelector("img.slide")!.getAttribute("alt")).toBe("");
    });
});

describe("DisplayPage transition styles", () => {
    const cases: Array<[string, string]> = [
        ["ken-burns", "kb-"],
        ["fade", "active"],
        ["slide", "slide-in"],
        ["zoom", "zoom-in"],
        ["none", "no-anim"],
    ];

    it.each(cases)("applies the %s transition class", async (style, token) => {
        db.photos = ["/api/photo/a.jpg"];
        db.style = style;
        const { container } = await renderDisplay();
        await waitFor(() => {
            const img = container.querySelector("img.slide");
            expect(img?.className).toContain(token);
        });
    });
});

describe("DisplayPage live updates", () => {
    it("refetches photos on a photos-changed broadcast", async () => {
        const { container } = await renderDisplay();
        await screen.findByText("Moments");
        db.photos = ["/api/photo/new.jpg"];
        await act(async () => {
            const ch = new BroadcastChannel("moments");
            ch.postMessage({ type: "photos-changed" });
            await Promise.resolve();
        });
        await waitFor(() => expect(container.querySelector("img.slide")).not.toBeNull());
    });

    it("updates the transition style on a style-changed broadcast", async () => {
        db.photos = ["/api/photo/a.jpg"];
        db.style = "fade";
        const { container } = await renderDisplay();
        await waitFor(() => expect(container.querySelector("img.slide")).not.toBeNull());
        await act(async () => {
            const ch = new BroadcastChannel("moments");
            ch.postMessage({ type: "style-changed", style: "slide" });
            await Promise.resolve();
        });
        await waitFor(() => expect(container.querySelector("img.slide")!.className).toContain("slide-in"));
    });
});

describe("DisplayPage slideshow advance", () => {
    it("advances to the next slide on the 10s interval", async () => {
        vi.restoreAllMocks(); // drop the setInterval stub; use fake timers instead
        vi.useFakeTimers();
        vi.setSystemTime(0); // deterministic wall-clock → slide 0 at t=0
        db.photos = ["/api/photo/a.jpg", "/api/photo/b.jpg"];
        let container!: HTMLElement;
        await act(async () => {
            ({ container } = render(<DisplayPage />));
        });
        // Flush the initial fetch so urls are populated and the advance effect arms.
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });
        // Trigger the slideshow interval.
        await act(async () => {
            await vi.advanceTimersByTimeAsync(10000);
        });
        const imgs = Array.from(container.querySelectorAll("img.slide"));
        const current = imgs.find((i) => i.className.includes("active"));
        const leaving = imgs.find((i) => i.className.includes("leaving"));
        expect(current?.getAttribute("src")).toBe("/api/photo/b.jpg");
        expect(leaving?.getAttribute("src")).toBe("/api/photo/a.jpg");
        vi.useRealTimers();
    });

    it("derives the current slide from wall-clock time so all screens match", async () => {
        vi.restoreAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(20000); // floor(20000/10000) % 3 = 2 -> third photo
        db.photos = ["/api/photo/a.jpg", "/api/photo/b.jpg", "/api/photo/c.jpg"];
        let container!: HTMLElement;
        await act(async () => { ({ container } = render(<DisplayPage />)); });
        await act(async () => { await vi.advanceTimersByTimeAsync(0); });
        await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
        const active = Array.from(container.querySelectorAll("img.slide")).find((i) =>
            i.className.includes("active")
        );
        expect(active?.getAttribute("src")).toBe("/api/photo/c.jpg");
        vi.useRealTimers();
    });
});

describe("DisplayPage QR", () => {
    it("shows a scan-to-add QR on the empty state", async () => {
        await renderDisplay();
        expect(await screen.findByAltText("Scan to add photos")).toBeInTheDocument();
    });

    it("shows the scan-to-add QR badge during the slideshow", async () => {
        db.photos = ["/api/photo/a.jpg"];
        await renderDisplay();
        expect(await screen.findByAltText("Scan to add photos")).toBeInTheDocument();
    });
});

describe("DisplayPage error handling", () => {
    it("stays on the empty state when the images request fails", async () => {
        db.failImages = true;
        await renderDisplay();
        expect(await screen.findByText("Moments")).toBeInTheDocument();
    });

    it("does not crash when the network rejects", async () => {
        server.use(http.get("http://localhost/api/images", () => HttpResponse.error()));
        await renderDisplay();
        expect(await screen.findByText("Moments")).toBeInTheDocument();
    });
});
