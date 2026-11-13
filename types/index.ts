/**
 * Shared types for the Almighty frontend.
 * Single source of truth — components, hooks and services import from here.
 * All fields the backend may omit are optional so the UI degrades gracefully.
 */

/** One retrieved source document backing an answer. */
export interface SourceDoc {
  title: string;
  /** URL, file path or document id the citation points to. */
  source: string;
  /** Relevance score, 0–1. */
  score: number;
  /** Text excerpt from the matching chunk. */
  snippet: string;
  /** Where the citation came from: an ingested document ("local") or a
   * Tavily web-search result ("web"). Web sources render with a badge. */
  source_type?: "local" | "web";
  /** Chunk size in characters, when the backend reports it. */
  chunk_size?: number;
}

/** One step of the agent's execution trace. */
export type TraceStatus = "pending" | "running" | "done" | "failed";

export interface TraceStep {
  /** Canonical step id, e.g. "retrieval", "grading", "generation". */
  step: string;
  /** Human-readable description of what happened in this step. */
  detail: string;
  status?: TraceStatus;
  /** Documents/chunks this step touched (retrieval / grading). */
  documents?: string[];
  /** Number of chunks this step handled. */
  chunks?: number;
  /** Number of chunks kept after this step (grading). */
  chunks_kept?: number;
  /** Number of chunks discarded by this step (grading). */
  chunks_discarded?: number;
  /** Rewritten query produced by this step (query rewriting). */
  rewritten_query?: string;
  /** Tokens/characters sent to the LLM by this step. */
  tokens?: number;
  characters?: number;
  /** Extra backend-specific data; rendered as JSON in the detail panel. */
  data?: Record<string, unknown>;
}

/** Ingestion / token transparency numbers for one run. */
export interface RunStats {
  documents_ingested?: number;
  total_characters?: number;
  total_tokens_ingested?: number;
  chunks_created?: number;
  chunk_size?: number;
  chunk_overlap?: number;
  chunks_retrieved?: number;
  chunks_kept?: number;
  chunks_discarded?: number;
  /** Estimated tokens sent to the LLM across all calls in this run. */
  tokens_sent_to_llm?: number;
  /** Number of LLM calls made in this run. */
  llm_calls?: number;
  /** Tokens sent to the LLM for the generation call alone. */
  generation_tokens?: number;
  /** Prompt token budget for the run (MAX_CONTEXT_TOKENS). */
  context_budget_max?: number;
  /** Estimated tokens in the assembled generation prompt. */
  context_prompt_tokens?: number;
  /** History turns included in the prompt after budget fitting. */
  history_turns?: number;
  /** True when history turns or chunks were dropped to fit the budget. */
  context_truncated?: boolean;
  /** Retrieved chunks dropped by the token budget (not by grading). */
  docs_dropped_by_budget?: number;
}

/** One prior turn sent with a question so follow-ups resolve. */
export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

/** Response from POST /api/chat. */
export interface ChatResponse {
  answer: string;
  /** Answer confidence, 0–1. */
  confidence: number;
  sources: SourceDoc[];
  /** Which route the router picked, e.g. "vectorstore", "web_search". */
  route: string;
  retries: number;
  trace: TraceStep[];
  /** Run id — use it to fetch the full run via GET /api/runs/{id}. */
  run_id?: string;
  stats?: RunStats;
  /** True when this answer was served from the response cache (0 LLM calls). */
  cached?: boolean;
  /** How the cache matched: exact wording or a semantic paraphrase. */
  cache_hit_type?: "exact" | "semantic";
}

/** One run of the agent graph, from GET /api/runs/{id}. */
export interface RunDetail {
  id: string;
  status: TraceStatus;
  question?: string;
  route?: string;
  retries?: number;
  trace: TraceStep[];
  stats?: RunStats;
  answer?: string;
  confidence?: number;
  sources?: SourceDoc[];
}

/** A document in the knowledge base. */
export interface DocumentInfo {
  id: string;
  title: string;
  source: string;
  /** When it was ingested, ISO string when the backend reports it. */
  created_at?: string;
  chunks?: number;
  characters?: number;
  tokens?: number;
}

/** Stats returned by the ingest endpoints. */
export interface IngestResponse {
  document_id?: string;
  title?: string;
  chunks_created?: number;
  total_characters?: number;
  total_tokens?: number;
  chunk_size?: number;
  chunk_overlap?: number;
  message?: string;
}

/** One past conversation, from GET /api/conversations. */
export interface Conversation {
  id: string;
  title: string;
  created_at?: string;
  message_count?: number;
}

/** A chat message shown in the UI. */
export interface ChatMessageData {
  id: string;
  role: "user" | "assistant";
  content: string;
  confidence?: number;
  sources?: SourceDoc[];
  route?: string;
  retries?: number;
  trace?: TraceStep[];
  runId?: string;
  stats?: RunStats;
  /** True while the answer is still streaming in (token deltas arriving). */
  streaming?: boolean;
  /** True when this answer was served from the response cache (0 LLM calls). */
  cached?: boolean;
  /** How the cache matched: exact wording or a semantic paraphrase. */
  cache_hit_type?: "exact" | "semantic";
}
