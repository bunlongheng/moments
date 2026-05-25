// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

let dir: string;
let photosDir: string;
let metaFile: string;
let GET: (req: Request) => Promise<Response>;

beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "moments-images-"));
    photosDir = path.join(dir, "photos");
    metaFile = path.join(dir, "meta.json");
    process.env.MOMENTS_DATA_DIR = dir;
    vi.resetModules();
    ({ GET } = await import("@/app/api/images/route"));
});

afterEach(() => {
    delete process.env.MOMENTS_DATA_DIR;
    fs.rmSync(dir, { recursive: true, force: true });
});

function seed(names: string[], version: number, { createFiles = true } = {}) {
    fs.mkdirSync(photosDir, { recursive: true });
    if (createFiles) for (const n of names) fs.writeFileSync(path.join(photosDir, n), "x");
    fs.writeFileSync(metaFile, JSON.stringify({ photos: names, style: "fade", version }));
}

function getReq(ifNoneMatch?: string) {
    const headers: Record<string, string> = {};
    if (ifNoneMatch !== undefined) headers["if-none-match"] = ifNoneMatch;
    return new Request("http://localhost/api/images", { headers });
}

describe("GET /api/images", () => {
    it("returns an empty array when there are no photos", async () => {
        const res = await GET(getReq());
        expect(await res.json()).toEqual([]);
    });

    it("maps photos to /api/photo URLs", async () => {
        seed(["a.jpg", "b.jpg"], 2);
        expect(await (await GET(getReq())).json()).toEqual(["/api/photo/a.jpg", "/api/photo/b.jpg"]);
    });

    it("preserves photo order", async () => {
        seed(["c.jpg", "a.jpg", "b.jpg"], 2);
        expect(await (await GET(getReq())).json()).toEqual([
            "/api/photo/c.jpg",
            "/api/photo/a.jpg",
            "/api/photo/b.jpg",
        ]);
    });

    it("sets the ETag header to the current version", async () => {
        seed(["a.jpg"], 7);
        expect((await GET(getReq())).headers.get("ETag")).toBe("7");
    });

    it("sets Cache-Control to no-cache", async () => {
        seed(["a.jpg"], 7);
        expect((await GET(getReq())).headers.get("Cache-Control")).toBe("no-cache");
    });

    it("returns 304 when if-none-match matches the version", async () => {
        seed(["a.jpg"], 4);
        const res = await GET(getReq("4"));
        expect(res.status).toBe(304);
    });

    it("returns a null body on a 304 response", async () => {
        seed(["a.jpg"], 4);
        const res = await GET(getReq("4"));
        expect(await res.text()).toBe("");
    });

    it("returns 200 with the list when if-none-match does not match", async () => {
        seed(["a.jpg"], 4);
        const res = await GET(getReq("999"));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual(["/api/photo/a.jpg"]);
    });

    it("omits orphaned photos whose files are missing", async () => {
        seed(["real.jpg", "ghost.jpg"], 2, { createFiles: false });
        fs.writeFileSync(path.join(photosDir, "real.jpg"), "x");
        expect(await (await GET(getReq())).json()).toEqual(["/api/photo/real.jpg"]);
    });

    it("uses version 0 as the ETag for a fresh store", async () => {
        expect((await GET(getReq())).headers.get("ETag")).toBe("0");
    });
});
