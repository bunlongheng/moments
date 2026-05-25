import { NextResponse } from "next/server";
import { getMeta, saveMeta, getPhotosDir, photoPath } from "@/lib/storage";
import sharp from "sharp";
import path from "path";
import crypto from "crypto";
import fs from "fs";

const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 85;

export async function POST(req: Request) {
    try {
        const { index } = await req.json();
        const meta = getMeta();
        if (typeof index !== "number" || index < 0 || index >= meta.photos.length) {
            return NextResponse.json({ error: "Invalid index" }, { status: 400 });
        }

        const oldName = meta.photos[index];
        const oldPath = photoPath(oldName);
        if (!fs.existsSync(oldPath)) {
            return NextResponse.json({ error: "File not found" }, { status: 404 });
        }

        const buffer = fs.readFileSync(oldPath);
        const id = crypto.randomBytes(4).toString("hex");
        const newName = `${Date.now()}_${id}.jpg`;

        // Rotate 90° clockwise and re-encode to a new filename so caches refresh.
        await sharp(buffer)
            .rotate(90)
            .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
            .jpeg({ quality: JPEG_QUALITY, progressive: true })
            .toFile(path.join(getPhotosDir(), newName));

        fs.unlinkSync(oldPath);
        meta.photos[index] = newName;
        meta.version++;
        saveMeta(meta);

        return NextResponse.json({ ok: true, filename: newName });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
