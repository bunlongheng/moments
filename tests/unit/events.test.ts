// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

let events: typeof import("@/lib/events");

beforeEach(async () => {
    vi.resetModules();
    events = await import("@/lib/events");
});

describe("events pub/sub", () => {
    it("starts with no listeners", () => {
        expect(events.listenerCount()).toBe(0);
    });

    it("notifies a subscriber on publish", () => {
        let n = 0;
        events.subscribe(() => n++);
        events.publish();
        expect(n).toBe(1);
    });

    it("notifies every subscriber", () => {
        let a = 0, b = 0;
        events.subscribe(() => a++);
        events.subscribe(() => b++);
        events.publish();
        expect(a).toBe(1);
        expect(b).toBe(1);
    });

    it("stops notifying after unsubscribe", () => {
        let n = 0;
        const l = () => n++;
        events.subscribe(l);
        events.unsubscribe(l);
        events.publish();
        expect(n).toBe(0);
    });

    it("tracks the listener count", () => {
        const l1 = () => {};
        const l2 = () => {};
        events.subscribe(l1);
        events.subscribe(l2);
        expect(events.listenerCount()).toBe(2);
        events.unsubscribe(l1);
        expect(events.listenerCount()).toBe(1);
    });

    it("isolates a throwing listener from the others", () => {
        let b = 0;
        events.subscribe(() => { throw new Error("boom"); });
        events.subscribe(() => b++);
        expect(() => events.publish()).not.toThrow();
        expect(b).toBe(1);
    });

    it("publishing with no listeners does not throw", () => {
        expect(() => events.publish()).not.toThrow();
    });
});
