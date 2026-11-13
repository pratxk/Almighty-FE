/**
 * Trace normalizer — the backend returns a run TRACE as one object, not a
 * list of steps:
 *
 *   { run_id, question, corpus: {...}, steps: [{ node, duration_ms, ... }],
 *     timings_ms, llm_calls, route, retries, retrieved, kept, discarded, ... }
 *
 * The UI components expect TraceStep[] ({ step, detail, status, ... }).
 * Passing the raw object straight through used to crash the page
 * (`trace.find is not a function` in AgentGraph) on every answered question.
 * Everything that consumes a backend trace goes through here first.
 */
import type { RunStats, TraceStep } from "@/types";

type RawStep = Record<string, unknown>;

function asNumber(v: unknown): number | undefined {
  return typeof v === "number" ? v : undefined;
}

function stepDetail(node: string, s: RawStep): string {
  switch (node) {
    case "analyze_query":
      return `Route: ${String(s.route ?? "?")} (${String(s.method ?? "heuristic")})`;
    case "contextualize_query":
      return typeof s.standalone_question === "string" && s.standalone_question
        ? `Resolved follow-up (${String(s.method ?? "?")}): ${String(s.standalone_question)}`
        : `Contextualized the question (${String(s.method ?? "skipped")})`;
    case "retrieve":
      return `Retrieved ${s.retrieved ?? "?"} chunks (top_k ${s.top_k ?? "?"}, complexity ${String(s.complexity ?? "?")}) in ${s.duration_ms ?? "?"} ms`;
    case "grade_documents":
      return `Graded ${s.graded ?? "?"} chunks — kept ${s.kept ?? "?"}, discarded ${s.discarded ?? "?"} (threshold ${s.threshold ?? "?"})`;
    case "rewrite_query":
      return s.rewritten_query
        ? `Rewrote query to: ${String(s.rewritten_query)}`
        : "Rewrote the query and re-ran retrieval";
    case "generate":
      return `Generated the answer from ${s.docs_used ?? "?"} documents (confidence ${s.confidence ?? "?"})${s.llm_used ? "" : " — extractive fallback, no LLM"}`;
    case "check_grounding":
      return `Grounding check: ${String(s.action ?? "?")} — ${s.dropped ?? 0} unsupported sentence(s) of ${s.sentences ?? "?"}`;
    case "web_search": {
      const domains = Array.isArray(s.domains) ? (s.domains as unknown[]) : [];
      let detail = `Web search (Tavily): ${s.results ?? "?"} result(s)`;
      if (domains.length > 0) detail += ` from ${domains.join(", ")}`;
      if (s.forced) detail += " (forced)";
      if (s.status === "empty") detail += " — no usable results";
      return detail;
    }
    case "cache_hit":
      return `Served from cache (${String(s.match_type ?? "?")} match) — 0 LLM calls, no retrieval`;
    case "guardrails_input":
      return s.status === "block"
        ? `Input guardrail: blocked (${String(s.category ?? "?")}) — question refused`
        : "Input guardrail: passed";
    case "guardrails_output":
      return s.status === "redact"
        ? `Output guardrail: redacted ${(s.findings as unknown[])?.length ?? "?"} PII finding(s)`
        : s.status === "block"
          ? "Output guardrail: answer refused (mostly PII)"
          : "Output guardrail: passed";
    default:
      return `${node} completed in ${s.duration_ms ?? "?"} ms`;
  }
}

function toTraceStep(s: RawStep, llmCalls: RawStep[]): TraceStep {
  const node = String(s.node ?? s.step ?? "unknown");
  const step: TraceStep = {
    step: node,
    detail: stepDetail(node, s),
    status: "done",
    data: s,
  };
  if (node === "retrieve" && asNumber(s.retrieved) !== undefined) {
    step.chunks = asNumber(s.retrieved);
  }
  if (node === "grade_documents") {
    step.chunks_kept = asNumber(s.kept);
    step.chunks_discarded = asNumber(s.discarded);
  }
  if (node === "rewrite_query" && typeof s.rewritten_query === "string") {
    step.rewritten_query = s.rewritten_query;
  }
  if (node === "generate") {
    const call = llmCalls.find((c) => c.node === "generate");
    const tokens = asNumber(call?.total_tokens) ?? asNumber(call?.total_tokens_est);
    if (tokens !== undefined) step.tokens = tokens;
  }
  return step;
}

/**
 * Convert any backend trace shape into the TraceStep[] the UI renders.
 * Accepts the run-object form ({ steps: [...] }), a bare steps array, or
 * an already-normalized TraceStep[] (passed through). Anything else → [].
 */
export function normalizeTrace(raw: unknown): TraceStep[] {
  if (!raw || typeof raw !== "object") return [];
  const llmCalls: RawStep[] = Array.isArray(
    (raw as Record<string, unknown>).llm_calls,
  )
    ? ((raw as Record<string, unknown>).llm_calls as RawStep[])
    : [];
  const steps: RawStep[] = Array.isArray(raw)
    ? (raw as RawStep[])
    : Array.isArray((raw as Record<string, unknown>).steps)
      ? ((raw as Record<string, unknown>).steps as RawStep[])
      : [];
  if (steps.length === 0) return [];

  const out: TraceStep[] = [];
  for (const s of steps) {
    if (!s || typeof s !== "object") continue;
    // Already-normalized step: keep it as-is.
    if (typeof s.step === "string" && typeof s.detail === "string") {
      out.push(s as unknown as TraceStep);
      continue;
    }
    out.push(toTraceStep(s, llmCalls));
    // The router decision lives on analyze_query; surface it as its own
    // graph node so the "Routing" step lights up instead of staying pending.
    if (s.node === "analyze_query" && s.route) {
      out.push({
        step: "routing",
        detail: `Route: ${String(s.route)} (${String(s.method ?? "heuristic")})`,
        status: "done",
        data: { route: s.route, method: s.method },
      });
    }
  }
  return out;
}

/** Pull the transparency numbers out of a backend trace object. */
export function deriveRunStats(raw: unknown): RunStats | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  const corpus = (r.corpus ?? {}) as Record<string, unknown>;
  const llmCalls = Array.isArray(r.llm_calls) ? r.llm_calls : [];
  const genCall = llmCalls.find(
    (c) => (c as Record<string, unknown>).node === "generate",
  ) as Record<string, unknown> | undefined;
  const budget = (r.context_budget ?? {}) as Record<string, unknown>;
  // A cache-served run made zero LLM calls: report 0, not "unknown"
  // (llm_calls is [] on a cached trace, and `0 || undefined` would hide it).
  const cached = r.cached === true;
  const stats: RunStats = {
    documents_ingested: asNumber(corpus.documents_ingested),
    total_characters: asNumber(corpus.total_chars),
    total_tokens_ingested: asNumber(corpus.total_tokens_est),
    chunks_created: asNumber(corpus.total_chunks),
    chunk_size: asNumber(corpus.chunk_size),
    chunk_overlap: asNumber(corpus.chunk_overlap),
    chunks_retrieved: asNumber(r.retrieved),
    chunks_kept: asNumber(r.kept),
    chunks_discarded: asNumber(r.discarded),
    tokens_sent_to_llm:
      asNumber(r.total_llm_tokens) ?? asNumber(r.total_llm_tokens_est),
    llm_calls: cached ? 0 : llmCalls.length || undefined,
    generation_tokens:
      asNumber(genCall?.total_tokens) ?? asNumber(genCall?.total_tokens_est),
    context_budget_max: asNumber(budget.max_context_tokens),
    context_prompt_tokens: asNumber(budget.prompt_tokens_est),
    history_turns: asNumber(budget.history_turns_included),
    context_truncated: budget.truncated === true ? true : undefined,
    docs_dropped_by_budget: asNumber(budget.docs_dropped),
  };
  return Object.values(stats).some((v) => v !== undefined) ? stats : undefined;
}
