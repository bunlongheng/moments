import { NextResponse } from "next/server";
import { getMeta, saveMeta } from "@/lib/storage";

const VALID_STYLES = ["ken-burns", "fade", "slide", "zoom", "none"];

export async function GET() {
    const meta = getMeta();
    return NextResponse.json({ style: meta.style });
}

export async function POST(req: Request) {
    const { style } = await req.json();
    const meta = getMeta();
    meta.style = VALID_STYLES.includes(style) ? style : "ken-burns";
    meta.version++;
    saveMeta(meta);
    return NextResponse.json({ ok: true, style: meta.style });
}
