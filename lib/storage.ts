import fs from "fs";
import path from "path";
import crypto from "crypto";

const DATA_DIR = process.env.MOMENTS_DATA_DIR
    ? path.resolve(process.env.MOMENTS_DATA_DIR)
    : path.join(process.cwd(), "data");
const PHOTOS_DIR = path.join(DATA_DIR, "photos");
const META_FILE = path.join(DATA_DIR, "meta.json");

export type Meta = {
    photos: string[];       // filenames in order
    style: string;          // slideshow style
    version: number;        // bumped on every change
    selected?: number | null; // pinned photo index, or null/absent for auto-advance
};

function ensureDirs() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(PHOTOS_DIR)) fs.mkdirSync(PHOTOS_DIR, { recursive: true });
}

export function getMeta(): Meta {
    ensureDirs();
    if (fs.existsSync(META_FILE)) {
        try {
            const raw = fs.readFileSync(META_FILE, "utf-8");
            const data = JSON.parse(raw);
            // Clean orphans
            data.photos = (data.photos || []).filter((f: string) =>
                fs.existsSync(path.join(PHOTOS_DIR, f))
            );
            return { style: "ken-burns", version: 0, selected: null, ...data };
        } catch {
            return { photos: [], style: "ken-burns", version: 0, selected: null };
        }
    }
    return { photos: [], style: "ken-burns", version: 0, selected: null };
}

export function saveMeta(meta: Meta) {
    ensureDirs();
    // Atomic write: write to a temp file then rename, so a crash mid-write
    // can never leave a truncated meta.json.
    const tmp = `${META_FILE}.${crypto.randomBytes(4).toString("hex")}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(meta));
    fs.renameSync(tmp, META_FILE);
}

// Serialize all read-modify-write cycles through one in-process queue so
// concurrent requests can't clobber each other's meta.json updates.
let queue: Promise<unknown> = Promise.resolve();

export function updateMeta<T>(fn: (meta: Meta) => T | Promise<T>): Promise<T> {
    const run = queue.then(async () => {
        const meta = getMeta();
        const result = await fn(meta);
        saveMeta(meta);
        return result;
    });
    queue = run.then(
        () => undefined,
        () => undefined,
    );
    return run;
}

export function getPhotosDir() {
    ensureDirs();
    return PHOTOS_DIR;
}

export function photoPath(filename: string) {
    return path.join(PHOTOS_DIR, filename);
}
