import { NextResponse } from "next/server";
import { updateMeta, photoPath } from "@/lib/storage";
import { publish } from "@/lib/events";
import fs from "fs";

export async function POST(req: Request) {
    const { index } = await req.json();
    let changed = false;
    const count = await updateMeta((meta) => {
        if (typeof index === "number" && index >= 0 && index < meta.photos.length) {
            const filename = meta.photos.splice(index, 1)[0];
            const fp = photoPath(filename);
            if (fs.existsSync(fp)) fs.unlinkSync(fp);
            meta.selected = null; // indices shifted; drop any pin
            meta.version++;
            changed = true;
        }
        return meta.photos.length;
    });
    if (changed) publish();
    return NextResponse.json({ ok: true, count });
}
