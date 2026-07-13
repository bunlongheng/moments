import { http, HttpResponse } from "msw";

/**
 * In-memory store backing the mocked Moments API for component tests.
 * Tests seed `db.photos` / `db.style` and call `db.reset()` between cases.
 */
export const db = {
    photos: [] as string[],
    style: "ken-burns",
    selected: null as number | null,
    failImages: false,
    reset() {
        this.photos = [];
        this.style = "ken-burns";
        this.selected = null;
        this.failImages = false;
    },
};

const BASE = "http://localhost";

export const handlers = [
    http.get(`${BASE}/api/images`, () => {
        if (db.failImages) return new HttpResponse(null, { status: 500 });
        return HttpResponse.json(db.photos);
    }),

    http.get(`${BASE}/api/style`, () => HttpResponse.json({ style: db.style })),

    http.get(`${BASE}/api/select`, () => HttpResponse.json({ selected: db.selected })),

    http.post(`${BASE}/api/select`, async ({ request }) => {
        const { index } = (await request.json()) as { index: number };
        const i = Number.isInteger(index) && index >= 0 && index < db.photos.length ? index : null;
        // Tapping the already-pinned photo clears the pin.
        db.selected = i === null || db.selected === i ? null : i;
        return HttpResponse.json({ ok: true, selected: db.selected });
    }),

    http.get(`${BASE}/api/lan`, () =>
        HttpResponse.json({
            url: "http://192.0.2.10:8888/upload",
            qr: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/1eaAAAAAElFTkSuQmCC",
        })
    ),

    http.post(`${BASE}/api/style`, async ({ request }) => {
        const { style } = (await request.json()) as { style: string };
        const valid = ["ken-burns", "fade", "slide", "zoom", "none"];
        db.style = valid.includes(style) ? style : "ken-burns";
        return HttpResponse.json({ ok: true, style: db.style });
    }),

    http.post(`${BASE}/api/upload`, () => {
        db.photos = [...db.photos, `/api/photo/p${db.photos.length}_${Date.now()}.jpg`];
        return HttpResponse.json({ ok: true, count: db.photos.length });
    }),

    http.post(`${BASE}/api/rotate`, async ({ request }) => {
        const { index } = (await request.json()) as { index: number };
        if (typeof index === "number" && index >= 0 && index < db.photos.length) {
            db.photos[index] = `/api/photo/rot${index}_${Date.now()}.jpg`;
        }
        return HttpResponse.json({ ok: true, filename: db.photos[index] });
    }),

    http.post(`${BASE}/api/delete`, async ({ request }) => {
        const { index } = (await request.json()) as { index: number };
        if (typeof index === "number" && index >= 0 && index < db.photos.length) {
            db.photos.splice(index, 1);
            db.selected = null; // indices shifted; drop any pin
        }
        return HttpResponse.json({ ok: true, count: db.photos.length });
    }),
];
