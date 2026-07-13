import { NextResponse } from "next/server";
import { getMeta, updateMeta } from "@/lib/storage";
import { publish } from "@/lib/events";

export async function GET() {
    const meta = getMeta();
    return NextResponse.json({ selected: meta.selected ?? null });
}

export async function POST(req: Request) {
    const { index } = await req.json();
    const selected = await updateMeta((meta) => {
        const i = Number.isInteger(index) && index >= 0 && index < meta.photos.length ? index : null;
        // Tapping the photo that's already pinned clears the pin and resumes auto-advance.
        meta.selected = i === null || meta.selected === i ? null : i;
        meta.version++;
        return meta.selected;
    });
    publish();
    return NextResponse.json({ ok: true, selected });
}
