import { NextResponse } from "next/server";
import { getMeta } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    const meta = getMeta();
    const etag = String(meta.version);
    const ifNoneMatch = req.headers.get("if-none-match");
    if (ifNoneMatch === etag) {
        return new Response(null, { status: 304 });
    }
    const urls = meta.photos.map(f => `/api/photo/${f}`);
    return NextResponse.json(urls, {
        headers: { ETag: etag, "Cache-Control": "no-cache" },
    });
}
