import { photoPath, getPhotosDir } from "@/lib/storage";
import fs from "fs";
import path from "path";

export async function GET(_req: Request, { params }: { params: Promise<{ filename: string }> }) {
    const { filename } = await params;
    const fp = path.resolve(photoPath(filename));
    // Reject any resolved path that escapes the photos directory (path traversal).
    const root = path.resolve(getPhotosDir()) + path.sep;
    if (!fp.startsWith(root) || !fs.existsSync(fp)) {
        return new Response("Not found", { status: 404 });
    }
    const data = await fs.promises.readFile(fp);
    return new Response(new Uint8Array(data), {
        headers: {
            "Content-Type": "image/jpeg",
            "Cache-Control": "public, max-age=86400, immutable",
            "Content-Length": String(data.length),
        },
    });
}
