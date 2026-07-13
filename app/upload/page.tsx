"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";

const SLIDE_MS = 10000; // mirror the display's wall-clock cadence to know what's on screen

/* ── Styles ─────────────────────────────────────────────────────────────────── */

const STYLES = [
    { id: "ken-burns", label: "Ken Burns" },
    { id: "fade", label: "Fade" },
    { id: "slide", label: "Slide" },
    { id: "zoom", label: "Zoom" },
    { id: "none", label: "Static" },
];

/* Tiny line icon per style; stroke inherits the button's text color. */
function StyleIcon({ id }: { id: string }) {
    const p = {
        width: 14, height: 14, viewBox: "0 0 24 24", fill: "none",
        stroke: "currentColor", strokeWidth: 2,
        strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
        "aria-hidden": true,
    };
    switch (id) {
        case "ken-burns":
            return (<svg {...p} className="ic ic-kenburns"><rect x="3" y="5" width="18" height="14" rx="2" /><rect x="8" y="9" width="8" height="6" rx="1" /></svg>);
        case "fade":
            return (<svg {...p} className="ic ic-fade"><circle cx="9" cy="12" r="6" /><circle cx="15" cy="12" r="6" opacity="0.4" /></svg>);
        case "slide":
            return (<svg {...p} className="ic ic-slide"><path d="M4 12h13" /><path d="M12 7l5 5-5 5" /></svg>);
        case "zoom":
            return (<svg {...p} className="ic ic-zoom"><circle cx="11" cy="11" r="6" /><path d="M11 8.5v5M8.5 11h5" /><path d="M20 20l-4.5-4.5" /></svg>);
        case "none":
            return (<svg {...p} className="ic"><rect x="5" y="5" width="14" height="14" rx="3" /></svg>);
        default:
            return null;
    }
}

const bc = typeof window !== "undefined" ? new BroadcastChannel("moments") : null;

function notify(type: string, data?: Record<string, unknown>) {
    bc?.postMessage({ type, ...data });
}

/* ── Celebration — confetti + flying pink hearts, "spreading love" on a good upload ── */

const CONFETTI_COLORS = ["#ff5fa2", "#ffd166", "#06d6a0", "#4dabf7", "#b197fc", "#ff8787", "#ffffff"];
const HEART_COLORS = ["#ff4d97", "#ff7eb6", "#ff9ec7", "#ff5fa2", "#ffb3d1"];

function Celebration() {
    const [show, setShow] = useState(true);
    useEffect(() => {
        const t = setTimeout(() => setShow(false), 3600); // self-unmount after the longest piece finishes
        return () => clearTimeout(t);
    }, []);

    const { confetti, hearts } = useMemo(() => {
        const rnd = (a: number, b: number) => a + Math.random() * (b - a);
        const confetti = Array.from({ length: 70 }, (_, i) => ({
            id: i, left: rnd(0, 100), w: rnd(6, 12), h: rnd(8, 16),
            color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            delay: rnd(0, 0.4), dur: rnd(1.8, 3.2), rot: rnd(0, 360),
        }));
        const hearts = Array.from({ length: 22 }, (_, i) => ({
            id: i, left: rnd(0, 100), size: rnd(16, 40),
            color: HEART_COLORS[i % HEART_COLORS.length],
            delay: rnd(0, 0.7), dur: rnd(2.2, 3.8), drift: rnd(-80, 80),
        }));
        return { confetti, hearts };
    }, []);

    if (!show) return null;
    return (
        <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: 200, pointerEvents: "none", overflow: "hidden" }}>
            {confetti.map(c => (
                <span key={`c${c.id}`} className="confetti" style={{ left: `${c.left}%`, width: c.w, height: c.h, background: c.color, animationDelay: `${c.delay}s`, animationDuration: `${c.dur}s`, ["--rot" as string]: `${c.rot}deg` } as React.CSSProperties} />
            ))}
            {hearts.map(h => (
                <span key={`h${h.id}`} className="heart" style={{ left: `${h.left}%`, animationDelay: `${h.delay}s`, animationDuration: `${h.dur}s`, ["--drift" as string]: `${h.drift}px` } as React.CSSProperties}>
                    <svg viewBox="0 0 24 24" width={h.size} height={h.size} fill={h.color} style={{ display: "block", filter: "drop-shadow(0 2px 5px rgba(255,77,151,0.45))" }}>
                        <path d="M12 21s-7.5-4.9-10-9.2C.6 9 1.7 5.6 4.8 4.9 7 4.4 9 5.7 12 8.3c3-2.6 5-3.9 7.2-3.4 3.1.7 4.2 4.1 2.8 6.9C19.5 16.1 12 21 12 21z" />
                    </svg>
                </span>
            ))}
        </div>
    );
}

/* ── Upload + Preview Page ──────────────────────────────────────────────────── */

export default function UploadPage() {
    const [photos, setPhotos] = useState<string[]>([]);
    const [style, setStyle] = useState("ken-burns");
    const [uploading, setUploading] = useState(false);
    const [toast, setToast] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);
    const [heldIdx, setHeldIdx] = useState<number | null>(null);
    const [hoverIdx, setHoverIdx] = useState<number | null>(null);
    const [selected, setSelected] = useState<number | null>(null);
    const [nowIdx, setNowIdx] = useState(0);
    const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const longPressIdx = useRef<number | null>(null);
    const [burst, setBurst] = useState(0); // bump to fire a fresh confetti + hearts celebration
    const prevCountRef = useRef(0);
    const initRef = useRef(false);
    const holdRef = useRef(0); // mirror the display: linger the "Playing" badge on the newest after an upload

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(""), 2000);
    };

    const loadPhotos = useCallback(async () => {
        try {
            const res = await fetch("/api/images");
            if (res.ok) {
                const data: string[] = await res.json();
                // A new photo just landed (count grew) → linger the badge on the newest for one slide
                if (initRef.current && data.length > prevCountRef.current) holdRef.current = Date.now() + SLIDE_MS;
                prevCountRef.current = data.length;
                initRef.current = true;
                setPhotos(data);
            }
        } catch {}
    }, []);

    const loadStyle = useCallback(async () => {
        try {
            const res = await fetch("/api/style");
            if (res.ok) {
                const data = await res.json();
                setStyle(data.style);
            }
        } catch {}
    }, []);

    const loadSelected = useCallback(async () => {
        try {
            const res = await fetch("/api/select");
            if (res.ok) setSelected((await res.json()).selected);
        } catch {}
    }, []);

    useEffect(() => { loadPhotos(); loadStyle(); loadSelected(); }, [loadPhotos, loadStyle, loadSelected]);

    // SSE — stay in sync with changes made from any other device
    useEffect(() => {
        const es = new EventSource("/api/events");
        es.onmessage = () => { loadPhotos(); loadStyle(); loadSelected(); };
        return () => es.close();
    }, [loadPhotos, loadStyle, loadSelected]);

    // Track the wall-clock slide so the grid can flag what's on screen during auto-advance
    useEffect(() => {
        if (photos.length === 0) return;
        const tick = () => setNowIdx(Date.now() < holdRef.current ? 0 : Math.floor(Date.now() / SLIDE_MS) % photos.length);
        tick();
        const t = setInterval(tick, 1000);
        return () => clearInterval(t);
    }, [photos.length]);

    const playingIdx = selected != null ? Math.min(selected, photos.length - 1) : nowIdx;

    // Tap a photo to pin the slideshow to it (tap again to resume auto-advance)
    const selectPhoto = useCallback(async (index: number) => {
        const next = selected === index ? null : index;
        setSelected(next);
        showToast(next === null ? "Resumed auto-play" : "Playing this photo");
        await fetch("/api/select", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ index }),
        });
        notify("refresh");
    }, [selected]);

    // Upload files
    const uploadFiles = useCallback(async (files: FileList | File[]) => {
        const imageFiles = Array.from(files).filter(f => f.type.startsWith("image/"));
        if (!imageFiles.length) return;
        setUploading(true);
        showToast(`Uploading ${imageFiles.length} photo(s)...`);

        let ok = 0;
        for (const file of imageFiles) {
            const form = new FormData();
            form.append("file", file);
            try {
                const res = await fetch("/api/upload", { method: "POST", body: form });
                if (res.ok) ok++;
            } catch {}
        }

        setUploading(false);
        if (ok > 0) {
            showToast(`Done! ${ok} added`);
            setBurst(b => b + 1); // spread the love
        } else {
            showToast("Upload failed");
        }
        loadPhotos();
        notify("photos-changed");
    }, [loadPhotos]);

    // Delete
    const deletePhoto = useCallback(async (index: number) => {
        setHeldIdx(null);
        showToast("Removing...");
        await fetch("/api/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ index }),
        });
        showToast("Removed");
        loadPhotos();
        notify("photos-changed");
    }, [loadPhotos]);

    // Rotate 90° clockwise (re-encodes to a new file, so the preview refreshes instantly)
    const rotatePhoto = useCallback(async (index: number) => {
        showToast("Rotating...");
        await fetch("/api/rotate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ index }),
        });
        showToast("Rotated");
        loadPhotos();
        notify("photos-changed");
    }, [loadPhotos]);

    // Change style
    const changeStyle = useCallback(async (s: string) => {
        setStyle(s);
        await fetch("/api/style", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ style: s }),
        });
        notify("style-changed", { style: s });
        showToast(`Style: ${STYLES.find(x => x.id === s)?.label}`);
    }, []);

    // Drag & drop
    const [dragging, setDragging] = useState(false);
    const dragCounter = useRef(0);
    useEffect(() => {
        const onEnter = (e: DragEvent) => { e.preventDefault(); dragCounter.current++; setDragging(true); };
        const onLeave = (e: DragEvent) => { e.preventDefault(); dragCounter.current--; if (dragCounter.current <= 0) { dragCounter.current = 0; setDragging(false); } };
        const onOver = (e: DragEvent) => e.preventDefault();
        const onDrop = (e: DragEvent) => { e.preventDefault(); dragCounter.current = 0; setDragging(false); if (e.dataTransfer?.files.length) uploadFiles(e.dataTransfer.files); };
        document.addEventListener("dragenter", onEnter);
        document.addEventListener("dragleave", onLeave);
        document.addEventListener("dragover", onOver);
        document.addEventListener("drop", onDrop);
        return () => { document.removeEventListener("dragenter", onEnter); document.removeEventListener("dragleave", onLeave); document.removeEventListener("dragover", onOver); document.removeEventListener("drop", onDrop); };
    }, [uploadFiles]);

    // Tap plays the photo; long-press (touch) reveals the delete/rotate controls.
    const onTouchStart = (i: number) => {
        longPressIdx.current = null;
        holdTimer.current = setTimeout(() => { longPressIdx.current = i; setHeldIdx(prev => (prev === i ? null : i)); }, 500);
    };
    const onTouchEnd = () => { if (holdTimer.current) clearTimeout(holdTimer.current); };
    const onPhotoClick = (i: number) => {
        // Swallow the click a long-press release fires on the same photo.
        if (longPressIdx.current === i) { longPressIdx.current = null; return; }
        selectPhoto(i);
    };

    return (
        <div style={{ minHeight: "100vh", background: "#111", color: "#fff", fontFamily: "-apple-system, sans-serif" }}>
            {/* Toast */}
            {toast && (
                <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: "#333", color: "#fff", padding: "10px 20px", borderRadius: 10, fontSize: 14, zIndex: 100 }}>
                    {uploading && <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid #666", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.6s linear infinite", marginRight: 8, verticalAlign: "middle" }} />}
                    {toast}
                </div>
            )}

            {/* Confetti + flying pink hearts — remounts each upload via the key */}
            {burst > 0 && <Celebration key={burst} />}

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                .seg { transition: background .2s ease, color .2s ease; }
                .seg .ic { transition: opacity .25s ease, transform .25s ease; opacity: .7; }
                .seg:hover .ic { opacity: 1; }
                .seg:hover { color: #fff; }
                .seg:hover .ic-kenburns { animation: icKB 2.4s ease-in-out infinite; }
                .seg:hover .ic-fade { animation: icFD 1.4s ease-in-out infinite; }
                .seg:hover .ic-slide { animation: icSL 1s ease-in-out infinite; }
                .seg:hover .ic-zoom { animation: icZM 1.3s ease-in-out infinite; }
                .seg-active { animation: segPulse .42s ease; }
                @keyframes segPulse { 0%{box-shadow:inset 0 0 0 0 rgba(255,255,255,0)} 35%{box-shadow:inset 0 0 0 2px rgba(255,255,255,0.6)} 100%{box-shadow:inset 0 0 0 0 rgba(255,255,255,0)} }
                @keyframes icKB { 0%,100%{transform:scale(1)} 50%{transform:scale(1.22) rotate(-3deg)} }
                @keyframes icFD { 0%,100%{opacity:1} 50%{opacity:.15} }
                @keyframes icSL { 0%,100%{transform:translateX(-2px)} 50%{transform:translateX(3px)} }
                @keyframes icZM { 0%,100%{transform:scale(.78)} 50%{transform:scale(1.2)} }
                .add-btn { transition: box-shadow .2s ease, transform .2s ease; }
                .add-btn:hover { transform: translateY(-1px); box-shadow: 0 0 0 1px rgba(255,255,255,0.55), 0 4px 16px rgba(0,0,0,0.35); }
                @keyframes photoIn { from { opacity:0; transform:scale(0.9); } to { opacity:1; transform:scale(1); } }
                .photo-in { animation: photoIn .5s ease both; }
                /* interaction feedback */
                .seg:active { transform: scale(0.95); }
                .add-btn:active { transform: scale(0.95); }
                .add-btn.busy { animation: busyPulse 1s ease-in-out infinite; }
                @keyframes busyPulse { 0%,100%{box-shadow:0 0 0 0 rgba(255,255,255,0)} 50%{box-shadow:0 0 0 3px rgba(255,255,255,0.3)} }
                .photo-cell { transition: transform .12s ease; cursor: pointer; }
                .photo-cell:active { transform: scale(0.97); }
                .photo-cell.held { box-shadow: inset 0 0 0 3px rgba(255,255,255,0.92); }
                .photo-cell.playing { box-shadow: inset 0 0 0 3px #22e07a, 0 0 16px rgba(34,224,122,0.45); }
                .now-playing { position:absolute; bottom:5px; left:5px; display:inline-flex; align-items:center; gap:5px; padding:3px 8px 3px 6px; border-radius:999px; background:rgba(34,224,122,0.92); color:#06351c; font-size:10px; font-weight:700; letter-spacing:.02em; pointer-events:none; box-shadow:0 1px 6px rgba(0,0,0,0.35); }
                .np-bars { display:inline-flex; align-items:flex-end; gap:2px; height:11px; }
                .np-bars i { width:2.5px; background:#06351c; border-radius:1px; height:4px; animation:eq .9s ease-in-out infinite; }
                .np-bars i:nth-child(2){ animation-delay:.18s }
                .np-bars i:nth-child(3){ animation-delay:.36s }
                @keyframes eq { 0%,100%{height:3px} 50%{height:11px} }
                .icon-btn { transition: transform .12s ease; }
                .icon-btn:hover { transform: scale(1.12); }
                .icon-btn:active { transform: scale(0.86); }
                .seg:focus-visible, .add-btn:focus-visible, .photo-cell:focus-visible, .icon-btn:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
                /* celebration: confetti rains down, pink hearts float up */
                .confetti { position:absolute; top:-24px; border-radius:2px; opacity:0; animation-name:confettiFall; animation-timing-function:ease-in; animation-fill-mode:forwards; }
                @keyframes confettiFall { 0%{ transform:translateY(-10px) rotate(var(--rot,0deg)); opacity:1; } 100%{ transform:translateY(105vh) rotate(calc(var(--rot,0deg) + 720deg)); opacity:0; } }
                .heart { position:absolute; bottom:-48px; opacity:0; will-change:transform,opacity; animation-name:heartFloat; animation-timing-function:ease-out; animation-fill-mode:forwards; }
                @keyframes heartFloat { 0%{ transform:translateY(0) translateX(0) scale(.5); opacity:0; } 12%{ opacity:1; } 100%{ transform:translateY(-112vh) translateX(var(--drift,0)) scale(1.15); opacity:0; } }
            `}</style>

            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px" }}>
                <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Moments</h1>
                <span style={{ color: "#666", fontSize: 13 }}>{photos.length} photos</span>
            </div>

            {/* One responsive page: live preview + controls, side-by-side on wide screens */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, padding: "8px 16px 24px", alignItems: "flex-start" }}>

                {/* Live preview — reflects style changes instantly via BroadcastChannel */}
                <div style={{ flex: "1 1 340px", minWidth: 0, position: "sticky", top: 12 }}>
                    <div style={{
                        position: "relative", width: "100%", aspectRatio: "16/10",
                        background: "#000", borderRadius: 12, overflow: "hidden",
                        border: "3px solid #333",
                    }}>
                        <iframe src="/" style={{ width: "100%", height: "100%", border: "none" }} />
                    </div>
                    <p style={{ textAlign: "center", color: "#555", fontSize: 11, marginTop: 8 }}>
                        Live preview — updates the moment you change the style
                    </p>
                </div>

                {/* Controls */}
                <div style={{ flex: "1 1 340px", minWidth: 0 }}>
                    {/* Modes as a joined segmented control + white Add Photos chip */}
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 6 }}>
                        <div style={{ display: "inline-flex", maxWidth: "100%", overflowX: "auto", overflowY: "hidden", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.04)" }}>
                            {STYLES.map((s, i) => {
                                const on = style === s.id;
                                return (
                                    <button
                                        key={s.id}
                                        onClick={() => changeStyle(s.id)}
                                        className={`seg${on ? " seg-active" : ""}`}
                                        aria-pressed={on}
                                        style={{
                                            display: "inline-flex", alignItems: "center", gap: 6,
                                            padding: "7px 13px", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap",
                                            border: "none",
                                            borderLeft: i === 0 ? "none" : "1px solid rgba(255,255,255,0.1)",
                                            background: on ? "rgba(255,255,255,0.16)" : "transparent",
                                            color: on ? "#fff" : "#9a9a9a",
                                            fontWeight: on ? 600 : 400,
                                        }}
                                    >
                                        <StyleIcon id={s.id} />
                                        {s.label}
                                    </button>
                                );
                            })}
                        </div>
                        <button
                            onClick={() => inputRef.current?.click()}
                            className={`add-btn${uploading ? " busy" : ""}`}
                            style={{
                                marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4,
                                padding: "7px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
                                border: "1px solid rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.1)", color: "#fff", whiteSpace: "nowrap",
                            }}
                        >
                            + Add Photos
                        </button>
                        <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={e => { if (e.target.files) uploadFiles(e.target.files); e.target.value = ""; }} />
                    </div>
                    <p style={{ color: "#555", fontSize: 11, margin: "0 0 12px" }}>
                        or drag &amp; drop photos anywhere
                    </p>

                    {/* Photo grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
                        {photos.map((src, i) => {
                            const playing = i === playingIdx;
                            const showControls = heldIdx === i || hoverIdx === i;
                            return (
                            <div
                                key={src}
                                className={`photo-in photo-cell${heldIdx === i ? " held" : ""}${playing ? " playing" : ""}`}
                                style={{ position: "relative", aspectRatio: "1", overflow: "hidden", borderRadius: 8 }}
                                onTouchStart={() => onTouchStart(i)}
                                onTouchEnd={onTouchEnd}
                                onTouchMove={onTouchEnd}
                                onMouseEnter={() => setHoverIdx(i)}
                                onMouseLeave={() => setHoverIdx(prev => (prev === i ? null : prev))}
                                onClick={() => onPhotoClick(i)}
                            >
                                <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                                {playing && (
                                    <div className="now-playing" aria-label="Now playing">
                                        <span className="np-bars"><i /><i /><i /></span>
                                        Playing
                                    </div>
                                )}
                                {showControls && (
                                    <>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); rotatePhoto(i); }}
                                            aria-label="Rotate"
                                            className="icon-btn"
                                            style={{
                                                position: "absolute", top: 4, left: 4,
                                                width: 28, height: 28, borderRadius: "50%",
                                                background: "rgba(0,0,0,0.6)", color: "#fff",
                                                border: "none", fontSize: 15, cursor: "pointer",
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                            }}
                                        >
                                            ⟳
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); deletePhoto(i); }}
                                            className="icon-btn"
                                            style={{
                                                position: "absolute", top: 4, right: 4,
                                                width: 28, height: 28, borderRadius: "50%",
                                                background: "rgba(255,0,0,0.9)", color: "#fff",
                                                border: "none", fontSize: 16, cursor: "pointer",
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                            }}
                                        >
                                            ×
                                        </button>
                                    </>
                                )}
                            </div>
                            );
                        })}
                    </div>

                    {photos.length === 0 && !dragging && (
                        <div style={{ textAlign: "center", padding: "40px 20px", color: "#555", fontSize: 14 }}>
                            Drop photos or tap + Add Photos
                        </div>
                    )}
                </div>
            </div>

            {/* Drag overlay */}
            {dragging && (
                <div style={{
                    position: "fixed", inset: 0, zIndex: 99,
                    background: "rgba(0,122,255,0.1)", backdropFilter: "blur(4px)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                    <div style={{ fontSize: 20, color: "#4da3ff", fontWeight: 600 }}>Drop photos here</div>
                </div>
            )}
        </div>
    );
}
