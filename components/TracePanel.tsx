"use client";

import type { TraceStep } from "@/types";

const STATUS_DOT: Record<string, string> = {
  pending: "bg-mist-600",
  running: "bg-warn dot-running",
  done: "bg-success",
  failed: "bg-danger",
};

const STATUS_TEXT: Record<string, string> = {
  pending: "text-mist-600",
  running: "text-warn",
  done: "text-success",
  failed: "text-danger",
};

/**
 * LangSmith-style waterfall: the retrieval trace as a vertical timeline
 * with a connecting rail, per-step status dots, durations and details.
 * No collapse toggle — this panel lives in the inspector, where the trace
 * is the point.
 */
export default function TracePanel({
  route,
  retries,
  trace,
}: {
  route?: string;
  retries?: number;
  trace: TraceStep[];
}) {
  // Defensive: never assume the trace is an array — a raw backend run
  // object here used to crash the whole page.
  const steps = Array.isArray(trace) ? trace : [];

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
        <h4 className="font-display text-sm font-semibold text-mist-100">
          Retrieval trace
        </h4>
        <span className="flex gap-1.5">
          {route ? (
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[11px] text-mist-500">
              route: {route}
            </span>
          ) : null}
          {typeof retries === "number" && retries > 0 ? (
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[11px] text-mist-500">
              retries: {retries}
            </span>
          ) : null}
        </span>
      </div>

      {steps.length === 0 ? (
        <div className="mt-3 rounded-card border border-dashed border-white/10 bg-ink-850/60 p-4 text-sm text-mist-600">
          No trace steps were returned for this run.
        </div>
      ) : (
        <ol className="relative mt-4 space-y-5 pl-1">
          {/* connecting rail */}
          <span
            aria-hidden
            className="absolute bottom-2 left-[7px] top-2 w-px bg-gradient-to-b from-accent-500/50 via-white/10 to-white/[0.04]"
          />
          {steps.map((step, i) => (
            <li key={`${step.step}-${i}`} className="relative pl-7">
              <span
                className={`absolute left-0 top-1 h-[15px] w-[15px] rounded-full border-2 border-ink-900 ${
                  STATUS_DOT[step.status ?? "pending"] ?? "bg-mist-600"
                }`}
              />
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[11px] text-mist-600">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-sm font-medium text-mist-100">
                  {step.step}
                </span>
                {step.status ? (
                  <span
                    className={`font-mono text-[11px] ${
                      STATUS_TEXT[step.status] ?? "text-mist-500"
                    }`}
                  >
                    {step.status}
                  </span>
                ) : null}
                {step.data &&
                typeof step.data === "object" &&
                typeof (step.data as Record<string, unknown>).duration_ms ===
                  "number" ? (
                  <span className="ml-auto font-mono text-[11px] text-mist-600">
                    {(
                      (step.data as Record<string, unknown>)
                        .duration_ms as number
                    ).toLocaleString()}{" "}
                    ms
                  </span>
                ) : null}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-mist-500">
                {step.detail}
              </p>
              {step.rewritten_query ? (
                <p className="mt-1 text-sm text-mist-500">
                  Rewritten query:{" "}
                  <span className="text-accent-300">
                    {step.rewritten_query}
                  </span>
                </p>
              ) : null}
              {(step.chunks_kept !== undefined ||
                step.chunks_discarded !== undefined) && (
                <p className="mt-1 font-mono text-[11px] text-mist-600">
                  kept {step.chunks_kept ?? "—"} · discarded{" "}
                  {step.chunks_discarded ?? "—"}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
