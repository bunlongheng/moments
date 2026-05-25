// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

type StorageModule = typeof import("@/lib/storage");

let dir: string;
let metaFile: string;
let photosDir: string;
let storage: StorageModule;

beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "moments-storage-"));
    metaFile = path.join(dir, "meta.json");
    photosDir = path.join(dir, "photos");
    process.env.MOMENTS_DATA_DIR = dir;
    vi.resetModules();
    storage = await import("@/lib/storage");
});

afterEach(() => {
    delete process.env.MOMENTS_DATA_DIR;
    fs.rmSync(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
});

/** Write a fake photo file into the photos dir so getMeta's orphan filter keeps it. */
function touchPhoto(name: string) {
    fs.mkdirSync(photosDir, { recursive: true });
    fs.writeFileSync(path.join(photosDir, name), "x");
}

describe("getPhotosDir", () => {
    it("creates the data directory", () => {
        storage.getPhotosDir();
        expect(fs.existsSync(dir)).toBe(true);
    });

    it("creates the photos directory", () => {
        const p = storage.getPhotosDir();
        expect(fs.existsSync(p)).toBe(true);
    });

    it("returns the photos path inside the data dir", () => {
        expect(storage.getPhotosDir()).toBe(photosDir);
    });

    it("is idempotent across multiple calls", () => {
        const a = storage.getPhotosDir();
        const b = storage.getPhotosDir();
        expect(a).toBe(b);
        expect(fs.existsSync(b)).toBe(true);
    });
});

describe("photoPath", () => {
    it("joins the photos dir with the filename", () => {
        expect(storage.photoPath("a.jpg")).toBe(path.join(photosDir, "a.jpg"));
    });

    it("returns an absolute path", () => {
        expect(path.isAbsolute(storage.photoPath("a.jpg"))).toBe(true);
    });

    it("handles filenames with timestamps and hex ids", () => {
        const name = "1700000000000_deadbeef.jpg";
        expect(storage.photoPath(name)).toBe(path.join(photosDir, name));
    });
});

describe("getMeta defaults", () => {
    it("returns empty photos when no meta file exists", () => {
        expect(storage.getMeta().photos).toEqual([]);
    });

    it("returns default style ken-burns when no meta file exists", () => {
        expect(storage.getMeta().style).toBe("ken-burns");
    });

    it("returns version 0 when no meta file exists", () => {
        expect(storage.getMeta().version).toBe(0);
    });

    it("returns an object with photos, style and version keys", () => {
        const meta = storage.getMeta();
        expect(Object.keys(meta).sort()).toEqual(["photos", "style", "version"]);
    });

    it("creates the directories as a side effect", () => {
        storage.getMeta();
        expect(fs.existsSync(photosDir)).toBe(true);
    });
});

describe("getMeta with existing file", () => {
    it("reads a saved style", () => {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(metaFile, JSON.stringify({ photos: [], style: "fade", version: 2 }));
        expect(storage.getMeta().style).toBe("fade");
    });

    it("reads a saved version", () => {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(metaFile, JSON.stringify({ photos: [], style: "fade", version: 7 }));
        expect(storage.getMeta().version).toBe(7);
    });

    it("applies default style when the file omits it", () => {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(metaFile, JSON.stringify({ photos: [], version: 3 }));
        expect(storage.getMeta().style).toBe("ken-burns");
    });

    it("defaults version to 0 when the file omits it", () => {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(metaFile, JSON.stringify({ photos: [], style: "zoom" }));
        expect(storage.getMeta().version).toBe(0);
    });

    it("defaults photos to [] when the file omits it", () => {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(metaFile, JSON.stringify({ style: "slide", version: 1 }));
        expect(storage.getMeta().photos).toEqual([]);
    });

    it("returns defaults when the file is corrupt JSON", () => {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(metaFile, "{ not valid json ");
        const meta = storage.getMeta();
        expect(meta).toEqual({ photos: [], style: "ken-burns", version: 0 });
    });
});

describe("getMeta orphan cleanup", () => {
    it("keeps photos whose files exist", () => {
        touchPhoto("a.jpg");
        fs.writeFileSync(metaFile, JSON.stringify({ photos: ["a.jpg"], style: "fade", version: 1 }));
        expect(storage.getMeta().photos).toEqual(["a.jpg"]);
    });

    it("drops photos whose files are missing", () => {
        fs.mkdirSync(photosDir, { recursive: true });
        fs.writeFileSync(metaFile, JSON.stringify({ photos: ["ghost.jpg"], style: "fade", version: 1 }));
        expect(storage.getMeta().photos).toEqual([]);
    });

    it("keeps only the existing photos from a mixed list", () => {
        touchPhoto("real1.jpg");
        touchPhoto("real2.jpg");
        fs.writeFileSync(
            metaFile,
            JSON.stringify({ photos: ["real1.jpg", "ghost.jpg", "real2.jpg"], style: "fade", version: 1 })
        );
        expect(storage.getMeta().photos).toEqual(["real1.jpg", "real2.jpg"]);
    });

    it("preserves the order of existing photos", () => {
        touchPhoto("c.jpg");
        touchPhoto("a.jpg");
        touchPhoto("b.jpg");
        fs.writeFileSync(metaFile, JSON.stringify({ photos: ["c.jpg", "a.jpg", "b.jpg"], style: "fade", version: 1 }));
        expect(storage.getMeta().photos).toEqual(["c.jpg", "a.jpg", "b.jpg"]);
    });
});

describe("saveMeta", () => {
    it("writes a meta.json file", () => {
        storage.saveMeta({ photos: [], style: "fade", version: 1 });
        expect(fs.existsSync(metaFile)).toBe(true);
    });

    it("persists style and version round-trip", () => {
        storage.saveMeta({ photos: [], style: "zoom", version: 5 });
        const meta = storage.getMeta();
        expect(meta.style).toBe("zoom");
        expect(meta.version).toBe(5);
    });

    it("persists photo filenames that exist on disk", () => {
        touchPhoto("kept.jpg");
        storage.saveMeta({ photos: ["kept.jpg"], style: "fade", version: 1 });
        expect(storage.getMeta().photos).toEqual(["kept.jpg"]);
    });

    it("overwrites a previously saved meta", () => {
        storage.saveMeta({ photos: [], style: "fade", version: 1 });
        storage.saveMeta({ photos: [], style: "none", version: 9 });
        expect(storage.getMeta().style).toBe("none");
        expect(storage.getMeta().version).toBe(9);
    });

    it("creates directories when saving before any read", () => {
        fs.rmSync(dir, { recursive: true, force: true });
        storage.saveMeta({ photos: [], style: "fade", version: 1 });
        expect(fs.existsSync(metaFile)).toBe(true);
    });
});
