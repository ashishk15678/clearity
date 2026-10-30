"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/cn";

// ─── Types ────────────────────────────────────────────────────────────────────

type Placement = "auto" | "top" | "bottom" | "left" | "right" | "center";

interface TourStep {
  id: string;
  target: string;      // CSS selector, empty = center modal
  title: string;
  body: string;
  placement: Placement;
}

interface Tour {
  id: string;
  name: string;
  steps: TourStep[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function blankStep(): TourStep {
  return { id: uid(), target: "", title: "", body: "", placement: "auto" };
}

function blankTour(): Tour {
  return {
    id: uid(),
    name: "New tour",
    steps: [blankStep()],
  };
}

function buildSnippet(tour: Tour) {
  const steps = tour.steps.map((s) => {
    const parts = [
      s.target ? `target: "${s.target}"` : null,
      `title: "${s.title.replace(/"/g, '\\"')}"`,
      `body: "${s.body.replace(/"/g, '\\"')}"`,
      s.placement !== "auto" ? `placement: "${s.placement}"` : null,
    ]
      .filter(Boolean)
      .join(", ");
    return `  { ${parts} }`;
  });

  return [
    `clarity.tour([`,
    steps.join(",\n"),
    `], {`,
    `  storageKey: "${tour.id}",`,
    `  onComplete: () => console.log("tour complete"),`,
    `});`,
  ].join("\n");
}

const PLACEMENTS: { value: Placement; label: string }[] = [
  { value: "auto",   label: "Auto" },
  { value: "bottom", label: "Below" },
  { value: "top",    label: "Above" },
  { value: "right",  label: "Right" },
  { value: "left",   label: "Left" },
  { value: "center", label: "Center (modal)" },
];

// ─── Main component ───────────────────────────────────────────────────────────

export function TourBuilder({ orgSlug }: { orgSlug: string }) {
  const [tours, setTours]         = useState<Tour[]>([blankTour()]);
  const [activeId, setActiveId]   = useState<string>(tours[0]!.id);
  const [copied, setCopied]       = useState(false);

  const activeTour = tours.find((t) => t.id === activeId) ?? tours[0]!;

  // ── Tour-level mutations ────────────────────────────────────────────────────

  function updateTour(id: string, patch: Partial<Tour>) {
    setTours((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function addTour() {
    const t = blankTour();
    setTours((ts) => [...ts, t]);
    setActiveId(t.id);
  }

  function deleteTour(id: string) {
    setTours((ts) => {
      const next = ts.filter((t) => t.id !== id);
      if (next.length === 0) {
        const fresh = blankTour();
        setActiveId(fresh.id);
        return [fresh];
      }
      if (activeId === id) setActiveId(next[0]!.id);
      return next;
    });
  }

  // ── Step-level mutations ────────────────────────────────────────────────────

  function updateStep(stepId: string, patch: Partial<TourStep>) {
    updateTour(activeId, {
      steps: activeTour.steps.map((s) =>
        s.id === stepId ? { ...s, ...patch } : s,
      ),
    });
  }

  function addStep() {
    updateTour(activeId, { steps: [...activeTour.steps, blankStep()] });
  }

  function deleteStep(stepId: string) {
    const next = activeTour.steps.filter((s) => s.id !== stepId);
    updateTour(activeId, { steps: next.length ? next : [blankStep()] });
  }

  function moveStep(stepId: string, dir: -1 | 1) {
    const steps = [...activeTour.steps];
    const i = steps.findIndex((s) => s.id === stepId);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    [steps[i], steps[j]] = [steps[j]!, steps[i]!];
    updateTour(activeId, { steps });
  }

  // ── Copy snippet ────────────────────────────────────────────────────────────

  function copySnippet() {
    navigator.clipboard.writeText(buildSnippet(activeTour)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* ── Left: tour list ─────────────────────────────────────────────── */}
      <aside className="w-56 shrink-0 border-r border-zinc-200 dark:border-zinc-800 flex flex-col bg-zinc-50 dark:bg-zinc-900/50">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Tours</span>
          <button
            onClick={addTour}
            className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
            title="New tour"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
              <path d="M8 2a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 018 2z" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {tours.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveId(t.id)}
              className={cn(
                "w-full text-left px-4 py-2.5 text-sm transition-colors group flex items-center justify-between gap-2",
                t.id === activeId
                  ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium"
                  : "text-zinc-500 hover:bg-white/70 dark:hover:bg-zinc-800/50",
              )}
            >
              <span className="truncate">{t.name || "Untitled"}</span>
              <span className="shrink-0 text-[10px] text-zinc-400">
                {t.steps.length} step{t.steps.length !== 1 ? "s" : ""}
              </span>
            </button>
          ))}
        </div>
      </aside>

      {/* ── Center: step editor ─────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Tour name */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
          <input
            value={activeTour.name}
            onChange={(e) => updateTour(activeId, { name: e.target.value })}
            className="flex-1 text-sm font-semibold bg-transparent text-zinc-900 dark:text-zinc-100 outline-none placeholder:text-zinc-400"
            placeholder="Tour name…"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={copySnippet}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                copied
                  ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                  : "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40",
              )}
            >
              {copied ? (
                <><svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg>Copied!</>
              ) : (
                <><svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5"><path d="M0 6.75A.75.75 0 01.75 6h1.5a.75.75 0 010 1.5H.75A.75.75 0 010 6.75zM0 3.25A.75.75 0 01.75 2.5h8.5a.75.75 0 010 1.5H.75A.75.75 0 010 3.25zm0 7A.75.75 0 01.75 9.5h4.5a.75.75 0 010 1.5H.75A.75.75 0 010 10.25z"/><path d="M13 7.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm-5 1.5a5 5 0 1110 0 5 5 0 01-10 0z"/></svg>Copy snippet</>
              )}
            </button>
            <button
              onClick={() => deleteTour(activeId)}
              className="rounded-lg px-2.5 py-1.5 text-xs text-zinc-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-colors"
              title="Delete tour"
            >
              Delete
            </button>
          </div>
        </div>

        {/* Steps */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {activeTour.steps.map((step, i) => (
            <StepCard
              key={step.id}
              step={step}
              index={i}
              total={activeTour.steps.length}
              onChange={(patch) => updateStep(step.id, patch)}
              onDelete={() => deleteStep(step.id)}
              onMove={(dir) => moveStep(step.id, dir)}
            />
          ))}

          <button
            onClick={addStep}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 py-4 text-sm text-zinc-400 hover:border-indigo-300 hover:text-indigo-500 dark:hover:border-indigo-700 dark:hover:text-indigo-400 transition-colors"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
              <path d="M8 2a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 018 2z" />
            </svg>
            Add step
          </button>
        </div>
      </div>

      {/* ── Right: preview ──────────────────────────────────────────────── */}
      <aside className="w-80 shrink-0 border-l border-zinc-200 dark:border-zinc-800 flex flex-col bg-zinc-50 dark:bg-zinc-900/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Preview</span>
          <p className="text-[11px] text-zinc-400 mt-0.5">Paste the snippet into your page to see it live.</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Step preview cards */}
          {activeTour.steps.map((step, i) => (
            <div key={step.id} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                <span className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider">Step {i + 1}</span>
              </div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
                {step.title || <span className="text-zinc-300 font-normal italic">No title</span>}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {step.body || <span className="italic text-zinc-300">No description</span>}
              </p>
              {step.target && (
                <code className="mt-2 block text-[10px] font-mono text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded px-2 py-1 truncate">
                  {step.target}
                </code>
              )}
            </div>
          ))}

          {/* Code snippet */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
              <span className="text-[10px] font-mono font-semibold text-zinc-500">Embed snippet</span>
              <button
                onClick={copySnippet}
                className="text-[10px] text-zinc-400 hover:text-indigo-500 transition-colors"
              >
                {copied ? "Copied ✓" : "Copy"}
              </button>
            </div>
            <pre className="p-3 text-[11px] font-mono text-zinc-600 dark:text-zinc-300 overflow-x-auto leading-relaxed whitespace-pre-wrap">
              {buildSnippet(activeTour)}
            </pre>
          </div>
        </div>
      </aside>
    </div>
  );
}

// ─── StepCard ─────────────────────────────────────────────────────────────────

function StepCard({
  step,
  index,
  total,
  onChange,
  onDelete,
  onMove,
}: {
  step: TourStep;
  index: number;
  total: number;
  onChange: (patch: Partial<TourStep>) => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
        <div className="flex items-center gap-2">
          {/* Drag handles / order */}
          <span className="flex h-5 w-5 items-center justify-center rounded bg-indigo-100 dark:bg-indigo-900/30 text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
            {index + 1}
          </span>
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            {step.title || "Untitled step"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onMove(-1)}
            disabled={index === 0}
            className="p-1 rounded text-zinc-400 hover:text-zinc-600 disabled:opacity-25 transition-colors"
            title="Move up"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5"><path d="M8 2.5a.75.75 0 01.53.22l4.25 4.25a.75.75 0 01-1.06 1.06L8 4.31 4.28 8.03a.75.75 0 01-1.06-1.06L7.47 2.72A.75.75 0 018 2.5zm-4.22 7.22a.75.75 0 011.06 0L8 13.19l3.16-3.47a.75.75 0 111.1 1.02l-3.75 4.12a.75.75 0 01-1.1 0L3.78 10.78a.75.75 0 010-1.06z"/></svg>
          </button>
          <button
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            className="p-1 rounded text-zinc-400 hover:text-zinc-600 disabled:opacity-25 transition-colors"
            title="Move down"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5"><path d="M8 13.5a.75.75 0 01-.53-.22L3.22 9.03a.75.75 0 011.06-1.06L8 11.69l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25A.75.75 0 018 13.5zm-4.22-8.5a.75.75 0 011.06 0L8 8.47l3.16-3.47a.75.75 0 111.1 1.02L8.51 10.14a.75.75 0 01-1.1 0L3.78 6.06a.75.75 0 010-1.06z"/></svg>
          </button>
          <button
            onClick={onDelete}
            className="p-1 rounded text-zinc-400 hover:text-red-500 transition-colors"
            title="Delete step"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5"><path d="M11 1.75V3h2.25a.75.75 0 010 1.5H2.75a.75.75 0 010-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75zM4.496 6.675a.75.75 0 10-1.492.15l.66 6.6A1.75 1.75 0 005.41 15h5.18a1.75 1.75 0 001.746-1.577l.66-6.6a.75.75 0 00-1.492-.149l-.66 6.6a.25.25 0 01-.249.226H5.41a.25.25 0 01-.249-.226l-.665-6.6z"/></svg>
          </button>
        </div>
      </div>

      {/* Fields */}
      <div className="p-4 space-y-3">
        {/* Target selector */}
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            Target element <span className="text-zinc-300 font-normal normal-case">(CSS selector)</span>
          </label>
          <input
            value={step.target}
            onChange={(e) => onChange({ target: e.target.value })}
            placeholder="#my-button, .nav-item, [data-tour='step1']"
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-xs font-mono text-zinc-700 dark:text-zinc-300 placeholder:text-zinc-300 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
          />
          <p className="text-[10px] text-zinc-400">Leave empty to show a centered full-screen modal.</p>
        </div>

        {/* Title */}
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Title</label>
          <input
            value={step.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="Welcome to Clarity 👋"
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 placeholder:text-zinc-300 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
          />
        </div>

        {/* Body */}
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Description</label>
          <textarea
            value={step.body}
            onChange={(e) => onChange({ body: e.target.value })}
            placeholder="This is where you track all your analytics."
            rows={3}
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 placeholder:text-zinc-300 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 resize-none"
          />
        </div>

        {/* Placement */}
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Card placement</label>
          <div className="flex flex-wrap gap-1.5">
            {PLACEMENTS.map((p) => (
              <button
                key={p.value}
                onClick={() => onChange({ placement: p.value })}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  step.placement === p.value
                    ? "bg-indigo-500 text-white"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
