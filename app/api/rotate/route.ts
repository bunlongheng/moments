import { NextResponse } from "next/server";
import { updateMeta, photoPath } from "@/lib/storage";
import { processImage } from "@/lib/images";
import { publish } from "@/lib/events";
import fs from "fs";

export async function POST(req: Request) {
    try {
        const { index } = await req.json();
        if (typeof index !== "number") {
            return NextResponse.json({ error: "Invalid index" }, { status: 400 });
        }

        // Whole read-rotate-swap runs under the lock so the index can't drift.
        const result = await updateMeta(async (meta) => {
            if (index < 0 || index >= meta.photos.length) return { error: "Invalid index", status: 400 };
            const oldPath = photoPath(meta.photos[index]);
            if (!fs.existsSync(oldPath)) return { error: "File not found", status: 404 };

            // Rotate 90° clockwise and re-encode to a new filename so caches refresh.
            const newName = await processImage(fs.readFileSync(oldPath), 90);
            fs.unlinkSync(oldPath);
            meta.photos[index] = newName;
            meta.version++;
            return { filename: newName };
        });

        if ("error" in result) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }
        publish();
        return NextResponse.json({ ok: true, filename: result.filename });
    } catch (e) {
        const message = e instanceof Error ? e.message : "Rotate failed";
        console.error("rotate failed:", message);
        return NextResponse.json({ error: "Rotate failed" }, { status: 500 });
    }
}
