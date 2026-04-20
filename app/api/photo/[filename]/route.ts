import { NextResponse } from "next/server";
import { photoPath } from "@/lib/storage";
import fs from "fs";

export async function GET(_req: Request, { params }: { params: Promise<{ filename: string }> }) {
    const { filename } = await params;
    const fp = photoPath(filename);
    if (!fs.existsSync(fp) || filename.includes("..")) {
        return new Response("Not found", { status: 404 });
    }
    const data = fs.readFileSync(fp);
    return new Response(data, {
        headers: {
            "Content-Type": "image/jpeg",
            "Cache-Control": "public, max-age=86400, immutable",
            "Content-Length": String(data.length),
        },
    });
}
