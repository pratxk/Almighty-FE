/**
 * Typed API client for the Almighty backend.
 * All calls go to NEXT_PUBLIC_API_URL (default http://localhost:8000).
 * Every function throws an Error with a readable message on failure so the
 * UI can show an error banner instead of crashing.
 */
import type {
  ChatResponse,
  Conversation,
  DocumentInfo,
  HistoryMessage,
  IngestJob,
  IngestResponse,
} from "@/types";
import { deriveRunStats, normalizeTrace } from "@/services/trace";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, init);
  } catch {
    throw new Error(
      `Cannot reach the API at ${API_URL}. Is the backend running?`,
    );
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { detail?: string; message?: string };
      detail = body.detail ?? body.message ?? detail;
    } catch {
      // Non-JSON error body — keep the HTTP status text.
    }
    throw new Error(`API error ${res.status}: ${detail}`);
  }
  return (await res.json()) as T;
}

export async function health(): Promise<{ status: string; llm_provider?: string }> {
  return request<{ status: string; llm_provider?: string }>("/health");
}

export async function chat(
  question: string,
  history?: HistoryMessage[],
): Promise<ChatResponse> {
  const raw = await request<Record<string, unknown>>("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      history?.length ? { question, history } : { question },
    ),
  });
  // The backend returns trace as a run object, not TraceStep[] — normalize
  // it here (see services/trace.ts) so the graph never sees a non-array.
  return {
    answer: String(raw.answer ?? ""),
    confidence: typeof raw.confidence === "number" ? raw.confidence : 0,
    sources: (raw.sources as ChatResponse["sources"]) ?? [],
    route: String(raw.route ?? ""),
    retries: typeof raw.retries === "number" ? raw.retries : 0,
    trace: normalizeTrace(raw.trace),
    run_id: typeof raw.run_id === "string" ? raw.run_id : undefined,
    stats: deriveRunStats(raw.trace),
    cached: raw.cached === true ? true : undefined,
    cache_hit_type:
      raw.cache_hit_type === "exact" || raw.cache_hit_type === "semantic"
        ? raw.cache_hit_type
        : undefined,
  };
}

export interface StreamHandlers {
  onStep: (event: Record<string, unknown>) => void;
  onToken: (delta: string) => void;
  onDone: (payload: Record<string, unknown>) => void;
}

/**
 * Consume POST /api/chat/stream (SSE) with fetch + ReadableStream — a POST
 * cannot use EventSource. Parses `data: {...}` frames (ignoring `: ping`
 * heartbeat comments), normalizes the final `done` payload exactly like
 * chat(), and resolves with it. Throws on a non-OK response so callers can
 * fall back to the blocking chat() endpoint.
 */
export async function chatStream(
  question: string,
  handlers: StreamHandlers,
  history?: HistoryMessage[],
): Promise<ChatResponse> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        history?.length ? { question, history } : { question },
      ),
    });
  } catch {
    throw new Error(
      `Cannot reach the API at ${API_URL}. Is the backend running?`,
    );
  }
  if (!res.ok || !res.body) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { detail?: string; message?: string };
      detail = body.detail ?? body.message ?? detail;
    } catch {
      // Non-JSON error body — keep the HTTP status text.
    }
    throw new Error(`API error ${res.status}: ${detail}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  // Holder object (not a plain `let`) so TS tracks the closure assignment.
  const doneHolder: { payload: Record<string, unknown> | null } = {
    payload: null,
  };

  const handleFrame = (frame: string) => {
    for (const line of frame.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue; // `: ping` etc.
      try {
        const event = JSON.parse(trimmed.slice(5)) as Record<string, unknown>;
        if (event.type === "step") handlers.onStep(event);
        else if (event.type === "token" && typeof event.delta === "string") {
          handlers.onToken(event.delta);
        } else if (event.type === "done") {
          doneHolder.payload = event;
          handlers.onDone(event);
        } else if (event.type === "error") {
          throw new Error(String(event.message ?? "Streaming run failed."));
        }
      } catch (err) {
        if (err instanceof SyntaxError) continue; // partial frame — skip
        throw err;
      }
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx = buffer.indexOf("\n\n");
    while (idx !== -1) {
      handleFrame(buffer.slice(0, idx));
      buffer = buffer.slice(idx + 2);
      idx = buffer.indexOf("\n\n");
    }
  }
  if (buffer.trim()) handleFrame(buffer);
  if (!doneHolder.payload) {
    throw new Error("Stream ended without a final answer.");
  }
  const raw = doneHolder.payload;
  return {
    answer: String(raw.answer ?? ""),
    confidence: typeof raw.confidence === "number" ? raw.confidence : 0,
    sources: (raw.sources as ChatResponse["sources"]) ?? [],
    route: String(raw.route ?? ""),
    retries: typeof raw.retries === "number" ? raw.retries : 0,
    trace: normalizeTrace(raw.trace),
    run_id: typeof raw.run_id === "string" ? raw.run_id : undefined,
    stats: deriveRunStats(raw.trace),
    cached: raw.cached === true ? true : undefined,
    cache_hit_type:
      raw.cache_hit_type === "exact" || raw.cache_hit_type === "semantic"
        ? raw.cache_hit_type
        : undefined,
  };
}

export async function ingestFile(file: File): Promise<IngestResponse> {
  const form = new FormData();
  form.append("file", file);
  // 202 straight away — the file is queued, not ingested yet. Poll
  // getJob(job_id) for the result (see hooks/useDocuments).
  return request<IngestResponse>("/api/ingest", {
    method: "POST",
    body: form,
  });
}

export async function ingestUrl(url: string): Promise<IngestResponse> {
  return request<IngestResponse>("/api/ingest-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
}

export async function getJob(jobId: string): Promise<IngestJob> {
  return request<IngestJob>(`/api/jobs/${encodeURIComponent(jobId)}`);
}

export async function listJobs(): Promise<IngestJob[]> {
  const data = await request<IngestJob[] | { jobs: IngestJob[] }>("/api/jobs");
  return Array.isArray(data) ? data : data.jobs;
}

export async function listDocuments(): Promise<DocumentInfo[]> {
  const data = await request<DocumentInfo[] | { documents: DocumentInfo[] }>(
    "/api/documents",
  );
  return Array.isArray(data) ? data : data.documents;
}

export async function deleteDocument(id: string): Promise<void> {
  await request(`/api/documents/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function listConversations(): Promise<Conversation[]> {
  const data = await request<
    Conversation[] | { conversations: Conversation[] }
  >("/api/conversations");
  return Array.isArray(data) ? data : data.conversations;
}
