import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const PHOTOS_DIR = path.join(DATA_DIR, "photos");
const META_FILE = path.join(DATA_DIR, "meta.json");

export type Meta = {
    photos: string[];       // filenames in order
    style: string;          // slideshow style
    version: number;        // bumped on every change
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
            return { style: "ken-burns", version: 0, ...data };
        } catch {
            return { photos: [], style: "ken-burns", version: 0 };
        }
    }
    return { photos: [], style: "ken-burns", version: 0 };
}

export function saveMeta(meta: Meta) {
    ensureDirs();
    fs.writeFileSync(META_FILE, JSON.stringify(meta));
}

export function getPhotosDir() {
    ensureDirs();
    return PHOTOS_DIR;
}

export function photoPath(filename: string) {
    return path.join(PHOTOS_DIR, filename);
}
