"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const SLIDE_MS = 10000; // every screen derives its slide from wall-clock time → stays in sync

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

    // Advance slideshow — index derived from wall-clock so every screen shows the same photo
    useEffect(() => {
        if (urls.length < 2) return;
        const tick = () => {
            const next = Math.floor(Date.now() / SLIDE_MS) % urls.length;
            setIdx(prev => {
                if (next === prev) return prev;
                setPrevIdx(prev);
                kbRef.current++;
                preload(urls[(next + 1) % urls.length]); // preload the one after next
                return next;
            });
        };
        tick(); // snap to the shared position immediately on load
        const timer = setInterval(tick, 1000);
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
            <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#444", fontFamily: "-apple-system, sans-serif", fontSize: "1.3vw", gap: "2vh" }}>
                <div style={{ fontSize: "2.6vw" }}>Moments</div>
                <div style={{ fontSize: "0.9vw" }}>Open <code>/upload</code> to add photos</div>
                {lan && (
                    <div style={{ marginTop: "2vh", display: "flex", flexDirection: "column", alignItems: "center", gap: "1vh" }}>
                        <img src={lan.qr} alt="Scan to add photos" style={{ width: "9.5vw", height: "9.5vw", background: "#fff", padding: "0.5vw", borderRadius: "0.7vw" }} />
                        <div style={{ fontSize: "0.75vw", color: "#666" }}>Scan to add photos</div>
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
                .slide { position:absolute;top:0;left:0;width:100vw;height:100vh;overflow:hidden;opacity:0;will-change:transform,opacity; }
                .slide .bg { position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:blur(45px) saturate(1.8) brightness(0.82);transform:scale(1.25); }
                .slide .fg { position:absolute;inset:0;width:100%;height:100%;object-fit:contain; }
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
                {/* Each slide: blurred cover backdrop + full (contain) photo, so portraits fit by height */}
                {prevIdx >= 0 && prevIdx !== idx && (
                    <div key={`prev-${prevIdx}`} className={`slide ${getTransitionClass(false, true)}`}>
                        <img src={urls[prevIdx]} alt="" className="bg" />
                        <img src={urls[prevIdx]} alt="" className="fg" />
                    </div>
                )}
                <div key={`cur-${idx}`} className={`slide ${getTransitionClass(true, false)}`}>
                    <img src={urls[idx]} alt="" className="bg" />
                    <img src={urls[idx]} alt="" className="fg" />
                </div>

                {/* Clock (viewport-relative so the preview scales faithfully) */}
                <div style={{ position: "fixed", bottom: "1.8vh", left: "1.6vw", color: "rgba(255,255,255,0.5)", fontSize: "2.6vw", fontWeight: 200, fontFamily: "-apple-system, sans-serif", zIndex: 10 }}>
                    {time}
                </div>

                {/* Scan-to-add QR badge */}
                {lan && (
                    <div style={{ position: "fixed", bottom: "1.8vh", right: "1.3vw", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.4vh", zIndex: 10 }}>
                        <img src={lan.qr} alt="Scan to add photos" style={{ width: "4.4vw", height: "4.4vw", background: "#fff", padding: "0.3vw", borderRadius: "0.5vw", opacity: 0.92 }} />
                        <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.6vw", fontWeight: 500 }}>Scan to add</div>
                    </div>
                )}
            </div>
        </>
    );
}
