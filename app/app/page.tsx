"use client";

import { useEffect, useRef, useState } from "react";

const API_KEY = "clr_live_5jaOvEMG4vv4MtGa89pyIPVOog1IOCSy";
const PROJECT_ID = "929dcce6-b5b8-497b-9109-dccc1cf49105";

export default function RootPage() {
  const scriptLoaded = useRef(false);
  const [log, setLog] = useState<string[]>([]);

  const push = (msg: string) =>
    setLog((l) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...l]);

  // Load clarity.js once
  useEffect(() => {
    if (scriptLoaded.current) return;
    scriptLoaded.current = true;
    const s = document.createElement("script");
    s.src = "/clarity.js";
    s.setAttribute("data-project-id", PROJECT_ID);
    s.setAttribute("data-api-key", API_KEY);
    s.setAttribute("data-ingest", "http://localhost:4000");
    s.onload = () => push("✅ clarity.js loaded");
    s.onerror = () => push("❌ clarity.js failed to load — is dev server running?");
    document.head.appendChild(s);
  }, []);

  function fireCustomEvent() {
    const w = window as any;
    if (!w.clarity?.track) { push("⚠️ clarity not ready yet"); return; }
    w.clarity.track("button_click", { button: "custom-event", ts: Date.now() });
    push("📤 custom event sent → button_click");
  }

  function fireError() {
    push("📤 throwing error → will be caught by global handler");
    // Use setTimeout so React's error boundary doesn't catch it
    setTimeout(() => {
      throw new Error("Test error from demo page — " + new Date().toISOString());
    }, 0);
  }

  function firePageView() {
    // Manually trigger a SPA navigation via history.pushState
    const url = window.location.origin + "/?test=" + Date.now();
    history.pushState({}, "", url);
    push("📤 synthetic page view sent → " + url);
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8 font-mono">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-white">Clarity SDK Test Harness</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Fires real events to{" "}
            <code className="text-indigo-400">localhost:4000</code> — open the
            project dashboard to see them appear.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-x-4 text-xs text-zinc-500">
            <span>
              Project:{" "}
              <code className="text-zinc-300">{PROJECT_ID.slice(0, 8)}…</code>
            </span>
            <span>
              Key:{" "}
              <code className="text-zinc-300">{API_KEY.slice(0, 16)}…</code>
            </span>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={fireCustomEvent}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition-colors"
          >
            🎯 Fire custom event
          </button>
          <button
            onClick={fireError}
            className="rounded-lg bg-red-700 hover:bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors"
          >
            💥 Throw error
          </button>
          <button
            onClick={firePageView}
            className="rounded-lg bg-emerald-700 hover:bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors"
          >
            📄 Fake page view
          </button>
          <button
            onClick={() => {
              fireCustomEvent();
              fireCustomEvent();
              fireCustomEvent();
              push("📤 sent 3 rapid events for replay test");
            }}
            className="rounded-lg bg-zinc-700 hover:bg-zinc-600 px-4 py-2 text-sm font-medium text-white transition-colors"
          >
            ⚡ Burst 3 events
          </button>
        </div>

        {/* Activity log */}
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4 space-y-1 min-h-[160px]">
          <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-2">
            Activity log
          </p>
          {log.length === 0 ? (
            <p className="text-xs text-zinc-600">No activity yet — click a button above.</p>
          ) : (
            log.map((line, i) => (
              <p key={i} className="text-xs text-zinc-300 leading-relaxed">
                {line}
              </p>
            ))
          )}
        </div>

        {/* Instructions */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-xs text-zinc-400 space-y-2">
          <p className="font-semibold text-zinc-300">How to use</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Make sure the ingest server is running on <code className="text-indigo-400">:4000</code></li>
            <li>Fire events using the buttons above</li>
            <li>
              Open{" "}
              <code className="text-indigo-400">/console</code> → select your
              project → <strong>Events</strong> / <strong>Errors</strong> tabs
            </li>
            <li>
              Session recordings appear under the{" "}
              <strong>Sessions</strong> tab after the page is idle 5s
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
