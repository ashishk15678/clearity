"use client";

/**
 * SessionReplay
 * ─────────────
 * Plays back a session recording from chunked frame data.
 * Frame types: snapshot, mouse, click, scroll, resize, input, nav, custom
 * All frames carry { type, ts, d } — ts is ms since page load.
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
  ts: number;
  d: unknown;
}

interface SnapshotNode {
  t: string; // tag or "text"
  v?: string; // text content
  a?: Record<string, string>;
  c?: SnapshotNode[];
}

// ─── DOM reconstruction ───────────────────────────────────────────────────────

const VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

function nodeToHtml(node: SnapshotNode): string {
  if (node.t === "text") return escHtml(node.v ?? "");
  const tag = node.t;
  const attrs = Object.entries(node.a ?? {})
    .map(([k, v]) => `${k}="${escAttr(v)}"`)
    .join(" ");
  const open = attrs ? `<${tag} ${attrs}>` : `<${tag}>`;
  if (VOID_TAGS.has(tag)) return open;
  return `${open}${(node.c ?? []).map(nodeToHtml).join("")}</${tag}>`;
}
function escHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escAttr(s: string) {
  return s.replace(/"/g, "&quot;").replace(/&/g, "&amp;");
}
function snapshotToSrcDoc(snap: SnapshotNode | null): string {
  if (!snap)
    return "<html><body><p style='font-family:system-ui;padding:2rem;color:#888;font-size:14px'>No DOM snapshot captured for this session.</p></body></html>";
  return `<!DOCTYPE html>${nodeToHtml(snap)}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SessionReplay({ sessionId }: { sessionId: string }) {
  const trpc = useTRPC();
  const { data: session, isPending } = useQuery(
    trpc.sessions.byId.queryOptions({ id: sessionId }),
  );

  const frames = useRef<Frame[]>([]);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [currentTs, setCurrentTs] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [activeView, setActiveView] = useState<"replay" | "heatmap">("replay");
  const [eventLog, setEventLog] = useState<string[]>([]);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const heatCanvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastRealTs = useRef<number>(0);
  const playheadTs = useRef<number>(0);

  // ── Build frame list ────────────────────────────────────────────────────────
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
    setTotalDuration(last ? last.ts + 500 : (session.duration ?? 5000));
    setReady(true);
    buildHeatmap(all);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // ── Heatmap ─────────────────────────────────────────────────────────────────
  function buildHeatmap(allFrames: Frame[]) {
    const cvs = heatCanvasRef.current;
    if (!cvs) return;
    const W = cvs.width;
    const H = cvs.height;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    const vp = { w: session?.viewportW ?? 1280, h: session?.viewportH ?? 800 };
    ctx.globalCompositeOperation = "screen";
    for (const f of allFrames) {
      if (f.type !== "mouse" && f.type !== "click") continue;
      const d = f.d as { x: number; y: number };
      const cx = (d.x / vp.w) * W;
      const cy = (d.y / vp.h) * H;
      const r = f.type === "click" ? 30 : 18;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      if (f.type === "click") {
        grad.addColorStop(0, "rgba(255,80,0,0.55)");
        grad.addColorStop(1, "rgba(255,80,0,0)");
      } else {
        grad.addColorStop(0, "rgba(0,112,243,0.22)");
        grad.addColorStop(1, "rgba(0,112,243,0)");
      }
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  // ── Seek ────────────────────────────────────────────────────────────────────
  const seekTo = useCallback(
    (ts: number) => {
      const all = frames.current;
      if (!all.length) return;

      let snapNode: SnapshotNode | null = null;
      let scrollX = 0;
      let scrollY = 0;
      const mouseTrail: { x: number; y: number; ts: number }[] = [];
      const clicks: { x: number; y: number; ts: number }[] = [];
      const logs: string[] = [];

      for (const f of all) {
        if (f.ts > ts) break;
        if (f.type === "snapshot") snapNode = f.d as SnapshotNode;
        if (f.type === "scroll") {
          const d = f.d as { x: number; y: number };
          scrollX = d.x;
          scrollY = d.y;
        }
        if (f.type === "mouse")
          mouseTrail.push({ ...(f.d as { x: number; y: number }), ts: f.ts });
        if (f.type === "click")
          clicks.push({ ...(f.d as { x: number; y: number }), ts: f.ts });
        if (f.type === "nav")
          logs.push(`[${fmtTs(f.ts)}] ↗ nav → ${(f.d as { url: string }).url}`);
        if (f.type === "custom")
          logs.push(`[${fmtTs(f.ts)}] ● ${(f.d as { name: string }).name}`);
      }

      setEventLog(logs.slice(-20));

      if (iframeRef.current && snapNode) {
        iframeRef.current.srcdoc = snapshotToSrcDoc(snapNode);
        iframeRef.current.onload = () => {
          try {
            iframeRef.current?.contentWindow?.scrollTo(scrollX, scrollY);
          } catch {}
        };
      }

      const cvs = canvasRef.current;
      if (cvs) {
        const ctx = cvs.getContext("2d");
        if (ctx) {
          const vp = {
            w: session?.viewportW ?? 1280,
            h: session?.viewportH ?? 800,
          };
          const sX = cvs.width / vp.w;
          const sY = cvs.height / vp.h;
          ctx.clearRect(0, 0, cvs.width, cvs.height);

          // Mouse trail (last 30)
          const trail = mouseTrail.slice(-30);
          if (trail.length > 1) {
            ctx.beginPath();
            ctx.strokeStyle = "rgba(0,112,243,0.45)";
            ctx.lineWidth = 2;
            ctx.lineJoin = "round";
            ctx.lineCap = "round";
            ctx.moveTo(trail[0].x * sX, trail[0].y * sY);
            for (let i = 1; i < trail.length; i++)
              ctx.lineTo(trail[i].x * sX, trail[i].y * sY);
            ctx.stroke();
          }

          // Cursor dot
          const last = mouseTrail[mouseTrail.length - 1];
          if (last) {
            ctx.beginPath();
            ctx.arc(last.x * sX, last.y * sY, 6, 0, Math.PI * 2);
            ctx.fillStyle = "#0070f3";
            ctx.fill();
            ctx.strokeStyle = "white";
            ctx.lineWidth = 2;
            ctx.stroke();
          }

          // Click ripples
          for (const c of clicks.filter((c) => ts - c.ts < 2000)) {
            const age = (ts - c.ts) / 2000;
            ctx.beginPath();
            ctx.arc(c.x * sX, c.y * sY, 8 + age * 20, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(224,0,0,${1 - age})`;
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        }
      }
    },
    [session],
  );

  // ── RAF playback loop ───────────────────────────────────────────────────────
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
      playheadTs.current = Math.min(
        playheadTs.current + elapsed,
        totalDuration,
      );
      setCurrentTs(playheadTs.current);
      seekTo(playheadTs.current);
      if (playheadTs.current >= totalDuration) {
        setPlaying(false);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, speed, totalDuration, seekTo]);

  useEffect(() => {
    if (ready && activeView === "heatmap") buildHeatmap(frames.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, ready]);

  // ── Loading / empty ─────────────────────────────────────────────────────────
  if (isPending) {
    return (
      <div className="flex items-center justify-center h-48 bg-black rounded-lg">
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <svg
            className="h-4 w-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
              strokeLinecap="round"
            />
          </svg>
          Loading session…
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center h-48 bg-black rounded-lg">
        <p className="text-sm text-zinc-500">Session not found.</p>
      </div>
    );
  }

  const pct = totalDuration > 0 ? (currentTs / totalDuration) * 100 : 0;
  const mouseFrameCount = frames.current.filter(
    (f) => f.type === "mouse",
  ).length;
  const clickFrameCount = frames.current.filter(
    (f) => f.type === "click",
  ).length;

  return (
    <div className="flex flex-col bg-zinc-950 overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800">
        <div className="flex items-center gap-3 min-w-0">
          <code className="text-xs font-mono text-zinc-400 truncate">
            {session.visitorId.slice(0, 12)}…
          </code>
          {session.errorCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-red-900/40 border border-red-800/50 px-2 py-0.5 text-[10px] font-medium text-red-400">
              {session.errorCount} error{session.errorCount !== 1 ? "s" : ""}
            </span>
          )}
          <span className="text-[11px] text-zinc-600 tabular-nums shrink-0">
            {fmtTs(session.duration ?? 0)} total
          </span>
        </div>

        {/* View toggle */}
        <div className="flex items-center rounded-md border border-zinc-700 overflow-hidden shrink-0">
          {(["replay", "heatmap"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setActiveView(v)}
              className={cn(
                "px-3 py-1 text-xs font-medium transition-colors",
                activeView === v
                  ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  : "bg-transparent text-zinc-500 hover:text-zinc-300",
              )}
            >
              {v === "replay" ? "▶ Replay" : "◈ Heatmap"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Viewport ──────────────────────────────────────────────────────── */}
      <div
        className="relative bg-zinc-950 w-full"
        style={{
          aspectRatio: `${session.viewportW ?? 1280} / ${session.viewportH ?? 800}`,
          maxHeight: "520px",
        }}
      >
        <iframe
          ref={iframeRef}
          sandbox="allow-same-origin"
          className={cn(
            "absolute inset-0 w-full h-full border-0 pointer-events-none",
            activeView === "heatmap" && "opacity-20",
          )}
          title="Session replay"
        />
        {activeView === "replay" && (
          <canvas
            ref={canvasRef}
            width={session.viewportW ?? 1280}
            height={session.viewportH ?? 800}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />
        )}
        {activeView === "heatmap" && (
          <canvas
            ref={heatCanvasRef}
            width={session.viewportW ?? 1280}
            height={session.viewportH ?? 800}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />
        )}
        {ready && frames.current.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-zinc-500 text-center max-w-sm px-6">
              No frames recorded yet — the SDK flushes every 5 seconds and on
              page unload.
            </p>
          </div>
        )}
      </div>

      {/* ── Playback controls ────────────────────────────────────────────── */}
      {activeView === "replay" && (
        <div className="px-4 py-3 border-t border-zinc-800 space-y-2.5">
          {/* Progress bar */}
          <div className="relative h-1 bg-zinc-800 rounded-full overflow-hidden cursor-pointer group">
            <div
              className="h-full bg-zinc-400 rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
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
              className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              {/* Play/pause */}
              <button
                onClick={() => {
                  if (currentTs >= totalDuration) {
                    playheadTs.current = 0;
                    setCurrentTs(0);
                  }
                  setPlaying((p) => !p);
                }}
                className="flex items-center justify-center h-7 w-7 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors text-[11px]"
              >
                {playing ? "⏸" : "▶"}
              </button>

              {/* Speed */}
              <div className="flex items-center rounded-md border border-zinc-700 overflow-hidden">
                {[1, 2, 4].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSpeed(s)}
                    className={cn(
                      "px-2 py-0.5 text-[11px] font-mono transition-colors",
                      speed === s
                        ? "bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                        : "text-zinc-500 hover:text-zinc-300",
                    )}
                  >
                    {s}×
                  </button>
                ))}
              </div>
            </div>

            {/* Timestamp */}
            <span className="text-[11px] font-mono text-zinc-600 tabular-nums">
              {fmtTs(currentTs)} / {fmtTs(totalDuration)}
            </span>
          </div>
        </div>
      )}

      {/* ── Heatmap legend ──────────────────────────────────────────────── */}
      {activeView === "heatmap" && (
        <div className="px-4 py-2.5 border-t border-zinc-800 flex items-center gap-6 text-xs text-zinc-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-blue-500/70" />
            Mouse ({mouseFrameCount})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-orange-500" />
            Clicks ({clickFrameCount})
          </span>
        </div>
      )}

      {/* ── Event log ───────────────────────────────────────────────────── */}
      {activeView === "replay" && eventLog.length > 0 && (
        <div className="px-4 py-2 border-t border-zinc-800 max-h-24 overflow-y-auto">
          {eventLog.map((line, i) => (
            <p
              key={i}
              className="text-[11px] font-mono text-zinc-600 leading-5"
            >
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
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
