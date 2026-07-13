// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import os from "os";
import dgram from "dgram";

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

/** By default, pretend the default-route socket trick fails so tests hit the
 *  interface-walk fallback. Individual tests can override via `mockRouted`. */
function mockNoRoute() {
    vi.spyOn(dgram, "createSocket").mockImplementation(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fakeSock: any = {
            once: () => fakeSock,
            connect: (_p: number, _h: string, cb: () => void) => {
                // Pretend the socket has no bound address yet.
                fakeSock.address = () => ({ address: "0.0.0.0", port: 0, family: "IPv4" });
                cb();
            },
            address: () => ({ address: "0.0.0.0", port: 0, family: "IPv4" }),
            close: () => {},
        };
        return fakeSock;
    });
}

function mockRouted(ip: string) {
    vi.spyOn(dgram, "createSocket").mockImplementation(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fakeSock: any = {
            once: () => fakeSock,
            connect: (_p: number, _h: string, cb: () => void) => {
                fakeSock.address = () => ({ address: ip, port: 0, family: "IPv4" });
                cb();
            },
            address: () => ({ address: ip, port: 0, family: "IPv4" }),
            close: () => {},
        };
        return fakeSock;
    });
}

beforeEach(async () => {
    delete process.env.MOMENTS_LAN_IP;
    mockNoRoute();
    await load();
});
afterEach(() => {
    delete process.env.MOMENTS_LAN_IP;
    vi.restoreAllMocks();
});

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
        mockIp({ eth0: [{ family: "IPv4", address: "192.0.2.10", internal: false }] });
        await load();
        const { url } = await (await GET(req("localhost:8888"))).json();
        expect(url).toBe("http://192.0.2.10:8888/upload");
    });

    it("falls back to localhost when no external interface exists", async () => {
        mockIp({ lo: [{ family: "IPv4", address: "127.0.0.1", internal: true }] });
        await load();
        const { url } = await (await GET(req("localhost:3000"))).json();
        expect(url).toBe("http://localhost:3000/upload");
    });

    it("omits the port when the Host header has none", async () => {
        mockIp({ eth0: [{ family: "IPv4", address: "192.0.2.5", internal: false }] });
        await load();
        const { url } = await (await GET(req("192.0.2.5"))).json();
        expect(url).toBe("http://192.0.2.5/upload");
    });

    it("returns a PNG data-URL QR code", async () => {
        const { qr } = await (await GET(req("localhost:8888"))).json();
        expect(qr).toMatch(/^data:image\/png;base64,/);
    });

    it("MOMENTS_LAN_IP env override wins over auto-detection", async () => {
        process.env.MOMENTS_LAN_IP = "10.0.0.42";
        mockIp({ eth0: [{ family: "IPv4", address: "192.0.2.99", internal: false }] });
        mockRouted("172.20.0.1");
        await load();
        const { url } = await (await GET(req("localhost:8899"))).json();
        expect(url).toBe("http://10.0.0.42:8899/upload");
    });

    it("prefers the default-route IP over a stale interface", async () => {
        // Simulates the Pi5 case: eth0 has a stale IP nobody can reach, but
        // the default route actually exits via wlan0.
        mockIp({
            eth0: [{ family: "IPv4", address: "10.0.0.27", internal: false }],
            wlan0: [{ family: "IPv4", address: "10.0.0.50", internal: false }],
        });
        mockRouted("10.0.0.50");
        await load();
        const { url } = await (await GET(req("localhost:8899"))).json();
        expect(url).toBe("http://10.0.0.50:8899/upload");
    });

    it("skips Tailscale CGNAT and virtual interfaces in the fallback", async () => {
        mockIp({
            "tailscale0": [{ family: "IPv4", address: "100.99.41.27", internal: false }],
            "docker0": [{ family: "IPv4", address: "172.17.0.1", internal: false }],
            "wlan0": [{ family: "IPv4", address: "192.168.1.50", internal: false }],
        });
        await load();
        const { url } = await (await GET(req("localhost:8899"))).json();
        expect(url).toBe("http://192.168.1.50:8899/upload");
    });
});
