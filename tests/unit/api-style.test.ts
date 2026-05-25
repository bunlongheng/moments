// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

let dir: string;
let metaFile: string;
let GET: () => Promise<Response>;
let POST: (req: Request) => Promise<Response>;

beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "moments-style-"));
    metaFile = path.join(dir, "meta.json");
    process.env.MOMENTS_DATA_DIR = dir;
    vi.resetModules();
    ({ GET, POST } = await import("@/app/api/style/route"));
});

afterEach(() => {
    delete process.env.MOMENTS_DATA_DIR;
    fs.rmSync(dir, { recursive: true, force: true });
});

function postReq(body: unknown) {
    return new Request("http://localhost/api/style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

describe("GET /api/style", () => {
    it("returns the default ken-burns style for a fresh store", async () => {
        expect(await (await GET()).json()).toEqual({ style: "ken-burns" });
    });

    it("returns a previously saved style", async () => {
        fs.writeFileSync(metaFile, JSON.stringify({ photos: [], style: "zoom", version: 1 }));
        expect((await (await GET()).json()).style).toBe("zoom");
    });
});

describe("POST /api/style", () => {
    it.each(["ken-burns", "fade", "slide", "zoom", "none"])(
        "accepts the valid style %s",
        async (style) => {
            const res = await POST(postReq({ style }));
            expect((await res.json()).style).toBe(style);
        }
    );

    it("returns ok:true", async () => {
        expect((await (await POST(postReq({ style: "fade" }))).json()).ok).toBe(true);
    });

    it("falls back to ken-burns for an invalid style", async () => {
        const res = await POST(postReq({ style: "rainbow" }));
        expect((await res.json()).style).toBe("ken-burns");
    });

    it("falls back to ken-burns for an undefined style", async () => {
        const res = await POST(postReq({}));
        expect((await res.json()).style).toBe("ken-burns");
    });

    it("persists the saved style to disk", async () => {
        await POST(postReq({ style: "slide" }));
        expect(JSON.parse(fs.readFileSync(metaFile, "utf-8")).style).toBe("slide");
    });

    it("bumps the version on save", async () => {
        fs.writeFileSync(metaFile, JSON.stringify({ photos: [], style: "fade", version: 5 }));
        await POST(postReq({ style: "zoom" }));
        expect(JSON.parse(fs.readFileSync(metaFile, "utf-8")).version).toBe(6);
    });

    it("is reflected by a subsequent GET", async () => {
        await POST(postReq({ style: "none" }));
        expect((await (await GET()).json()).style).toBe("none");
    });
});
