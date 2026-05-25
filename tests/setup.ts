import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, afterAll, beforeAll, vi } from "vitest";
import { server } from "./msw/server";

/* ── MSW lifecycle ──────────────────────────────────────────────────────────── */
beforeAll(() => {
    server.listen({ onUnhandledRequest: "error" });
    // Root-relative URLs (e.g. "/api/images") can't be parsed by undici/MSW in node.
    // Wrap the (already MSW-patched) fetch so component code using relative paths works.
    const intercepted = globalThis.fetch;
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
        if (typeof input === "string" && input.startsWith("/")) {
            input = "http://localhost" + input;
        }
        return intercepted(input as RequestInfo | URL, init);
    }) as typeof fetch;
});
afterEach(() => {
    cleanup();
    server.resetHandlers();
});
afterAll(() => server.close());

/* ── jsdom shims (only meaningful in the jsdom environment) ─────────────────── */
if (typeof window !== "undefined") {
    if (!window.matchMedia) {
        window.matchMedia = vi.fn().mockImplementation((query: string) => ({
            matches: false,
            media: query,
            onchange: null,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            addListener: vi.fn(),
            removeListener: vi.fn(),
            dispatchEvent: vi.fn(),
        }));
    }
    window.scrollTo = vi.fn();
    window.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
    } as unknown as typeof ResizeObserver;
}

/* ── Deterministic BroadcastChannel stub (no real cross-tab messaging) ──────── */
class StubBroadcastChannel {
    name: string;
    onmessage: ((e: MessageEvent) => void) | null = null;
    static channels: StubBroadcastChannel[] = [];
    constructor(name: string) {
        this.name = name;
        StubBroadcastChannel.channels.push(this);
    }
    postMessage(data: unknown) {
        for (const ch of StubBroadcastChannel.channels) {
            if (ch !== this && ch.name === this.name && ch.onmessage) {
                ch.onmessage({ data } as MessageEvent);
            }
        }
    }
    close() {
        StubBroadcastChannel.channels = StubBroadcastChannel.channels.filter((c) => c !== this);
    }
}
vi.stubGlobal("BroadcastChannel", StubBroadcastChannel);

/* ── EventSource stub (jsdom has none) — inert in unit tests ────────────────── */
class StubEventSource {
    url: string;
    onmessage: ((e: MessageEvent) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;
    constructor(url: string) {
        this.url = url;
    }
    close() {}
    addEventListener() {}
    removeEventListener() {}
}
vi.stubGlobal("EventSource", StubEventSource);
