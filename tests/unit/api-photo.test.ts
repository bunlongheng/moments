// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

let dir: string;
let photosDir: string;
let GET: (req: Request, ctx: { params: Promise<{ filename: string }> }) => Promise<Response>;

beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "moments-photo-"));
    photosDir = path.join(dir, "photos");
    fs.mkdirSync(photosDir, { recursive: true });
    process.env.MOMENTS_DATA_DIR = dir;
    vi.resetModules();
    ({ GET } = await import("@/app/api/photo/[filename]/route"));
});

afterEach(() => {
    delete process.env.MOMENTS_DATA_DIR;
    fs.rmSync(dir, { recursive: true, force: true });
});

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

function call(filename: string) {
    return GET(new Request("http://localhost/api/photo/x"), { params: Promise.resolve({ filename }) });
}

describe("GET /api/photo/[filename]", () => {
    it("returns 404 for a missing file", async () => {
        const res = await call("nope.jpg");
        expect(res.status).toBe(404);
        expect(await res.text()).toBe("Not found");
    });

    it("returns 200 for an existing file", async () => {
        fs.writeFileSync(path.join(photosDir, "a.jpg"), JPEG);
        expect((await call("a.jpg")).status).toBe(200);
    });

    it("serves the image bytes", async () => {
        fs.writeFileSync(path.join(photosDir, "a.jpg"), JPEG);
        const buf = Buffer.from(await (await call("a.jpg")).arrayBuffer());
        expect(buf.equals(JPEG)).toBe(true);
    });

    it("sets Content-Type to image/jpeg", async () => {
        fs.writeFileSync(path.join(photosDir, "a.jpg"), JPEG);
        expect((await call("a.jpg")).headers.get("Content-Type")).toBe("image/jpeg");
    });

    it("sets an immutable Cache-Control header", async () => {
        fs.writeFileSync(path.join(photosDir, "a.jpg"), JPEG);
        expect((await call("a.jpg")).headers.get("Cache-Control")).toBe("public, max-age=86400, immutable");
    });

    it("sets Content-Length to the byte size", async () => {
        fs.writeFileSync(path.join(photosDir, "a.jpg"), JPEG);
        expect((await call("a.jpg")).headers.get("Content-Length")).toBe(String(JPEG.length));
    });

    it("blocks path traversal even when the resolved file exists", async () => {
        fs.writeFileSync(path.join(dir, "secret"), "top secret");
        const res = await call("../secret");
        expect(res.status).toBe(404);
    });

    it("returns 404 for a traversal pattern that does not resolve", async () => {
        const res = await call("../../etc/passwd");
        expect(res.status).toBe(404);
    });
});
