/**
 * Ingestion / token transparency for one run — as a small data dashboard:
 * headline stat tiles, a chunk funnel (retrieved → kept → discarded), and
 * the full ingestion ledger. Every value shows "—" when the backend did
 * not report it, so a partial stats object still renders.
 */
import type { RunStats } from "@/types";

function fmt(value: number | undefined): string {
  return typeof value === "number" ? value.toLocaleString() : "—";
}

export default function TransparencyPanel({ stats }: { stats?: RunStats }) {
  const retrieved = stats?.chunks_retrieved;
  const kept = stats?.chunks_kept;
  const discarded = stats?.chunks_discarded;
  const funnelMax = Math.max(retrieved ?? 0, 1);

  const funnel: Array<{
    label: string;
    value: number | undefined;
    width: number;
    bar: string;
    text: string;
  }> = [
    {
      label: "Retrieved",
      value: retrieved,
      width: retrieved !== undefined ? (retrieved / funnelMax) * 100 : 0,
      bar: "bg-accent-500",
      text: "text-accent-300",
    },
    {
      label: "Kept after grading",
      value: kept,
      width: kept !== undefined ? (kept / funnelMax) * 100 : 0,
      bar: "bg-success",
      text: "text-success",
    },
    {
      label: "Discarded",
      value: discarded,
      width: discarded !== undefined ? (discarded / funnelMax) * 100 : 0,
      bar: "bg-danger/80",
      text: "text-danger",
    },
  ];

  const ledger: Array<[string, string]> = [
    ["Documents ingested", fmt(stats?.documents_ingested)],
    ["Characters ingested", fmt(stats?.total_characters)],
    ["Tokens ingested", fmt(stats?.total_tokens_ingested)],
    ["Chunks created", fmt(stats?.chunks_created)],
    [
      "Chunk size / overlap",
      typeof stats?.chunk_size === "number"
        ? `${fmt(stats.chunk_size)} / ${fmt(stats.chunk_overlap)} chars`
        : "—",
    ],
    ["Generation tokens", fmt(stats?.generation_tokens)],
  ];

  return (
    <div>
      <div className="flex items-baseline justify-between px-1">
        <h4 className="font-display text-sm font-semibold text-mist-100">
          Transparency
        </h4>
        <span className="font-mono text-[11px] text-mist-600">
          every token accounted for
        </span>
      </div>

      {/* Headline tiles */}
      <div className="mt-3 grid grid-cols-3 gap-2.5">
        {[
          {
            label: "Tokens sent",
            value: fmt(stats?.tokens_sent_to_llm),
            accent: "text-accent-300",
          },
          {
            label: "LLM calls",
            value: fmt(stats?.llm_calls),
            accent: "text-mist-100",
          },
          {
            label: "Chunks kept",
            value: fmt(stats?.chunks_kept),
            accent: "text-success",
          },
        ].map((t) => (
          <div
            key={t.label}
            className="rounded-xl border border-white/[0.07] bg-ink-850/80 px-3 py-3"
          >
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-mist-600">
              {t.label}
            </p>
            <p className={`mt-1.5 font-mono text-xl font-semibold ${t.accent}`}>
              {t.value}
            </p>
          </div>
        ))}
      </div>

      {/* Chunk funnel */}
      <div className="mt-4 rounded-card border border-white/[0.07] bg-ink-850/80 p-4">
        <h5 className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-mist-600">
          Chunk funnel
        </h5>
        <div className="mt-3 space-y-3">
          {funnel.map((row) => (
            <div key={row.label}>
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-mist-300">{row.label}</span>
                <span className={`font-mono font-semibold ${row.text}`}>
                  {row.value ?? "—"}
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className={`h-full rounded-full ${row.bar} transition-all duration-500`}
                  style={{ width: `${Math.max(row.width, row.value ? 4 : 0)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Ingestion ledger */}
      <div className="mt-4 rounded-card border border-white/[0.07] bg-ink-850/80 p-4">
        <h5 className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-mist-600">
          Ingestion ledger
        </h5>
        <dl className="mt-3 space-y-2">
          {ledger.map(([label, value]) => (
            <div
              key={label}
              className="flex items-baseline justify-between gap-4 text-sm"
            >
              <dt className="text-mist-500">{label}</dt>
              <dd className="font-mono text-xs text-mist-100">{value}</dd>
            </div>
          ))}
        </dl>
        {!stats && (
          <p className="mt-3 text-xs leading-relaxed text-mist-600">
            No run stats were returned for this answer.
          </p>
        )}
      </div>

      {/* Context budget — only when the backend reports one */}
      {stats?.context_budget_max !== undefined && (
        <div className="mt-4 rounded-card border border-white/[0.07] bg-ink-850/80 p-4">
          <h5 className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-mist-600">
            Context budget
          </h5>
          <dl className="mt-3 space-y-2">
            <div className="flex items-baseline justify-between gap-4 text-sm">
              <dt className="text-mist-500">Prompt tokens / budget</dt>
              <dd className="font-mono text-xs text-mist-100">
                {fmt(stats.context_prompt_tokens)} /{" "}
                {fmt(stats.context_budget_max)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 text-sm">
              <dt className="text-mist-500">History turns used</dt>
              <dd className="font-mono text-xs text-mist-100">
                {fmt(stats.history_turns)}
              </dd>
            </div>
            {typeof stats.docs_dropped_by_budget === "number" &&
              stats.docs_dropped_by_budget > 0 && (
                <div className="flex items-baseline justify-between gap-4 text-sm">
                  <dt className="text-mist-500">Chunks dropped by budget</dt>
                  <dd className="font-mono text-xs text-mist-100">
                    {stats.docs_dropped_by_budget}
                  </dd>
                </div>
              )}
          </dl>
          {stats.context_truncated ? (
            <p className="mt-3 text-xs leading-relaxed text-warn">
              Budget applied: oldest history turns and lowest-graded chunks
              were dropped to fit the prompt within budget.
            </p>
          ) : (
            <p className="mt-3 text-xs leading-relaxed text-mist-600">
              Prompt fit within budget — nothing was dropped.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
