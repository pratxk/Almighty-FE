/**
 * Run inspection — GET /api/runs/{id}.
 * Kept separate from the chat/document client because it serves the agent
 * graph visualisation, not the chat flow itself. Uses the shared
 * auth-aware request() from services/api so run traces are fetched with
 * the session token (and refreshed on 401) like every other call.
 */
import type { RunDetail } from "@/types";
import { request } from "@/services/api";
import { deriveRunStats, normalizeTrace } from "@/services/trace";

export async function getRun(id: string): Promise<RunDetail> {
  // GET /api/runs returns { run_id, trace } where trace is the backend's
  // run object — normalize it to the TraceStep[] the graph expects.
  const raw = await request<Record<string, unknown>>(
    `/api/runs/${encodeURIComponent(id)}`,
  );
  const traceRaw = raw.trace ?? raw;
  return {
    id: typeof raw.run_id === "string" ? raw.run_id : id,
    status: "done",
    question: typeof raw.question === "string" ? raw.question : undefined,
    route:
      typeof (traceRaw as Record<string, unknown>).route === "string"
        ? String((traceRaw as Record<string, unknown>).route)
        : undefined,
    retries:
      typeof (traceRaw as Record<string, unknown>).retries === "number"
        ? Number((traceRaw as Record<string, unknown>).retries)
        : undefined,
    trace: normalizeTrace(traceRaw),
    stats: deriveRunStats(traceRaw),
  };
}
