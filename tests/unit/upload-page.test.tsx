// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent, act, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { db } from "../msw/handlers";
import UploadPage from "@/app/upload/page";

beforeEach(() => {
    db.reset();
});

afterEach(async () => {
    // Drain fire-and-forget reloads/toasts so no fetch is in flight when MSW tears down.
    await act(async () => {
        await new Promise((r) => setTimeout(r, 60));
    });
    vi.restoreAllMocks();
});

function pngFile(name = "a.png") {
    return new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], name, { type: "image/png" });
}
function txtFile(name = "a.txt") {
    return new File(["hello"], name, { type: "text/plain" });
}
function fileInput(container: HTMLElement) {
    return container.querySelector('input[type="file"]') as HTMLInputElement;
}
function dispatchDoc(type: string, files?: File[]) {
    const e = new Event(type, { bubbles: true });
    if (files) Object.defineProperty(e, "dataTransfer", { value: { files } });
    act(() => {
        document.dispatchEvent(e);
    });
}

describe("UploadPage header & layout", () => {
    it("renders the Moments header", async () => {
        render(<UploadPage />);
        expect(await screen.findByText("Moments")).toBeInTheDocument();
    });

    it("shows a zero photo count initially", async () => {
        render(<UploadPage />);
        expect(await screen.findByText("0 photos")).toBeInTheDocument();
    });

    it("shows the Add Photos button", async () => {
        render(<UploadPage />);
        expect(await screen.findByText("+ Add Photos")).toBeInTheDocument();
    });

    it("always renders the live preview iframe pointed at the display", async () => {
        const { container } = render(<UploadPage />);
        await screen.findByText("+ Add Photos");
        const iframe = container.querySelector("iframe");
        expect(iframe).not.toBeNull();
        expect(iframe!.getAttribute("src")).toBe("/");
    });

    it("has no upload/preview tab buttons", async () => {
        render(<UploadPage />);
        await screen.findByText("+ Add Photos");
        expect(screen.queryByRole("button", { name: "preview" })).toBeNull();
        expect(screen.queryByRole("button", { name: "upload" })).toBeNull();
    });

    it("shows the preview and the controls together on one page", async () => {
        const { container } = render(<UploadPage />);
        await screen.findByText("+ Add Photos");
        expect(container.querySelector("iframe")).not.toBeNull();
        expect(screen.getByText("+ Add Photos")).toBeInTheDocument();
    });
});

describe("UploadPage style picker", () => {
    it("renders all five slideshow styles", async () => {
        render(<UploadPage />);
        for (const label of ["Ken Burns", "Fade", "Slide", "Zoom", "Static"]) {
            expect(await screen.findByRole("button", { name: label })).toBeInTheDocument();
        }
    });

    it("renders an icon inside each style button", async () => {
        render(<UploadPage />);
        for (const label of ["Ken Burns", "Fade", "Slide", "Zoom", "Static"]) {
            const btn = await screen.findByRole("button", { name: label });
            expect(btn.querySelector("svg")).not.toBeNull();
        }
    });

    it("posts the chosen style and shows a confirmation toast", async () => {
        const user = userEvent.setup();
        render(<UploadPage />);
        await user.click(await screen.findByRole("button", { name: "Slide" }));
        expect(await screen.findByText("Style: Slide")).toBeInTheDocument();
        await waitFor(() => expect(db.style).toBe("slide"));
    });

    it("highlights the selected style button", async () => {
        const user = userEvent.setup();
        render(<UploadPage />);
        const fade = await screen.findByRole("button", { name: "Fade" });
        await user.click(fade);
        await waitFor(() => expect(fade.style.fontWeight).toBe("600"));
        expect(screen.getByRole("button", { name: "Zoom" }).style.fontWeight).toBe("400");
    });

    it("marks the chosen mode with the selection-feedback class", async () => {
        const user = userEvent.setup();
        render(<UploadPage />);
        const slide = await screen.findByRole("button", { name: "Slide" });
        await user.click(slide);
        await waitFor(() => expect(slide.className).toContain("seg-active"));
        expect(screen.getByRole("button", { name: "Zoom" }).className).not.toContain("seg-active");
    });
});

describe("UploadPage add photos", () => {
    it("clicking Add Photos opens the hidden file input", async () => {
        const user = userEvent.setup();
        const { container } = render(<UploadPage />);
        await screen.findByText("+ Add Photos");
        const clickSpy = vi.spyOn(fileInput(container), "click").mockImplementation(() => {});
        await user.click(screen.getByText("+ Add Photos"));
        expect(clickSpy).toHaveBeenCalled();
    });

    it("uploads a selected image and updates the count", async () => {
        const user = userEvent.setup();
        const { container } = render(<UploadPage />);
        await screen.findByText("0 photos");
        await user.upload(fileInput(container), pngFile());
        expect(await screen.findByText("1 photos")).toBeInTheDocument();
    });

    it("uploads multiple images at once", async () => {
        const user = userEvent.setup();
        const { container } = render(<UploadPage />);
        await screen.findByText("0 photos");
        await user.upload(fileInput(container), [pngFile("a.png"), pngFile("b.png")]);
        expect(await screen.findByText("2 photos")).toBeInTheDocument();
    });

    it("shows a drag-and-drop hint under the add button", async () => {
        render(<UploadPage />);
        expect(await screen.findByText(/drag & drop photos anywhere/i)).toBeInTheDocument();
    });

    it("shows a completion toast after uploading", async () => {
        const user = userEvent.setup();
        const { container } = render(<UploadPage />);
        await screen.findByText("0 photos");
        await user.upload(fileInput(container), pngFile());
        expect(await screen.findByText(/Done! 1 added/)).toBeInTheDocument();
    });

    it("renders uploaded photos in the grid", async () => {
        const user = userEvent.setup();
        const { container } = render(<UploadPage />);
        await screen.findByText("0 photos");
        await user.upload(fileInput(container), pngFile());
        await waitFor(() => expect(container.querySelectorAll('img[alt=""]').length).toBe(1));
    });

    it("gives grid photos an entrance-animation class", async () => {
        db.photos = ["/api/photo/a.jpg"];
        const { container } = render(<UploadPage />);
        await screen.findByText("1 photos");
        const cell = container.querySelector('img[alt=""]')!.parentElement as HTMLElement;
        expect(cell.className).toContain("photo-in");
    });
});

describe("UploadPage empty state", () => {
    it("shows the empty prompt when there are no photos", async () => {
        render(<UploadPage />);
        expect(await screen.findByText("Drop photos or tap + Add Photos")).toBeInTheDocument();
    });

    it("hides the empty prompt once photos exist", async () => {
        db.photos = ["/api/photo/a.jpg"];
        render(<UploadPage />);
        await screen.findByText("1 photos");
        expect(screen.queryByText("Drop photos or tap + Add Photos")).toBeNull();
    });
});

describe("UploadPage drag & drop", () => {
    it("shows the drop overlay on dragenter", async () => {
        render(<UploadPage />);
        await screen.findByText("0 photos");
        dispatchDoc("dragenter");
        expect(await screen.findByText("Drop photos here")).toBeInTheDocument();
    });

    it("hides the drop overlay on dragleave", async () => {
        render(<UploadPage />);
        await screen.findByText("0 photos");
        dispatchDoc("dragenter");
        await screen.findByText("Drop photos here");
        dispatchDoc("dragleave");
        await waitFor(() => expect(screen.queryByText("Drop photos here")).toBeNull());
    });

    it("uploads files dropped onto the page", async () => {
        render(<UploadPage />);
        await screen.findByText("0 photos");
        dispatchDoc("drop", [pngFile()]);
        expect(await screen.findByText("1 photos")).toBeInTheDocument();
    });

    it("ignores non-image files when dropping a mixed set", async () => {
        render(<UploadPage />);
        await screen.findByText("0 photos");
        dispatchDoc("drop", [pngFile("ok.png"), txtFile("skip.txt")]);
        expect(await screen.findByText("1 photos")).toBeInTheDocument();
    });
});

describe("UploadPage delete flow", () => {
    it("clicking a photo reveals the delete button", async () => {
        const user = userEvent.setup();
        db.photos = ["/api/photo/a.jpg"];
        const { container } = render(<UploadPage />);
        await screen.findByText("1 photos");
        const cell = container.querySelector('img[alt=""]')!.parentElement as HTMLElement;
        await user.click(cell);
        expect(await within(cell).findByText("×")).toBeInTheDocument();
    });

    it("tapping a photo pins it and shows a Playing toast", async () => {
        const user = userEvent.setup();
        db.photos = ["/api/photo/a.jpg"];
        render(<UploadPage />);
        await screen.findByText("1 photos");
        const cell = document.querySelector('img[alt=""]')!.parentElement as HTMLElement;
        await user.click(cell);
        expect(await screen.findByText("Playing this photo")).toBeInTheDocument();
    });

    it("long-press marks the held photo cell with a feedback ring", async () => {
        db.photos = ["/api/photo/a.jpg"];
        const { container } = render(<UploadPage />);
        await screen.findByText("1 photos");
        const cell = container.querySelector('img[alt=""]')!.parentElement as HTMLElement;
        expect(cell.className).not.toContain("held");
        fireEvent.touchStart(cell);
        await waitFor(() => expect(cell.className).toContain("held"));
    });

    it("clicking the delete button removes the photo", async () => {
        db.photos = ["/api/photo/a.jpg"];
        const { container } = render(<UploadPage />);
        await screen.findByText("1 photos");
        const cell = container.querySelector('img[alt=""]')!.parentElement as HTMLElement;
        fireEvent.mouseEnter(cell); // reveal the hover controls
        fireEvent.click(await within(cell).findByText("×"));
        expect(await screen.findByText("0 photos")).toBeInTheDocument();
    });

    it("tapping a pinned photo again resumes auto-play", async () => {
        const user = userEvent.setup();
        db.photos = ["/api/photo/a.jpg"];
        render(<UploadPage />);
        await screen.findByText("1 photos");
        const cell = document.querySelector('img[alt=""]')!.parentElement as HTMLElement;
        await user.click(cell);
        expect(await screen.findByText("Playing this photo")).toBeInTheDocument();
        await user.click(cell);
        expect(await screen.findByText("Resumed auto-play")).toBeInTheDocument();
    });

    it("clicking a different photo moves the delete button to it", async () => {
        const user = userEvent.setup();
        db.photos = ["/api/photo/a.jpg", "/api/photo/b.jpg"];
        const { container } = render(<UploadPage />);
        await screen.findByText("2 photos");
        const cells = Array.from(container.querySelectorAll('img[alt=""]')).map((i) => i.parentElement as HTMLElement);
        await user.click(cells[0]);
        await within(cells[0]).findByText("×");
        await user.click(cells[1]);
        await within(cells[1]).findByText("×");
        expect(within(cells[0]).queryByText("×")).toBeNull();
    });

    it("long-press reveals a delete button that removes the photo", async () => {
        const user = userEvent.setup();
        db.photos = ["/api/photo/a.jpg", "/api/photo/b.jpg"];
        const { container } = render(<UploadPage />);
        await screen.findByText("2 photos");

        const firstCell = container.querySelectorAll('img[alt=""]')[0].parentElement as HTMLElement;
        fireEvent.touchStart(firstCell);
        const del = await within(firstCell).findByText("×");

        await user.click(del);
        expect(await screen.findByText("1 photos")).toBeInTheDocument();
    });

    it("tapping a different photo moves the playing ring", async () => {
        const user = userEvent.setup();
        db.photos = ["/api/photo/a.jpg", "/api/photo/b.jpg"];
        const { container } = render(<UploadPage />);
        await screen.findByText("2 photos");

        const cells = Array.from(container.querySelectorAll('img[alt=""]')).map((i) => i.parentElement as HTMLElement);
        await user.click(cells[0]);
        await waitFor(() => expect(cells[0].className).toContain("playing"));
        await user.click(cells[1]);
        await waitFor(() => expect(cells[1].className).toContain("playing"));
        expect(cells[0].className).not.toContain("playing");
    });

    it("cancels the pending long-press on touch end", async () => {
        db.photos = ["/api/photo/a.jpg"];
        const { container } = render(<UploadPage />);
        await screen.findByText("1 photos");
        const cell = container.querySelector('img[alt=""]')!.parentElement as HTMLElement;
        fireEvent.touchStart(cell);
        fireEvent.touchEnd(cell);
        // The 500ms hold timer was cleared, so no delete button should appear.
        await new Promise((r) => setTimeout(r, 600));
        expect(within(cell).queryByText("×")).toBeNull();
    });
});

describe("UploadPage rotate", () => {
    it("clicking a photo reveals a rotate button", async () => {
        const user = userEvent.setup();
        db.photos = ["/api/photo/a.jpg"];
        const { container } = render(<UploadPage />);
        await screen.findByText("1 photos");
        const cell = container.querySelector('img[alt=""]')!.parentElement as HTMLElement;
        await user.click(cell);
        expect(await within(cell).findByRole("button", { name: "Rotate" })).toBeInTheDocument();
    });

    it("clicking rotate replaces the photo via the rotate API", async () => {
        db.photos = ["/api/photo/a.jpg"];
        const { container } = render(<UploadPage />);
        await screen.findByText("1 photos");
        const before = container.querySelector('img[alt=""]')!.getAttribute("src");
        const cell = container.querySelector('img[alt=""]')!.parentElement as HTMLElement;
        fireEvent.mouseEnter(cell); // reveal the hover controls
        fireEvent.click(await within(cell).findByRole("button", { name: "Rotate" }));
        await waitFor(() => expect(container.querySelector('img[alt=""]')!.getAttribute("src")).not.toBe(before));
    });

    it("shows a rotated confirmation toast", async () => {
        db.photos = ["/api/photo/a.jpg"];
        const { container } = render(<UploadPage />);
        await screen.findByText("1 photos");
        const cell = container.querySelector('img[alt=""]')!.parentElement as HTMLElement;
        fireEvent.mouseEnter(cell); // reveal the hover controls
        fireEvent.click(await within(cell).findByRole("button", { name: "Rotate" }));
        expect(await screen.findByText("Rotated")).toBeInTheDocument();
    });
});
