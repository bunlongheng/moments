import { NextResponse } from "next/server";
import { getMeta, updateMeta } from "@/lib/storage";
import { processImage, MAX_UPLOAD_BYTES } from "@/lib/images";
import { publish } from "@/lib/events";

const MAX_IMAGES = 50;

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

        // Reject oversize files before buffering the body into memory.
        if (file.size > MAX_UPLOAD_BYTES) {
            return NextResponse.json({ error: "File too large" }, { status: 413 });
        }
        if (getMeta().photos.length >= MAX_IMAGES) {
            return NextResponse.json({ error: "Max images reached" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const filename = await processImage(buffer);

        // Commit the manifest change under the serialized lock.
        const count = await updateMeta((meta) => {
            meta.photos.unshift(filename);                 // newest first — shows on top
            if (meta.selected != null) meta.selected++;    // keep any pin on the same photo after the shift
            meta.version++;
            return meta.photos.length;
        });
        publish();

        return NextResponse.json({ ok: true, count, filename });
    } catch (e) {
        const message = e instanceof Error ? e.message : "Upload failed";
        console.error("upload failed:", message);
        return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
}
