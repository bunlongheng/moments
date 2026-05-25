// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import os from "os";

type Route = typeof import("@/app/api/lan/route");
let GET: Route["GET"];

async function load() {
    vi.resetModules();
    ({ GET } = await import("@/app/api/lan/route"));
}

function req(host: string) {
    return new Request("http://localhost/api/lan", { headers: { host } });
}

function mockIp(ifaces: Record<string, unknown>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(os, "networkInterfaces").mockReturnValue(ifaces as any);
}

beforeEach(load);
afterEach(() => vi.restoreAllMocks());

describe("GET /api/lan", () => {
    it("returns a URL that points at /upload", async () => {
        const { url } = await (await GET(req("localhost:8888"))).json();
        expect(url).toMatch(/\/upload$/);
    });

    it("uses the port from the Host header", async () => {
        const { url } = await (await GET(req("localhost:8888"))).json();
        expect(url).toContain(":8888/upload");
    });

    it("uses the LAN IPv4 address rather than localhost", async () => {
        mockIp({ eth0: [{ family: "IPv4", address: "10.0.0.27", internal: false }] });
        await load();
        const { url } = await (await GET(req("localhost:8888"))).json();
        expect(url).toBe("http://10.0.0.27:8888/upload");
    });

    it("falls back to localhost when no external interface exists", async () => {
        mockIp({ lo: [{ family: "IPv4", address: "127.0.0.1", internal: true }] });
        await load();
        const { url } = await (await GET(req("localhost:3000"))).json();
        expect(url).toBe("http://localhost:3000/upload");
    });

    it("omits the port when the Host header has none", async () => {
        mockIp({ eth0: [{ family: "IPv4", address: "10.0.0.5", internal: false }] });
        await load();
        const { url } = await (await GET(req("10.0.0.5"))).json();
        expect(url).toBe("http://10.0.0.5/upload");
    });

    it("returns a PNG data-URL QR code", async () => {
        const { qr } = await (await GET(req("localhost:8888"))).json();
        expect(qr).toMatch(/^data:image\/png;base64,/);
    });
});
