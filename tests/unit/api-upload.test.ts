// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

// Mutable flag lets one test force a sharp failure.
const sharpState = vi.hoisted(() => ({ shouldThrow: false }));

vi.mock("sharp", () => ({
    default: vi.fn(() => ({
        rotate() { return this; },
        resize() { return this; },
        jpeg() { return this; },
        async toFile(p: string) {
            if (sharpState.shouldThrow) throw new Error("sharp boom");
            const fsmod = await import("fs");
            fsmod.writeFileSync(p, Buffer.from([0xff, 0xd8, 0xff, 0xe0]));
            return { size: 4 };
        },
    })),
}));

let dir: string;
let photosDir: string;
let metaFile: string;
let POST: (req: Request) => Promise<Response>;

beforeEach(async () => {
    sharpState.shouldThrow = false;
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "moments-upload-"));
    photosDir = path.join(dir, "photos");
    metaFile = path.join(dir, "meta.json");
    process.env.MOMENTS_DATA_DIR = dir;
    vi.resetModules();
    ({ POST } = await import("@/app/api/upload/route"));
});

afterEach(() => {
    delete process.env.MOMENTS_DATA_DIR;
    fs.rmSync(dir, { recursive: true, force: true });
});

function uploadReq(file: File | null) {
    const fd = new FormData();
    if (file) fd.set("file", file);
    return new Request("http://localhost/api/upload", { method: "POST", body: fd });
}

function pngFile(name = "test.png") {
    return new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], name, { type: "image/png" });
}

function seedPhotos(count: number) {
    fs.mkdirSync(photosDir, { recursive: true });
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
        const n = `seed${i}.jpg`;
        fs.writeFileSync(path.join(photosDir, n), "x");
        names.push(n);
    }
    fs.writeFileSync(metaFile, JSON.stringify({ photos: names, style: "ken-burns", version: 1 }));
}

describe("POST /api/upload", () => {
    it("returns 400 when no file is provided", async () => {
        const res = await POST(uploadReq(null));
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "No file" });
    });

    it("returns ok:true on a successful upload", async () => {
        const res = await POST(uploadReq(pngFile()));
        expect(res.status).toBe(200);
        expect((await res.json()).ok).toBe(true);
    });

    it("reports a count of 1 after the first upload", async () => {
        const res = await POST(uploadReq(pngFile()));
        expect((await res.json()).count).toBe(1);
    });

    it("returns a generated .jpg filename", async () => {
        const { filename } = await (await POST(uploadReq(pngFile()))).json();
        expect(filename).toMatch(/^\d+_[0-9a-f]{8}\.jpg$/);
    });

    it("writes the processed file into the photos directory", async () => {
        const { filename } = await (await POST(uploadReq(pngFile()))).json();
        expect(fs.existsSync(path.join(photosDir, filename))).toBe(true);
    });

    it("persists the uploaded photo in meta", async () => {
        const { filename } = await (await POST(uploadReq(pngFile()))).json();
        const meta = JSON.parse(fs.readFileSync(metaFile, "utf-8"));
        expect(meta.photos).toContain(filename);
    });

    it("bumps the version on each upload", async () => {
        await POST(uploadReq(pngFile()));
        const v1 = JSON.parse(fs.readFileSync(metaFile, "utf-8")).version;
        await POST(uploadReq(pngFile()));
        const v2 = JSON.parse(fs.readFileSync(metaFile, "utf-8")).version;
        expect(v2).toBe(v1 + 1);
    });

    it("increments the count across multiple uploads", async () => {
        await POST(uploadReq(pngFile()));
        const res = await POST(uploadReq(pngFile()));
        expect((await res.json()).count).toBe(2);
    });

    it("returns 400 when the max image limit is reached", async () => {
        seedPhotos(50);
        const res = await POST(uploadReq(pngFile()));
        expect(res.status).toBe(400);
        expect((await res.json()).error).toBe("Max images reached");
    });

    it("does not add a photo when at the limit", async () => {
        seedPhotos(50);
        await POST(uploadReq(pngFile()));
        const meta = JSON.parse(fs.readFileSync(metaFile, "utf-8"));
        expect(meta.photos).toHaveLength(50);
    });

    it("returns 500 with the error message when sharp fails", async () => {
        sharpState.shouldThrow = true;
        const res = await POST(uploadReq(pngFile()));
        expect(res.status).toBe(500);
        expect((await res.json()).error).toBe("sharp boom");
    });

    it("generates unique filenames for separate uploads", async () => {
        const a = await (await POST(uploadReq(pngFile()))).json();
        const b = await (await POST(uploadReq(pngFile()))).json();
        expect(a.filename).not.toBe(b.filename);
    });

    it("notifies SSE subscribers after a successful upload", async () => {
        const events = await import("@/lib/events");
        let fired = 0;
        const l = () => fired++;
        events.subscribe(l);
        await POST(uploadReq(pngFile()));
        events.unsubscribe(l);
        expect(fired).toBe(1);
    });
});
