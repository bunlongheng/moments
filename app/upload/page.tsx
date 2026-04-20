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

const bc = typeof window !== "undefined" ? new BroadcastChannel("moments") : null;

function notify(type: string, data?: any) {
    bc?.postMessage({ type, ...data });
}

/* ── Upload + Preview Page ──────────────────────────────────────────────────── */

export default function UploadPage() {
    const [tab, setTab] = useState<"upload" | "preview">("upload");
    const [photos, setPhotos] = useState<string[]>([]);
    const [style, setStyle] = useState("ken-burns");
    const [uploading, setUploading] = useState(false);
    const [toast, setToast] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);
    const [heldIdx, setHeldIdx] = useState<number | null>(null);
    const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    // Long press for delete on mobile
    const onTouchStart = (i: number) => {
        holdTimer.current = setTimeout(() => setHeldIdx(i), 500);
    };
    const onTouchEnd = () => { if (holdTimer.current) clearTimeout(holdTimer.current); };

    return (
        <div style={{ minHeight: "100vh", background: "#111", color: "#fff", fontFamily: "-apple-system, sans-serif" }}>
            {/* Toast */}
            {toast && (
                <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: "#333", color: "#fff", padding: "10px 20px", borderRadius: 10, fontSize: 14, zIndex: 100 }}>
                    {uploading && <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid #666", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.6s linear infinite", marginRight: 8, verticalAlign: "middle" }} />}
                    {toast}
                </div>
            )}
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px" }}>
                <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Moments</h1>
                <span style={{ color: "#666", fontSize: 13 }}>{photos.length} photos</span>
            </div>

            {/* Tab toggle */}
            <div style={{ display: "flex", padding: "0 16px", marginBottom: 8 }}>
                {(["upload", "preview"] as const).map(t => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        style={{
                            flex: 1, padding: "10px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                            border: "1px solid", borderRadius: t === "upload" ? "8px 0 0 8px" : "0 8px 8px 0",
                            borderColor: tab === t ? "#007aff" : "rgba(255,255,255,0.15)",
                            background: tab === t ? "rgba(0,122,255,0.15)" : "rgba(255,255,255,0.04)",
                            color: tab === t ? "#4da3ff" : "#999",
                            textTransform: "capitalize",
                        }}
                    >
                        {t}
                    </button>
                ))}
            </div>

            {/* ── Upload View ───────────────────────────────────────────── */}
            {tab === "upload" && (
                <>
                    {/* Style picker */}
                    <div style={{ display: "flex", gap: 6, padding: "6px 16px", overflowX: "auto" }}>
                        {STYLES.map(s => (
                            <button
                                key={s.id}
                                onClick={() => changeStyle(s.id)}
                                style={{
                                    padding: "6px 14px", borderRadius: 20, fontSize: 12, cursor: "pointer",
                                    border: "1px solid", whiteSpace: "nowrap",
                                    borderColor: style === s.id ? "#007aff" : "rgba(255,255,255,0.15)",
                                    background: style === s.id ? "rgba(0,122,255,0.15)" : "rgba(255,255,255,0.04)",
                                    color: style === s.id ? "#4da3ff" : "#999",
                                    fontWeight: style === s.id ? 600 : 400,
                                }}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>

                    {/* Add button */}
                    <div style={{ padding: "12px 16px" }}>
                        <button
                            onClick={() => inputRef.current?.click()}
                            style={{
                                width: "100%", padding: "14px", borderRadius: 12, fontSize: 15, fontWeight: 600,
                                border: "2px dashed rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.04)",
                                color: "#888", cursor: "pointer",
                            }}
                        >
                            + Add Photos
                        </button>
                        <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={e => { if (e.target.files) uploadFiles(e.target.files); e.target.value = ""; }} />
                    </div>

                    {/* Photo grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2, padding: "0 2px" }}>
                        {photos.map((src, i) => (
                            <div
                                key={src}
                                style={{ position: "relative", aspectRatio: "1", overflow: "hidden" }}
                                onTouchStart={() => onTouchStart(i)}
                                onTouchEnd={onTouchEnd}
                                onTouchMove={onTouchEnd}
                                onClick={() => { if (heldIdx !== null && heldIdx !== i) setHeldIdx(null); }}
                            >
                                <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                                {heldIdx === i && (
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
                                )}
                            </div>
                        ))}
                    </div>

                    {photos.length === 0 && !dragging && (
                        <div style={{ textAlign: "center", padding: "60px 20px", color: "#555", fontSize: 14 }}>
                            Drop photos or tap + Add Photos
                        </div>
                    )}
                </>
            )}

            {/* ── Preview View ──────────────────────────────────────────── */}
            {tab === "preview" && (
                <div style={{ padding: 16 }}>
                    <div style={{
                        position: "relative", width: "100%", aspectRatio: "16/10",
                        background: "#000", borderRadius: 12, overflow: "hidden",
                        border: "3px solid #333",
                    }}>
                        <iframe src="/" style={{ width: "100%", height: "100%", border: "none" }} />
                    </div>
                    <p style={{ textAlign: "center", color: "#555", fontSize: 11, marginTop: 8 }}>
                        Live preview — exactly what the display shows
                    </p>
                </div>
            )}

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
