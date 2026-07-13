import { NextResponse } from "next/server";
import { getMeta, updateMeta } from "@/lib/storage";
import { publish } from "@/lib/events";

const VALID_STYLES = ["ken-burns", "fade", "slide", "zoom", "none"];

export async function GET() {
    const meta = getMeta();
    return NextResponse.json({ style: meta.style });
}

export async function POST(req: Request) {
    const { style } = await req.json();
    const applied = await updateMeta((meta) => {
        meta.style = VALID_STYLES.includes(style) ? style : "ken-burns";
        meta.version++;
        return meta.style;
    });
    publish();
    return NextResponse.json({ ok: true, style: applied });
}
