import fs from "fs";
import path from "path";

/** A minimal valid 1x1 PNG that sharp can decode and re-encode. */
export const PNG_1x1 = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
);

/** A Playwright file payload for setInputFiles / multipart uploads. */
export const pngUpload = (name = "moment.png") => ({
    name,
    mimeType: "image/png",
    buffer: PNG_1x1,
});

/** Wipe the isolated E2E data dir so each test starts from a clean slate. */
export function clearE2EData() {
    fs.rmSync(path.resolve(".e2e-data"), { recursive: true, force: true });
}
