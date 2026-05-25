// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

const sharpState = vi.hoisted(() => ({ shouldThrow: false }));

vi.mock("sharp", () => ({
    default: vi.fn(() => ({
        rotate() { return this; },
        resize() { return this; },
        jpeg() { return this; },
        async toFile(p: string) {
            if (sharpState.shouldThrow) throw new Error("rotate boom");
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
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "moments-rotate-"));
    photosDir = path.join(dir, "photos");
    metaFile = path.join(dir, "meta.json");
    process.env.MOMENTS_DATA_DIR = dir;
    vi.resetModules();
    ({ POST } = await import("@/app/api/rotate/route"));
});

afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.MOMENTS_DATA_DIR;
    fs.rmSync(dir, { recursive: true, force: true });
});

function rotateReq(body: unknown) {
    return new Request("http://localhost/api/rotate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

function seed(names: string[]) {
    fs.mkdirSync(photosDir, { recursive: true });
    for (const n of names) fs.writeFileSync(path.join(photosDir, n), "original");
    fs.writeFileSync(metaFile, JSON.stringify({ photos: names, style: "fade", version: 2 }));
}

describe("POST /api/rotate", () => {
    it("returns 400 for a negative index", async () => {
        seed(["a.jpg"]);
        expect((await POST(rotateReq({ index: -1 }))).status).toBe(400);
    });

    it("returns 400 for an index past the end", async () => {
        seed(["a.jpg"]);
        expect((await POST(rotateReq({ index: 5 }))).status).toBe(400);
    });

    it("returns 400 for a non-number index", async () => {
        seed(["a.jpg"]);
        expect((await POST(rotateReq({ index: "1" }))).status).toBe(400);
    });

    it("returns ok and a new filename on success", async () => {
        seed(["a.jpg"]);
        const body = await (await POST(rotateReq({ index: 0 }))).json();
        expect(body.ok).toBe(true);
        expect(body.filename).toMatch(/^\d+_[0-9a-f]{8}\.jpg$/);
    });

    it("replaces the meta entry with the rotated file", async () => {
        seed(["a.jpg"]);
        const { filename } = await (await POST(rotateReq({ index: 0 }))).json();
        const meta = JSON.parse(fs.readFileSync(metaFile, "utf-8"));
        expect(meta.photos[0]).toBe(filename);
        expect(meta.photos[0]).not.toBe("a.jpg");
    });

    it("deletes the original file", async () => {
        seed(["a.jpg"]);
        await POST(rotateReq({ index: 0 }));
        expect(fs.existsSync(path.join(photosDir, "a.jpg"))).toBe(false);
    });

    it("writes the rotated file to disk", async () => {
        seed(["a.jpg"]);
        const { filename } = await (await POST(rotateReq({ index: 0 }))).json();
        expect(fs.existsSync(path.join(photosDir, filename))).toBe(true);
    });

    it("bumps the version", async () => {
        seed(["a.jpg"]);
        await POST(rotateReq({ index: 0 }));
        expect(JSON.parse(fs.readFileSync(metaFile, "utf-8")).version).toBe(3);
    });

    it("only touches the targeted photo in a multi-photo set", async () => {
        seed(["a.jpg", "b.jpg", "c.jpg"]);
        await POST(rotateReq({ index: 1 }));
        const meta = JSON.parse(fs.readFileSync(metaFile, "utf-8"));
        expect(meta.photos[0]).toBe("a.jpg");
        expect(meta.photos[2]).toBe("c.jpg");
        expect(meta.photos[1]).not.toBe("b.jpg");
    });

    it("returns 500 when sharp fails", async () => {
        seed(["a.jpg"]);
        sharpState.shouldThrow = true;
        const res = await POST(rotateReq({ index: 0 }));
        expect(res.status).toBe(500);
        expect((await res.json()).error).toBe("rotate boom");
    });

    it("returns 404 when the file vanishes after the meta read", async () => {
        seed(["a.jpg"]);
        const target = path.join(photosDir, "a.jpg");
        const real = fs.existsSync.bind(fs);
        let seen = 0;
        vi.spyOn(fs, "existsSync").mockImplementation((p) => {
            if (p === target) return ++seen === 1; // present for getMeta, gone for the route
            return real(p as fs.PathLike);
        });
        expect((await POST(rotateReq({ index: 0 }))).status).toBe(404);
    });
});
