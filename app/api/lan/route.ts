import { NextResponse } from "next/server";
import os from "os";
import dgram from "dgram";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";

const SKIP_IFACE_PREFIXES = ["docker", "br-", "veth", "tailscale", "utun", "awdl", "llw"];

function isReachableV4(addr: string): boolean {
    if (!addr || addr === "0.0.0.0" || addr === "255.255.255.255") return false;
    if (addr.startsWith("169.254.")) return false; // link-local
    const [a, b] = addr.split(".").map(Number);
    if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT / Tailscale
    return true;
}

/** Walk all interfaces, skipping virtual ones and unreachable address ranges. */
function ipFromInterfaces(): string {
    const ifaces = os.networkInterfaces();
    for (const name of Object.keys(ifaces)) {
        if (SKIP_IFACE_PREFIXES.some(p => name.startsWith(p))) continue;
        for (const ni of ifaces[name] || []) {
            if (ni.family === "IPv4" && !ni.internal && isReachableV4(ni.address)) {
                return ni.address;
            }
        }
    }
    return "localhost";
}

/** Ask the kernel which local IP it would use for the default route. */
function ipFromDefaultRoute(): Promise<string | null> {
    return new Promise(resolve => {
        const sock = dgram.createSocket("udp4");
        let settled = false;
        const done = (ip: string | null) => {
            if (settled) return;
            settled = true;
            try { sock.close(); } catch {}
            resolve(ip);
        };
        sock.once("error", () => done(null));
        try {
            // "connect" a UDP socket toward a public address; no packets are
            // sent, but the kernel picks the local address for the default route.
            sock.connect(80, "1.1.1.1", () => {
                const addr = sock.address();
                done(addr && isReachableV4(addr.address) ? addr.address : null);
            });
        } catch {
            done(null);
        }
    });
}

async function lanIp(): Promise<string> {
    if (process.env.MOMENTS_LAN_IP) return process.env.MOMENTS_LAN_IP;
    const routed = await ipFromDefaultRoute();
    if (routed) return routed;
    return ipFromInterfaces();
}

export async function GET(req: Request) {
    const host = req.headers.get("host") || "";
    const port = host.includes(":") ? host.split(":")[1] : "";
    const ip = await lanIp();
    const base = port ? `${ip}:${port}` : ip;
    const url = `http://${base}/upload`;
    const qr = await QRCode.toDataURL(url, { margin: 1, width: 240 });
    return NextResponse.json({ url, qr });
}
