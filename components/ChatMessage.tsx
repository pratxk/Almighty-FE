"use client";

import ConfidenceBadge from "@/components/ConfidenceBadge";
import type { ChatMessageData, TraceStep } from "@/types";

/** Short human labels for the pipeline nodes, for the live step chips. */
const STEP_LABELS: Record<string, string> = {
  analyze_query: "Analyze",
  routing: "Route",
  retrieve: "Retrieve",
  grade_documents: "Grade",
  rewrite_query: "Rewrite",
  generate: "Generate",
  check_grounding: "Ground",
  cache_hit: "Cache",
};

function stepLabel(step: string): string {
  return (
    STEP_LABELS[step] ??
    step.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function statusDot(status?: string): string {
  switch (status) {
    case "done":
      return "bg-success";
    case "running":
      return "bg-warn dot-running";
    case "failed":
      return "bg-danger";
    default:
      return "bg-mist-600";
  }
}

/** The Eye — Almighty's mark: an all-seeing eye in a violet→gold orbital ring. */
export function AgentOrb({ size = "md" }: { size?: "sm" | "md" }) {
  const dims = size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const eye = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center rounded-full ${dims}`}
      aria-hidden
    >
      {/* orbital ring: violet fading into muted gold */}
      <span className="absolute inset-0 rounded-full bg-[conic-gradient(from_140deg,rgba(139,124,255,0.9),rgba(192,154,62,0.85),rgba(139,124,255,0.2),rgba(139,124,255,0.9))]" />
      <span className="absolute inset-[2px] flex items-center justify-center rounded-full bg-ink-900">
        <svg viewBox="0 0 24 24" fill="none" className={eye} aria-hidden>
          <path
            d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
            stroke="#e6c887"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="12" r="3.2" stroke="#8b7cff" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="1.3" fill="#e6c887" />
        </svg>
      </span>
    </span>
  );
}

/**
 * One chat message.
 *
 * User messages are a violet bubble. Assistant messages are an answer card:
 * identity header (orb, name, confidence, route), the answer itself,
 * citation source cards with relevance bars, and a live step strip that
 * lights up while the run streams. The graph / trace / transparency detail
 * lives in the right-hand inspector — this card links to it via Inspect.
 */
export default function ChatMessage({
  message,
  selected,
  onInspect,
}: {
  message: ChatMessageData;
  selected?: boolean;
  onInspect?: (id: string) => void;
}) {
  if (message.role === "user") {
    return (
      <div className="animate-fade-up flex justify-end">
        <div className="max-w-[78%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-gradient-to-br from-accent-500 to-accent-700 px-4 py-3 text-[15px] font-medium leading-relaxed text-white shadow-glow">
          {message.content}
        </div>
      </div>
    );
  }

  const sources = message.sources ?? [];
  const trace = Array.isArray(message.trace) ? message.trace : [];
  const isExternal = (url: string) => /^https?:\/\//i.test(url);
  const streaming = message.streaming === true;
  const runningStep = trace.find((s) => s.status === "running");
  const liveTokens = Math.max(1, Math.round(message.content.length / 4));

  return (
    <article
      className={`animate-fade-up rounded-card border bg-ink-800/80 p-5 shadow-card backdrop-blur transition-colors ${
        selected
          ? "border-accent-500/50"
          : "border-white/[0.07] hover:border-white/[0.12]"
      }`}
    >
      {/* Header: identity + badges + inspect */}
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <AgentOrb size="sm" />
        <span className="wordmark font-display text-sm font-semibold tracking-tight">
          Almighty
        </span>
        {typeof message.confidence === "number" && !streaming && (
          <ConfidenceBadge confidence={message.confidence} />
        )}
        {message.cached && !streaming && (
          <span
            className="rounded-full border border-success/40 bg-success/[0.08] px-2.5 py-1 font-mono text-[11px] text-success"
            title="Answered from the response cache — no retrieval, 0 LLM calls"
          >
            ⚡ served from cache
            {message.cache_hit_type ? ` · ${message.cache_hit_type}` : ""}
          </span>
        )}
        {message.route && (
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[11px] text-mist-500">
            route · {message.route}
          </span>
        )}
        {typeof message.retries === "number" && message.retries > 0 && (
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[11px] text-mist-500">
            {message.retries} retr{message.retries === 1 ? "y" : "ies"}
          </span>
        )}
        <span className="ml-auto flex items-center gap-2">
          {message.stats?.tokens_sent_to_llm !== undefined && !streaming && (
            <span className="hidden font-mono text-[11px] text-mist-600 sm:inline">
              {message.stats.tokens_sent_to_llm.toLocaleString()} tokens ·{" "}
              {message.stats.llm_calls ?? 1} LLM call
              {(message.stats.llm_calls ?? 1) === 1 ? "" : "s"}
            </span>
          )}
          {streaming && message.content.length > 0 && (
            <span className="font-mono text-[11px] text-accent-300">
              ≈ {liveTokens.toLocaleString()} tokens…
            </span>
          )}
          {onInspect && (
            <button
              type="button"
              onClick={() => onInspect(message.id)}
              className="rounded-lg border border-accent-500/40 bg-accent-500/10 px-2.5 py-1 text-xs font-medium text-accent-300 transition hover:bg-accent-500/20"
            >
              Inspect run →
            </button>
          )}
        </span>
      </header>

      {/* Live step strip — lights up as the agent works */}
      {trace.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {trace.map((s: TraceStep, i: number) => (
            <span
              key={`${s.step}-${i}`}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                s.status === "running"
                  ? "border-warn/40 bg-warn/10 text-warn"
                  : s.status === "done"
                    ? "border-success/25 bg-success/[0.07] text-success"
                    : s.status === "failed"
                      ? "border-danger/40 bg-danger/10 text-danger"
                      : "border-white/10 bg-white/[0.03] text-mist-600"
              }`}
              title={s.detail}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${statusDot(s.status)}`} />
              {stepLabel(s.step)}
            </span>
          ))}
          {streaming && runningStep && (
            <span className="ml-1 text-xs text-mist-500">
              {stepLabel(runningStep.step)}…
            </span>
          )}
        </div>
      )}

      {/* Answer / streaming states */}
      {streaming && !message.content ? (
        <div className="mt-4 space-y-2.5" aria-live="polite">
          <div className="animate-shimmer h-3.5 w-full rounded-full" />
          <div className="animate-shimmer h-3.5 w-[86%] rounded-full" />
          <div className="animate-shimmer h-3.5 w-[62%] rounded-full" />
          <p className="pt-1 text-xs text-mist-500">
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-warn dot-running align-middle" />
            {runningStep
              ? `${stepLabel(runningStep.step)}…`
              : "Starting the agent…"}
          </p>
        </div>
      ) : (
        <p className="mt-3 whitespace-pre-wrap text-[15px] leading-7 text-mist-100">
          {message.content}
          {streaming && (
            <span className="caret-blink ml-0.5 inline-block h-[15px] w-[2px] translate-y-[2px] bg-accent-400" />
          )}
        </p>
      )}

      {/* Sources */}
      {sources.length > 0 && (
        <div className="mt-5">
          <h4 className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-mist-600">
            Sources · {sources.length}
          </h4>
          <ul className="mt-2.5 space-y-2">
            {sources.map((s, i) => (
              <li
                key={`${s.source}-${i}`}
                className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 transition hover:border-white/[0.14]"
              >
                <div className="flex items-baseline gap-2">
                  <span className="shrink-0 rounded-md bg-accent-500/15 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-accent-300">
                    [{i + 1}]
                  </span>
                  {s.source_type === "web" && (
                    <span
                      className="shrink-0 rounded-md bg-sky-500/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-sky-300"
                      title={`Web source: ${s.source}`}
                    >
                      Web
                    </span>
                  )}
                  {isExternal(s.source) ? (
                    <a
                      href={s.source}
                      target="_blank"
                      rel="noreferrer"
                      className="min-w-0 truncate text-sm font-medium text-mist-100 hover:text-accent-300 hover:underline"
                    >
                      {s.title}
                    </a>
                  ) : (
                    <span
                      className="min-w-0 truncate text-sm font-medium text-mist-100"
                      title={s.source}
                    >
                      {s.title}
                    </span>
                  )}
                  <span className="ml-auto flex shrink-0 items-center gap-2">
                    <span
                      className="h-1 w-14 overflow-hidden rounded-full bg-white/10"
                      title={`Relevance ${s.score.toFixed(2)}`}
                    >
                      <span
                        className="block h-full rounded-full bg-gradient-to-r from-accent-500 to-success"
                        style={{ width: `${Math.round(s.score * 100)}%` }}
                      />
                    </span>
                    <span className="font-mono text-[11px] text-mist-500">
                      {s.score.toFixed(2)}
                    </span>
                  </span>
                </div>
                <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-mist-500">
                  {s.snippet}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
