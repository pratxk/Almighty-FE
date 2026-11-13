/**
 * Run inspection — GET /api/runs/{id}.
 * Kept separate from the chat/document client because it serves the agent
 * graph visualisation, not the chat flow itself.
 */
import type { RunDetail } from "@/types";
import { deriveRunStats, normalizeTrace } from "@/services/trace";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function getRun(id: string): Promise<RunDetail> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/runs/${encodeURIComponent(id)}`);
  } catch {
    throw new Error(
      `Cannot reach the API at ${API_URL}. Is the backend running?`,
    );
  }
  if (!res.ok) {
    throw new Error(`Could not load run ${id} (HTTP ${res.status}).`);
  }
  // GET /api/runs returns { run_id, trace } where trace is the backend's
  // run object — normalize it to the TraceStep[] the graph expects.
  const raw = (await res.json()) as Record<string, unknown>;
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
