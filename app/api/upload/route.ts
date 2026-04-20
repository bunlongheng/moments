import { NextResponse } from "next/server";
import { getMeta, saveMeta, getPhotosDir } from "@/lib/storage";
import sharp from "sharp";
import path from "path";
import crypto from "crypto";

const MAX_IMAGES = 50;
const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 85;

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

        const meta = getMeta();
        if (meta.photos.length >= MAX_IMAGES) {
            return NextResponse.json({ error: "Max images reached" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const id = crypto.randomBytes(4).toString("hex");
        const filename = `${Date.now()}_${id}.jpg`;

        // Sharp: auto-rotate EXIF + resize + compress — single pipeline, native C++
        await sharp(buffer)
            .rotate()                           // auto EXIF rotate
            .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
            .jpeg({ quality: JPEG_QUALITY, progressive: true })
            .toFile(path.join(getPhotosDir(), filename));

        meta.photos.push(filename);
        meta.version++;
        saveMeta(meta);

        return NextResponse.json({ ok: true, count: meta.photos.length, filename });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
