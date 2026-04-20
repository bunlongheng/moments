import { NextResponse } from "next/server";
import { getMeta, saveMeta, photoPath } from "@/lib/storage";
import fs from "fs";

export async function POST(req: Request) {
    const { index } = await req.json();
    const meta = getMeta();
    if (typeof index === "number" && index >= 0 && index < meta.photos.length) {
        const filename = meta.photos.splice(index, 1)[0];
        const fp = photoPath(filename);
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
        meta.version++;
        saveMeta(meta);
    }
    return NextResponse.json({ ok: true, count: meta.photos.length });
}
