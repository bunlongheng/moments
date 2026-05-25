// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

let dir: string;
let photosDir: string;
let metaFile: string;
let POST: (req: Request) => Promise<Response>;

beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "moments-delete-"));
    photosDir = path.join(dir, "photos");
    metaFile = path.join(dir, "meta.json");
    process.env.MOMENTS_DATA_DIR = dir;
    vi.resetModules();
    ({ POST } = await import("@/app/api/delete/route"));
});

afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.MOMENTS_DATA_DIR;
    fs.rmSync(dir, { recursive: true, force: true });
});

function deleteReq(body: unknown) {
    return new Request("http://localhost/api/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

function seed(names: string[], { createFiles = true } = {}) {
    fs.mkdirSync(photosDir, { recursive: true });
    if (createFiles) for (const n of names) fs.writeFileSync(path.join(photosDir, n), "x");
    fs.writeFileSync(metaFile, JSON.stringify({ photos: names, style: "fade", version: 3 }));
}

describe("POST /api/delete", () => {
    it("removes the photo at a valid index", async () => {
        seed(["a.jpg", "b.jpg", "c.jpg"]);
        const res = await POST(deleteReq({ index: 1 }));
        expect((await res.json()).count).toBe(2);
        expect(JSON.parse(fs.readFileSync(metaFile, "utf-8")).photos).toEqual(["a.jpg", "c.jpg"]);
    });

    it("deletes the underlying file from disk", async () => {
        seed(["a.jpg", "b.jpg"]);
        await POST(deleteReq({ index: 0 }));
        expect(fs.existsSync(path.join(photosDir, "a.jpg"))).toBe(false);
    });

    it("returns ok:true", async () => {
        seed(["a.jpg"]);
        expect((await (await POST(deleteReq({ index: 0 }))).json()).ok).toBe(true);
    });

    it("bumps the version on a valid delete", async () => {
        seed(["a.jpg"]);
        await POST(deleteReq({ index: 0 }));
        expect(JSON.parse(fs.readFileSync(metaFile, "utf-8")).version).toBe(4);
    });

    it("ignores a negative index", async () => {
        seed(["a.jpg", "b.jpg"]);
        const res = await POST(deleteReq({ index: -1 }));
        expect((await res.json()).count).toBe(2);
        expect(JSON.parse(fs.readFileSync(metaFile, "utf-8")).photos).toEqual(["a.jpg", "b.jpg"]);
    });

    it("ignores an index beyond the array length", async () => {
        seed(["a.jpg", "b.jpg"]);
        const res = await POST(deleteReq({ index: 5 }));
        expect((await res.json()).count).toBe(2);
    });

    it("ignores an index equal to the array length", async () => {
        seed(["a.jpg", "b.jpg"]);
        const res = await POST(deleteReq({ index: 2 }));
        expect((await res.json()).count).toBe(2);
    });

    it("ignores a non-number index", async () => {
        seed(["a.jpg", "b.jpg"]);
        const res = await POST(deleteReq({ index: "1" }));
        expect((await res.json()).count).toBe(2);
    });

    it("does not bump the version on an invalid index", async () => {
        seed(["a.jpg"]);
        await POST(deleteReq({ index: 9 }));
        expect(JSON.parse(fs.readFileSync(metaFile, "utf-8")).version).toBe(3);
    });

    it("skips the unlink when the file vanishes after the meta read", async () => {
        seed(["a.jpg"]);
        const target = path.join(photosDir, "a.jpg");
        const real = fs.existsSync.bind(fs);
        let seen = 0;
        // True for getMeta's orphan check, false by the time the route unlinks.
        vi.spyOn(fs, "existsSync").mockImplementation((p) => {
            if (p === target) return ++seen === 1;
            return real(p as fs.PathLike);
        });
        const unlinkSpy = vi.spyOn(fs, "unlinkSync");
        const res = await POST(deleteReq({ index: 0 }));
        expect((await res.json()).count).toBe(0);
        expect(unlinkSpy).not.toHaveBeenCalled();
    });

    it("drops orphaned photos before deleting (missing files yield count 0)", async () => {
        seed(["a.jpg", "b.jpg"], { createFiles: false });
        const res = await POST(deleteReq({ index: 0 }));
        expect((await res.json()).count).toBe(0);
    });

    it("deletes the first photo at index 0", async () => {
        seed(["first.jpg", "second.jpg"]);
        await POST(deleteReq({ index: 0 }));
        expect(JSON.parse(fs.readFileSync(metaFile, "utf-8")).photos).toEqual(["second.jpg"]);
    });

    it("preserves the order of the remaining photos", async () => {
        seed(["a.jpg", "b.jpg", "c.jpg", "d.jpg"]);
        await POST(deleteReq({ index: 2 }));
        expect(JSON.parse(fs.readFileSync(metaFile, "utf-8")).photos).toEqual(["a.jpg", "b.jpg", "d.jpg"]);
    });
});
