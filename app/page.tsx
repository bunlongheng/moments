"use client";

import { useEffect, useRef, useState, useCallback } from "react";

/* ── Display View — Fullscreen Slideshow ────────────────────────────────────── */

export default function DisplayPage() {
    const [urls, setUrls] = useState<string[]>([]);
    const [style, setStyle] = useState("ken-burns");
    const [idx, setIdx] = useState(0);
    const [prevIdx, setPrevIdx] = useState(-1);
    const kbRef = useRef(0);
    const preloadedRef = useRef<Set<string>>(new Set());

    // Preload an image into browser cache
    const preload = useCallback((url: string) => {
        if (preloadedRef.current.has(url)) return;
        const img = new Image();
        img.src = url;
        preloadedRef.current.add(url);
    }, []);

    // Fetch images + style
    const refresh = useCallback(async () => {
        try {
            const [imgRes, styleRes] = await Promise.all([
                fetch("/api/images"),
                fetch("/api/style"),
            ]);
            if (imgRes.ok) {
                const data = await imgRes.json();
                setUrls(data);
                data.forEach(preload); // preload all
            }
            if (styleRes.ok) {
                const data = await styleRes.json();
                setStyle(data.style);
            }
        } catch {}
    }, [preload]);

    // Initial load
    useEffect(() => { refresh(); }, [refresh]);

    // Poll every 10s for changes
    useEffect(() => {
        const timer = setInterval(refresh, 10000);
        return () => clearInterval(timer);
    }, [refresh]);

    // BroadcastChannel — instant updates from upload tab (same browser)
    useEffect(() => {
        const bc = new BroadcastChannel("moments");
        bc.onmessage = (e) => {
            if (e.data?.type === "photos-changed" || e.data?.type === "refresh") refresh();
            if (e.data?.type === "style-changed") setStyle(e.data.style);
        };
        return () => bc.close();
    }, [refresh]);

    // SSE — instant updates from any device on the network
    useEffect(() => {
        const es = new EventSource("/api/events");
        es.onmessage = () => refresh();
        return () => es.close();
    }, [refresh]);

    // Advance slideshow
    useEffect(() => {
        if (urls.length < 2) return;
        const timer = setInterval(() => {
            setIdx(prev => {
                setPrevIdx(prev);
                kbRef.current++;
                const next = (prev + 1) % urls.length;
                // Preload the one after next
                const afterNext = (next + 1) % urls.length;
                preload(urls[afterNext]);
                return next;
            });
        }, 10000);
        return () => clearInterval(timer);
    }, [urls, preload]);

    // LAN QR (scan to open the upload page from a phone)
    const [lan, setLan] = useState<{ url: string; qr: string } | null>(null);
    useEffect(() => {
        fetch("/api/lan").then(r => (r.ok ? r.json() : null)).then(d => d && setLan(d)).catch(() => {});
    }, []);

    // Clock
    const [time, setTime] = useState("");
    useEffect(() => {
        const tick = () => setTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
        tick();
        const t = setInterval(tick, 1000);
        return () => clearInterval(t);
    }, []);

    if (urls.length === 0) {
        return (
            <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#444", fontFamily: "-apple-system, sans-serif", fontSize: 24, gap: 20 }}>
                <div style={{ fontSize: 48 }}>Moments</div>
                <div style={{ fontSize: 16 }}>Open <code>/upload</code> to add photos</div>
                {lan && (
                    <div style={{ marginTop: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                        <img src={lan.qr} alt="Scan to add photos" width={180} height={180} style={{ background: "#fff", padding: 10, borderRadius: 14 }} />
                        <div style={{ fontSize: 14, color: "#666" }}>Scan to add photos</div>
                    </div>
                )}
            </div>
        );
    }

    const kbClass = `kb-${kbRef.current % 4}`;
    const getTransitionClass = (isActive: boolean, isLeaving: boolean) => {
        if (isLeaving) return "leaving";
        if (!isActive) return "";
        switch (style) {
            case "ken-burns": return `active ${kbClass}`;
            case "slide": return "active slide-in";
            case "zoom": return "active zoom-in";
            case "none": return "active no-anim";
            default: return "active"; // fade
        }
    };

    return (
        <>
            <style>{`
                .slide { position:absolute;top:0;left:0;width:100vw;height:100vh;object-fit:cover;opacity:0;will-change:transform,opacity; }
                .slide.active { opacity:1;transition:opacity 1.5s ease; }
                .slide.no-anim { opacity:1;transition:none; }
                .slide.leaving { opacity:0;transition:opacity 2s ease;filter:blur(20px);transform:scale(1.1); }
                .kb-0 { animation:kb0 12s ease-in-out forwards; }
                .kb-1 { animation:kb1 12s ease-in-out forwards; }
                .kb-2 { animation:kb2 12s ease-in-out forwards; }
                .kb-3 { animation:kb3 12s ease-in-out forwards; }
                @keyframes kb0 { 0%{transform:scale(1) translate(0,0)} 100%{transform:scale(1.15) translate(-3%,-2%)} }
                @keyframes kb1 { 0%{transform:scale(1.15) translate(-3%,2%)} 100%{transform:scale(1) translate(0,0)} }
                @keyframes kb2 { 0%{transform:scale(1) translate(2%,0)} 100%{transform:scale(1.12) translate(-2%,3%)} }
                @keyframes kb3 { 0%{transform:scale(1.1) translate(0,-2%)} 100%{transform:scale(1) translate(2%,1%)} }
                .slide-in { animation:slideIn 1.2s ease-out forwards; }
                @keyframes slideIn { 0%{transform:translateX(100%);opacity:0} 100%{transform:translateX(0);opacity:1} }
                .zoom-in { animation:zoomIn 1.5s ease-out forwards; }
                @keyframes zoomIn { 0%{transform:scale(0.6);opacity:0} 100%{transform:scale(1);opacity:1} }
            `}</style>
            <div style={{ width: "100vw", height: "100vh", overflow: "hidden", position: "relative", background: "#000" }}>
                {/* Show current and previous (for crossfade) */}
                {prevIdx >= 0 && prevIdx !== idx && (
                    <img key={`prev-${prevIdx}`} src={urls[prevIdx]} alt="" className={`slide ${getTransitionClass(false, true)}`} />
                )}
                <img key={`cur-${idx}`} src={urls[idx]} alt="" className={`slide ${getTransitionClass(true, false)}`} />

                {/* Clock */}
                <div style={{ position: "fixed", bottom: 20, left: 30, color: "rgba(255,255,255,0.5)", fontSize: 48, fontWeight: 200, fontFamily: "-apple-system, sans-serif", zIndex: 10 }}>
                    {time}
                </div>

                {/* Scan-to-add QR badge */}
                {lan && (
                    <div style={{ position: "fixed", bottom: 20, right: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, zIndex: 10 }}>
                        <img src={lan.qr} alt="Scan to add photos" width={84} height={84} style={{ background: "#fff", padding: 6, borderRadius: 10, opacity: 0.92 }} />
                        <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 500 }}>Scan to add</div>
                    </div>
                )}
            </div>
        </>
    );
}
