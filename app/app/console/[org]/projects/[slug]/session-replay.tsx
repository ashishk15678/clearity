"use client";

/**
 * SessionReplay
 * ─────────────
 * Plays back a session recording from the chunked frame stream stored in
 * session_recording_chunk rows. Each chunk is a JSON array of frames that were
 * captured by clarity.js.  Supported frame types:
 *   snapshot   – full structural DOM snapshot (our lightweight tree format)
 *   mouse      – { x, y }  (viewport px)
 *   click      – { x, y, target }
 *   scroll     – { x, y }
 *   resize     – { w, h }
 *   input      – masked
 *   nav        – SPA navigation
 *   custom     – custom event name
 *
 * All frames carry { type, ts, d } where ts is ms-since-page-load.
 *
 * Replay strategy:
 *   - Render the DOM snapshot as an iframe srcDoc (safe sandbox)
 *   - Overlay a canvas for mouse trail + click bursts
 *   - Scrub via a timeline slider; play / pause at 1× / 2× / 4×
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { cn } from "@/lib/cn";

// ─── Types ────────────────────────────────────────────────────────────────────

type FrameType =
  | "snapshot"
  | "mouse"
  | "click"
  | "scroll"
  | "resize"
  | "input"
  | "nav"
  | "custom";

interface Frame {
  type: FrameType;
  ts: number; // ms since page load
  d: unknown;
}

interface SnapshotNode {
  t: string; // tag or "text"
  v?: string; // text content
  a?: Record<string, string>; // attrs
  c?: SnapshotNode[]; // children
}

// ─── Reconstruct HTML from snapshot tree ─────────────────────────────────────

function nodeToHtml(node: SnapshotNode): string {
  if (node.t === "text") return escapeHtml(node.v ?? "");
  const VOID = new Set([
    "area","base","br","col","embed","hr","img","input",
    "link","meta","param","source","track","wbr",
  ]);
  const tag = node.t;
  const attrs = Object.entries(node.a ?? {})
    .map(([k, v]) => `${k}="${escapeAttr(v)}"`)
    .join(" ");
  const open = attrs ? `<${tag} ${attrs}>` : `<${tag}>`;
  if (VOID.has(tag)) return open;
  const children = (node.c ?? []).map(nodeToHtml).join("");
  return `${open}${children}</${tag}>`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function escapeAttr(s: string) {
  return s.replace(/"/g, "&quot;").replace(/&/g, "&amp;");
}

function snapshotToSrcDoc(snap: SnapshotNode | null): string {
  if (!snap) return "<html><body><p style='font-family:sans-serif;padding:2rem;color:#888'>No DOM snapshot in this session.</p></body></html>";
  // snap is the <html> node
  const inner = nodeToHtml(snap);
  // Inject base styles to reset pointer-events so the overlay canvas works
  return `<!DOCTYPE html>${inner}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SessionReplay({ sessionId }: { sessionId: string }) {
  const trpc = useTRPC();
  const { data: session, isPending } = useQuery(
    trpc.sessions.byId.queryOptions({ id: sessionId }),
  );

  // Flatten all chunks into a single sorted frame array
  const frames = useRef<Frame[]>([]);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [currentTs, setCurrentTs] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [activeView, setActiveView] = useState<"replay" | "heatmap">("replay");
  const [eventLog, setEventLog] = useState<string[]>([]);

  // DOM refs
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const heatCanvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastRealTs = useRef<number>(0);
  const playheadTs = useRef<number>(0);
  const frameIdx = useRef<number>(0);

  // ── Build frame list from chunks ────────────────────────────────────────────
  useEffect(() => {
    if (!session?.chunks) return;
    const all: Frame[] = [];
    for (const chunk of session.chunks) {
      try {
        const parsed: Frame[] = JSON.parse(chunk.frames);
        all.push(...parsed);
      } catch {}
    }
    all.sort((a, b) => a.ts - b.ts);
    frames.current = all;
    const last = all[all.length - 1];
    const dur = last ? last.ts + 500 : session.duration ?? 5000;
    setTotalDuration(dur);
    setReady(true);

    // Build heatmap from all mouse/click frames
    buildHeatmap(all);
  }, [session]);

  // ── Heatmap canvas ─────────────────────────────────────────────────────────
  function buildHeatmap(allFrames: Frame[]) {
    const cvs = heatCanvasRef.current;
    if (!cvs) return;
    const W = cvs.width;
    const H = cvs.height;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);

    // Collect mouse points, normalised to canvas dimensions using recorded viewport
    const vp = { w: session?.viewportW ?? 1280, h: session?.viewportH ?? 800 };
    const points: { x: number; y: number; r: number; isClick: boolean }[] = [];

    for (const f of allFrames) {
      if (f.type === "mouse") {
        const d = f.d as { x: number; y: number };
        points.push({
          x: (d.x / vp.w) * W,
          y: (d.y / vp.h) * H,
          r: 18,
          isClick: false,
        });
      } else if (f.type === "click") {
        const d = f.d as { x: number; y: number };
        points.push({
          x: (d.x / vp.w) * W,
          y: (d.y / vp.h) * H,
          r: 30,
          isClick: true,
        });
      }
    }

    // Draw radial gradients stacked (additive glow = heat)
    ctx.globalCompositeOperation = "screen";
    for (const p of points) {
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      if (p.isClick) {
        grad.addColorStop(0, "rgba(255,80,0,0.55)");
        grad.addColorStop(1, "rgba(255,80,0,0)");
      } else {
        grad.addColorStop(0, "rgba(80,100,255,0.22)");
        grad.addColorStop(1, "rgba(80,100,255,0)");
      }
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  // ── Seek to a timestamp — apply all frames up to ts ─────────────────────────
  const seekTo = useCallback((ts: number) => {
    const all = frames.current;
    if (!all.length) return;

    // Find snapshot frame at or before ts
    let snapNode: SnapshotNode | null = null;
    let scrollX = 0, scrollY = 0;
    const mouseTrail: { x: number; y: number; ts: number }[] = [];
    const clicks: { x: number; y: number; ts: number }[] = [];
    const logs: string[] = [];

    for (const f of all) {
      if (f.ts > ts) break;
      if (f.type === "snapshot") snapNode = f.d as SnapshotNode;
      if (f.type === "scroll") {
        const d = f.d as { x: number; y: number };
        scrollX = d.x; scrollY = d.y;
      }
      if (f.type === "mouse") mouseTrail.push({ ...(f.d as { x: number; y: number }), ts: f.ts });
      if (f.type === "click") clicks.push({ ...(f.d as { x: number; y: number }), ts: f.ts });
      if (f.type === "nav") logs.push(`[${fmtTs(f.ts)}] 🔗 nav → ${(f.d as { url: string }).url}`);
      if (f.type === "custom") logs.push(`[${fmtTs(f.ts)}] 🎯 ${(f.d as { name: string }).name}`);
    }

    setEventLog(logs.slice(-20));

    // Render snapshot into iframe
    if (iframeRef.current && snapNode) {
      iframeRef.current.srcdoc = snapshotToSrcDoc(snapNode);
      // After render, apply scroll
      iframeRef.current.onload = () => {
        try {
          iframeRef.current?.contentWindow?.scrollTo(scrollX, scrollY);
        } catch {}
      };
    }

    // Draw mouse trail + clicks on overlay canvas
    const cvs = canvasRef.current;
    if (cvs) {
      const ctx = cvs.getContext("2d");
      if (ctx) {
        const vp = { w: session?.viewportW ?? 1280, h: session?.viewportH ?? 800 };
        const scaleX = cvs.width / vp.w;
        const scaleY = cvs.height / vp.h;

        ctx.clearRect(0, 0, cvs.width, cvs.height);

        // Trail (last 30 points)
        const trail = mouseTrail.slice(-30);
        if (trail.length > 1) {
          ctx.beginPath();
          ctx.strokeStyle = "rgba(99,102,241,0.5)";
          ctx.lineWidth = 2;
          ctx.lineJoin = "round";
          ctx.lineCap = "round";
          ctx.moveTo(trail[0].x * scaleX, trail[0].y * scaleY);
          for (let i = 1; i < trail.length; i++) {
            ctx.lineTo(trail[i].x * scaleX, trail[i].y * scaleY);
          }
          ctx.stroke();
        }

        // Cursor dot at latest mouse position
        const last = mouseTrail[mouseTrail.length - 1];
        if (last) {
          ctx.beginPath();
          ctx.arc(last.x * scaleX, last.y * scaleY, 7, 0, Math.PI * 2);
          ctx.fillStyle = "#6366f1";
          ctx.fill();
          ctx.strokeStyle = "white";
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Click ripples (recent 2 seconds)
        for (const c of clicks.filter(c => ts - c.ts < 2000)) {
          const age = (ts - c.ts) / 2000; // 0=new, 1=old
          const r = 8 + age * 20;
          ctx.beginPath();
          ctx.arc(c.x * scaleX, c.y * scaleY, r, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(239,68,68,${1 - age})`;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    }
  }, [session]);

  // ── Playback RAF loop ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    lastRealTs.current = performance.now();

    function tick() {
      const now = performance.now();
      const elapsed = (now - lastRealTs.current) * speed;
      lastRealTs.current = now;
      playheadTs.current = Math.min(playheadTs.current + elapsed, totalDuration);
      setCurrentTs(playheadTs.current);
      seekTo(playheadTs.current);

      if (playheadTs.current >= totalDuration) {
        setPlaying(false);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, totalDuration, seekTo]);

  // ── Rebuild heatmap when canvas is ready ─────────────────────────────────────
  useEffect(() => {
    if (ready && activeView === "heatmap") buildHeatmap(frames.current);
  }, [activeView, ready]);

  if (isPending) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-zinc-400">
        Loading session…
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-zinc-400">
        Session not found.
      </div>
    );
  }

  const pct = totalDuration > 0 ? (currentTs / totalDuration) * 100 : 0;

  return (
    <div className="flex flex-col gap-0 bg-zinc-950 rounded-xl overflow-hidden border border-zinc-800">
      {/* ── Header bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 bg-zinc-900">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-zinc-400">
            {session.visitorId.slice(0, 12)}…
          </span>
          {session.errorCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-red-900/40 border border-red-800 px-2 py-0.5 text-[10px] text-red-400">
              {session.errorCount} error{session.errorCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        {/* View toggle */}
        <div className="flex items-center rounded-lg overflow-hidden border border-zinc-700">
          {(["replay", "heatmap"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setActiveView(v)}
              className={cn(
                "px-3 py-1 text-xs font-medium capitalize transition-colors",
                activeView === v
                  ? "bg-indigo-600 text-white"
                  : "bg-zinc-900 text-zinc-400 hover:text-zinc-200",
              )}
            >
              {v === "replay" ? "▶ Replay" : "🔥 Heatmap"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Viewport area ───────────────────────────────────────────────────── */}
      <div className="relative bg-zinc-950" style={{ aspectRatio: `${session.viewportW ?? 1280} / ${session.viewportH ?? 800}`, maxHeight: "480px" }}>
        {/* Iframe — DOM snapshot */}
        <iframe
          ref={iframeRef}
          sandbox="allow-same-origin"
          className={cn(
            "absolute inset-0 w-full h-full border-0 pointer-events-none",
            activeView === "heatmap" && "opacity-30",
          )}
          title="Session replay"
        />

        {/* Cursor + click overlay (replay only) */}
        {activeView === "replay" && (
          <canvas
            ref={canvasRef}
            width={session.viewportW ?? 1280}
            height={session.viewportH ?? 800}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />
        )}

        {/* Heatmap canvas */}
        {activeView === "heatmap" && (
          <canvas
            ref={heatCanvasRef}
            width={session.viewportW ?? 1280}
            height={session.viewportH ?? 800}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />
        )}

        {/* Empty state */}
        {ready && frames.current.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-zinc-500">
              No frames recorded for this session yet — the SDK flushes every 5s.
            </p>
          </div>
        )}
      </div>

      {/* ── Playback controls (replay only) ────────────────────────────────── */}
      {activeView === "replay" && (
        <div className="px-4 py-3 border-t border-zinc-800 bg-zinc-900 space-y-2">
          {/* Scrubber */}
          <input
            type="range"
            min={0}
            max={totalDuration}
            value={currentTs}
            onChange={(e) => {
              const ts = Number(e.target.value);
              playheadTs.current = ts;
              setCurrentTs(ts);
              seekTo(ts);
            }}
            className="w-full h-1.5 accent-indigo-500 cursor-pointer"
          />

          <div className="flex items-center justify-between">
            {/* Play / Pause */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (currentTs >= totalDuration) {
                    playheadTs.current = 0;
                    setCurrentTs(0);
                  }
                  setPlaying((p) => !p);
                }}
                className="flex items-center justify-center h-7 w-7 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs transition-colors"
              >
                {playing ? "⏸" : "▶"}
              </button>

              {/* Speed */}
              <div className="flex items-center rounded overflow-hidden border border-zinc-700">
                {[1, 2, 4].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSpeed(s)}
                    className={cn(
                      "px-2 py-0.5 text-[11px] font-mono transition-colors",
                      speed === s
                        ? "bg-indigo-600 text-white"
                        : "bg-zinc-900 text-zinc-400 hover:text-zinc-200",
                    )}
                  >
                    {s}×
                  </button>
                ))}
              </div>
            </div>

            {/* Timestamp */}
            <span className="text-[11px] font-mono text-zinc-500 tabular-nums">
              {fmtTs(currentTs)} / {fmtTs(totalDuration)}
            </span>
          </div>
        </div>
      )}

      {/* ── Heatmap legend ──────────────────────────────────────────────────── */}
      {activeView === "heatmap" && (
        <div className="px-4 py-2.5 border-t border-zinc-800 bg-zinc-900 flex items-center gap-6 text-xs text-zinc-400">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-indigo-500/70" />
            Mouse movement
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-orange-500" />
            Clicks
          </div>
          <span className="ml-auto text-zinc-600">
            {frames.current.filter(f => f.type === "mouse").length} mouse points ·{" "}
            {frames.current.filter(f => f.type === "click").length} clicks
          </span>
        </div>
      )}

      {/* ── Event log (replay only) ────────────────────────────────────────── */}
      {activeView === "replay" && eventLog.length > 0 && (
        <div className="px-4 py-2 border-t border-zinc-800 bg-zinc-950 max-h-28 overflow-y-auto">
          {eventLog.map((line, i) => (
            <p key={i} className="text-[11px] font-mono text-zinc-500 leading-5">
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function fmtTs(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, "0");
  return `${m}:${ss}`;
}
