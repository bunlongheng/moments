import { NextResponse } from "next/server";
import os from "os";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";

/** First non-internal IPv4 address (the LAN address phones can reach). */
function lanIp(): string {
    const ifaces = os.networkInterfaces();
    for (const name of Object.keys(ifaces)) {
        for (const ni of ifaces[name] || []) {
            if (ni.family === "IPv4" && !ni.internal) return ni.address;
        }
    }
    return "localhost";
}

export async function GET(req: Request) {
    // Port comes from the Host header (works even when the kiosk uses localhost).
    const host = req.headers.get("host") || "";
    const port = host.includes(":") ? host.split(":")[1] : "";
    const base = port ? `${lanIp()}:${port}` : lanIp();
    const url = `http://${base}/upload`;
    const qr = await QRCode.toDataURL(url, { margin: 1, width: 240 });
    return NextResponse.json({ url, qr });
}
