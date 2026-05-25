// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

let GET: () => Promise<Response>;
let events: typeof import("@/lib/events");

beforeEach(async () => {
    vi.resetModules();
    events = await import("@/lib/events");
    ({ GET } = await import("@/app/api/events/route"));
});

describe("GET /api/events", () => {
    it("responds with an event-stream content type", async () => {
        const res = await GET();
        expect(res.headers.get("Content-Type")).toBe("text/event-stream");
        expect(res.headers.get("Cache-Control")).toContain("no-cache");
        await res.body!.cancel();
    });

    it("registers a listener while connected", async () => {
        const before = events.listenerCount();
        const res = await GET();
        const reader = res.body!.getReader();
        await reader.read(); // ensure start() has run
        expect(events.listenerCount()).toBe(before + 1);
        await reader.cancel();
    });

    it("sends an initial connected comment", async () => {
        const res = await GET();
        const reader = res.body!.getReader();
        const { value } = await reader.read();
        expect(new TextDecoder().decode(value)).toContain(": connected");
        await reader.cancel();
    });

    it("pushes 'data: changed' when publish() fires", async () => {
        const res = await GET();
        const reader = res.body!.getReader();
        await reader.read(); // connected
        events.publish();
        const { value } = await reader.read();
        expect(new TextDecoder().decode(value)).toContain("data: changed");
        await reader.cancel();
    });

    it("unsubscribes when the stream is cancelled", async () => {
        const before = events.listenerCount();
        const res = await GET();
        const reader = res.body!.getReader();
        await reader.read();
        await reader.cancel();
        expect(events.listenerCount()).toBe(before);
    });
});
