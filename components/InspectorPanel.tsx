"use client";

import { useState } from "react";
import AgentGraph from "@/components/AgentGraph";
import TracePanel from "@/components/TracePanel";
import TransparencyPanel from "@/components/TransparencyPanel";
import type { ChatMessageData } from "@/types";

type Tab = "graph" | "trace" | "tokens";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "graph", label: "Agent graph" },
  { id: "trace", label: "Trace" },
  { id: "tokens", label: "Tokens" },
];

/**
 * Right-hand run inspector: the agent graph, the retrieval trace waterfall
 * and the token transparency dashboard for one assistant message, behind
 * a segmented tab control. When nothing has been asked yet it shows the
 * pipeline map as a legend of what a run looks like.
 */
export default function InspectorPanel({
  message,
  onClose,
}: {
  message?: ChatMessageData;
  onClose?: () => void;
}) {
  const [tab, setTab] = useState<Tab>("graph");
  const trace = Array.isArray(message?.trace) ? message!.trace : [];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-sm font-semibold tracking-tight text-mist-100">
            Run inspector
          </h2>
          <p className="mt-0.5 truncate font-mono text-[11px] text-mist-600">
            {message?.runId
              ? `run ${message.runId.slice(0, 8)}…`
              : message?.streaming
                ? "streaming live…"
                : "no run selected"}
            {message?.route ? ` · ${message.route}` : ""}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close inspector"
            className="rounded-lg border border-white/10 px-2 py-1 text-xs text-mist-500 hover:bg-white/[0.05] hover:text-mist-100"
          >
            ✕
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="shrink-0 px-4 pt-3">
        <div
          role="tablist"
          aria-label="Inspector panels"
          className="flex rounded-full border border-white/[0.07] bg-ink-850/80 p-1"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-1 rounded-full px-2 py-1.5 text-xs font-semibold transition ${
                tab === t.id
                  ? "bg-accent-500/20 text-accent-300 shadow-glow"
                  : "text-mist-500 hover:text-mist-100"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {!message ? (
          <div className="rounded-card border border-dashed border-white/10 bg-ink-850/60 p-5">
            <p className="font-display text-sm font-semibold text-mist-100">
              Nothing to inspect yet
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-mist-500">
              Ask a question and the inspector will show the agent&apos;s live
              pipeline, the retrieval trace and the token accounting for that
              run.
            </p>
            <ol className="mt-4 space-y-2">
              {[
                "Query analysis",
                "Routing",
                "Retrieval",
                "Relevance grading",
                "Query rewriting",
                "Generation",
                "Grounding check",
                "Self-correction",
              ].map((label, i) => (
                <li key={label} className="flex items-center gap-2.5 text-sm text-mist-500">
                  <span className="font-mono text-[11px] text-mist-600">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {label}
                </li>
              ))}
            </ol>
          </div>
        ) : tab === "graph" ? (
          <AgentGraph trace={trace} />
        ) : tab === "trace" ? (
          <TracePanel
            route={message.route}
            retries={message.retries}
            trace={trace}
          />
        ) : (
          <TransparencyPanel stats={message.stats} />
        )}
      </div>
    </div>
  );
}
