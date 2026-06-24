"use client";

import { useEffect, useState, useRef, useCallback } from "react";

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

function notify(type: string, data?: any) {
    bc?.postMessage({ type, ...data });
}

/* ── Upload + Preview Page ──────────────────────────────────────────────────── */

export default function UploadPage() {
    const [photos, setPhotos] = useState<string[]>([]);
    const [style, setStyle] = useState("ken-burns");
    const [uploading, setUploading] = useState(false);
    const [toast, setToast] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);
    const [heldIdx, setHeldIdx] = useState<number | null>(null);
    const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const longPressIdx = useRef<number | null>(null);

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(""), 2000);
    };

    const loadPhotos = useCallback(async () => {
        try {
            const res = await fetch("/api/images");
            if (res.ok) setPhotos(await res.json());
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

    useEffect(() => { loadPhotos(); loadStyle(); }, [loadPhotos, loadStyle]);

    // SSE — stay in sync with changes made from any other device
    useEffect(() => {
        const es = new EventSource("/api/events");
        es.onmessage = () => { loadPhotos(); loadStyle(); };
        return () => es.close();
    }, [loadPhotos, loadStyle]);

    // Upload files
    const uploadFiles = useCallback(async (files: FileList | File[]) => {
        const imageFiles = Array.from(files).filter(f => f.type.startsWith("image/"));
        if (!imageFiles.length) return;
        setUploading(true);
        showToast(`Uploading ${imageFiles.length} photo(s)...`);

        for (const file of imageFiles) {
            const form = new FormData();
            form.append("file", file);
            await fetch("/api/upload", { method: "POST", body: form });
        }

        setUploading(false);
        showToast(`Done! ${imageFiles.length} added`);
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
        document.body.dataset.dragReady = "1";
        return () => { document.removeEventListener("dragenter", onEnter); document.removeEventListener("dragleave", onLeave); document.removeEventListener("dragover", onOver); document.removeEventListener("drop", onDrop); delete document.body.dataset.dragReady; };
    }, [uploadFiles]);

    // Tap/click toggles the delete button; long-press also reveals it on touch.
    const onTouchStart = (i: number) => {
        longPressIdx.current = null;
        holdTimer.current = setTimeout(() => { longPressIdx.current = i; setHeldIdx(i); }, 500);
    };
    const onTouchEnd = () => { if (holdTimer.current) clearTimeout(holdTimer.current); };
    const toggleHeld = (i: number) => {
        // Swallow the click a long-press release fires on the same photo.
        if (longPressIdx.current === i) { longPressIdx.current = null; return; }
        setHeldIdx(prev => (prev === i ? null : i));
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
            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                .style-btn { transition: box-shadow .2s ease, transform .2s ease; }
                .style-btn:hover { transform: translateY(-1px); box-shadow: 0 3px 14px rgba(0,122,255,0.28); }
                .style-btn .ic { transition: opacity .25s ease, transform .25s ease; opacity: .7; }
                .style-btn:hover .ic { opacity: 1; }
                .style-btn:hover .ic-kenburns { animation: icKB 2.4s ease-in-out infinite; }
                .style-btn:hover .ic-fade { animation: icFD 1.4s ease-in-out infinite; }
                .style-btn:hover .ic-slide { animation: icSL 1s ease-in-out infinite; }
                .style-btn:hover .ic-zoom { animation: icZM 1.3s ease-in-out infinite; }
                @keyframes icKB { 0%,100%{transform:scale(1)} 50%{transform:scale(1.22) rotate(-3deg)} }
                @keyframes icFD { 0%,100%{opacity:1} 50%{opacity:.15} }
                @keyframes icSL { 0%,100%{transform:translateX(-2px)} 50%{transform:translateX(3px)} }
                @keyframes icZM { 0%,100%{transform:scale(.78)} 50%{transform:scale(1.2)} }
                .add-btn { transition: box-shadow .2s ease, transform .2s ease; }
                .add-btn:hover { transform: translateY(-1px); box-shadow: 0 0 0 1px rgba(0,122,255,0.5), 0 4px 16px rgba(0,122,255,0.15); }
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
                    {/* Modes + a small Add Photos chip pushed to the top-right */}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 6 }}>
                        {STYLES.map(s => (
                            <button
                                key={s.id}
                                onClick={() => changeStyle(s.id)}
                                className="style-btn"
                                style={{
                                    display: "inline-flex", alignItems: "center", gap: 6,
                                    padding: "6px 14px", borderRadius: 20, fontSize: 12, cursor: "pointer",
                                    border: "1px solid", whiteSpace: "nowrap",
                                    borderColor: style === s.id ? "#007aff" : "rgba(255,255,255,0.15)",
                                    background: style === s.id ? "rgba(0,122,255,0.15)" : "rgba(255,255,255,0.04)",
                                    color: style === s.id ? "#4da3ff" : "#999",
                                    fontWeight: style === s.id ? 600 : 400,
                                }}
                            >
                                <StyleIcon id={s.id} />
                                {s.label}
                            </button>
                        ))}
                        <button
                            onClick={() => inputRef.current?.click()}
                            className="add-btn"
                            style={{
                                marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4,
                                padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
                                border: "1px solid #007aff", background: "rgba(0,122,255,0.18)", color: "#4da3ff", whiteSpace: "nowrap",
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
                        {photos.map((src, i) => (
                            <div
                                key={src}
                                style={{ position: "relative", aspectRatio: "1", overflow: "hidden", borderRadius: 8 }}
                                onTouchStart={() => onTouchStart(i)}
                                onTouchEnd={onTouchEnd}
                                onTouchMove={onTouchEnd}
                                onClick={() => toggleHeld(i)}
                            >
                                <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                                {heldIdx === i && (
                                    <>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); rotatePhoto(i); }}
                                            aria-label="Rotate"
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
                        ))}
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
