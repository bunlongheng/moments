import sharp from "sharp";
import path from "path";
import crypto from "crypto";
import { getPhotosDir } from "./storage";

export const MAX_DIMENSION = 1920;
export const JPEG_QUALITY = 85;
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB per file

/**
 * Single native Sharp pipeline shared by upload and rotate: optional fixed
 * rotation, EXIF auto-rotate, bound dimensions, progressive JPEG. Writes a new
 * uniquely named file into the photos dir and returns its filename.
 *
 * @param rotate  degrees to rotate before EXIF auto-orient (0 = auto only)
 */
export async function processImage(buffer: Buffer, rotate = 0): Promise<string> {
    const id = crypto.randomBytes(4).toString("hex");
    const filename = `${Date.now()}_${id}.jpg`;
    await sharp(buffer)
        .rotate(rotate || undefined) // rotate(deg) for a fixed turn, rotate() for EXIF auto-orient
        .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: JPEG_QUALITY, progressive: true })
        .toFile(path.join(getPhotosDir(), filename));
    return filename;
}
