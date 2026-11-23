"use client";

import { useRef, useState, type FormEvent } from "react";
import type {
  Conversation,
  DocumentInfo,
  IngestJob,
  IngestResponse,
} from "@/types";

const ACCEPTED_TYPES = ".pdf,.txt,.md";

/**
 * Sidebar panel: document upload, URL ingest, knowledge-base document list
 * with delete, the stats of the most recent ingest, and conversation history.
 * All data actions come from props (owned by the useDocuments hook) — this
 * component only renders and collects input.
 */
export default function DocumentPanel({
  documents,
  conversations,
  loading,
  uploading,
  error,
  lastIngest,
  activeJob,
  onIngestFile,
  onIngestUrl,
  onDeleteDocument,
  onRefresh,
}: {
  documents: DocumentInfo[];
  conversations: Conversation[];
  loading: boolean;
  uploading: boolean;
  error: string | null;
  lastIngest: IngestResponse | null;
  activeJob: IngestJob | null;
  onIngestFile: (file: File) => Promise<IngestResponse>;
  onIngestUrl: (url: string) => Promise<IngestResponse>;
  onDeleteDocument: (id: string) => void;
  onRefresh: () => void;
}) {
  const [url, setUrl] = useState("");
  const [urlMessage, setUrlMessage] = useState<string | null>(null);
  const [fileMessage, setFileMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (file: File | undefined) => {
    if (!file) return;
    setFileMessage(null);
    try {
      const result = await onIngestFile(file);
      setFileMessage(
        `Ingested “${result.title ?? file.name}” — ${result.chunks_created ?? "?"} chunks.`,
      );
    } catch {
      // Error is already surfaced via the `error` prop.
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleUrlSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    setUrlMessage(null);
    try {
      const result = await onIngestUrl(trimmed);
      setUrlMessage(
        `Ingested “${result.title ?? trimmed}” — ${result.chunks_created ?? "?"} chunks.`,
      );
      setUrl("");
    } catch {
      // Error is already surfaced via the `error` prop.
    }
  };

  return (
    <div className="space-y-7">
      {/* Upload */}
      <section>
        <h3 className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-mist-600">
          Add documents
        </h3>
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="mt-2.5 flex w-full flex-col items-center gap-1.5 rounded-card border border-dashed border-white/[0.14] bg-white/[0.02] px-3 py-5 text-center transition hover:border-accent-500/50 hover:bg-accent-500/[0.06] disabled:opacity-50"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5 text-accent-300"
            aria-hidden
          >
            <path d="M12 16V4m0 0 4 4m-4-4-4 4" />
            <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
          </svg>
          <span className="text-sm font-medium text-mist-100">
            {uploading
              ? activeJob?.status === "processing"
                ? `Processing… ${activeJob.progress}%`
                : activeJob?.status === "queued"
                  ? "Queued — waiting for the worker…"
                  : "Uploading…"
              : "Drop a file or browse"}
          </span>
          <span className="font-mono text-[11px] text-mist-600">
            PDF · TXT · Markdown
          </span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          disabled={uploading}
          onChange={(e) => void handleFileChange(e.target.files?.[0])}
          className="sr-only"
        />
        {fileMessage && (
          <p className="mt-2 text-xs leading-relaxed text-success">{fileMessage}</p>
        )}
      </section>

      {/* URL ingest */}
      <section>
        <h3 className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-mist-600">
          Ingest from URL
        </h3>
        <form onSubmit={handleUrlSubmit} className="mt-2.5 flex gap-2">
          <input
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/article"
            disabled={uploading}
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-ink-850 px-3 py-2.5 text-sm text-mist-100 placeholder:text-mist-600 focus:border-accent-500/60 focus:outline-none focus:ring-2 focus:ring-accent-500/20 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={uploading || !url.trim()}
            className="shrink-0 rounded-xl bg-accent-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:bg-accent-500 disabled:opacity-50 disabled:shadow-none"
          >
            Ingest
          </button>
        </form>
        {urlMessage && (
          <p className="mt-2 text-xs leading-relaxed text-success">{urlMessage}</p>
        )}
      </section>

      {/* Live ingest job — the upload already returned (202), so this
          is the background work: queued, then processing with progress. */}
      {activeJob && activeJob.status !== "done" && (
        <section className="rounded-card border border-white/[0.07] bg-ink-850/80 p-3.5 text-sm">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="font-display font-semibold text-mist-100">
              {activeJob.status === "failed" ? "Ingest failed" : "Ingesting…"}
            </h3>
            <span className="font-mono text-[11px] text-mist-500">
              {activeJob.status === "processing"
                ? `${activeJob.progress}%`
                : activeJob.status}
            </span>
          </div>
          <p className="mt-1 truncate text-xs text-mist-500" title={activeJob.source}>
            {activeJob.title}
          </p>
          {activeJob.status !== "failed" && (
            <div
              className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/[0.08]"
              role="progressbar"
              aria-valuenow={activeJob.progress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-accent-500 transition-[width] duration-500"
                style={{ width: `${activeJob.progress}%` }}
              />
            </div>
          )}
          {activeJob.total_chunks > 0 && (
            <p className="mt-1.5 font-mono text-[11px] text-mist-600">
              {activeJob.done_chunks} / {activeJob.total_chunks} chunks
            </p>
          )}
          {activeJob.status === "failed" && activeJob.error && (
            <p className="mt-1.5 text-xs leading-relaxed text-danger">
              {activeJob.error}
            </p>
          )}
        </section>
      )}

      {/* Last ingest stats */}
      {lastIngest && (
        <section className="rounded-card border border-white/[0.07] bg-ink-850/80 p-3.5 text-sm">
          <h3 className="font-display font-semibold text-mist-100">Last ingest</h3>
          <dl className="mt-2 space-y-1.5 text-mist-500">
            <div className="flex justify-between gap-2">
              <dt>Chunks created</dt>
              <dd className="font-mono text-xs text-mist-100">
                {lastIngest.chunks_created ?? "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Characters</dt>
              <dd className="font-mono text-xs text-mist-100">
                {lastIngest.total_characters?.toLocaleString() ?? "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Tokens</dt>
              <dd className="font-mono text-xs text-mist-100">
                {lastIngest.total_tokens?.toLocaleString() ?? "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Chunk size / overlap</dt>
              <dd className="font-mono text-xs text-mist-100">
                {typeof lastIngest.chunk_size === "number"
                  ? `${lastIngest.chunk_size} / ${lastIngest.chunk_overlap ?? "—"}`
                  : "—"}
              </dd>
            </div>
          </dl>
        </section>
      )}

      {error && (
        <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-xs leading-relaxed text-danger">
          {error}
        </p>
      )}

      {/* Documents */}
      <section>
        <div className="flex items-baseline justify-between">
          <h3 className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-mist-600">
            Knowledge base · {documents.length}
          </h3>
          <button
            type="button"
            onClick={onRefresh}
            className="text-xs text-mist-500 hover:text-mist-100"
          >
            Refresh
          </button>
        </div>
        {loading ? (
          <p className="mt-2.5 text-sm text-mist-600">Loading documents…</p>
        ) : documents.length === 0 ? (
          <p className="mt-2.5 text-sm leading-relaxed text-mist-600">
            No documents yet. Upload a file or ingest a URL to get started.
          </p>
        ) : (
          <ul className="mt-2.5 space-y-2">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="group flex items-start gap-2.5 rounded-xl border border-white/[0.07] bg-ink-850/70 px-3 py-2.5 transition hover:border-white/[0.14]"
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-500/12 text-accent-300">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-3.5 w-3.5"
                    aria-hidden
                  >
                    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                    <path d="M14 3v5h5M9 13h6M9 17h4" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-mist-100" title={doc.source}>
                    {doc.title}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-mist-600">
                    {typeof doc.chunks === "number" && `${doc.chunks} chunks`}
                    {typeof doc.chunks === "number" &&
                      typeof doc.characters === "number" &&
                      " · "}
                    {typeof doc.characters === "number" &&
                      `${doc.characters.toLocaleString()} chars`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteDocument(doc.id)}
                  aria-label={`Delete ${doc.title}`}
                  className="shrink-0 rounded-lg px-2 py-1 text-xs text-mist-600 opacity-0 transition group-hover:opacity-100 hover:bg-danger/10 hover:text-danger"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Conversation history */}
      <section>
        <h3 className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-mist-600">
          Conversations · {conversations.length}
        </h3>
        {conversations.length === 0 ? (
          <p className="mt-2.5 text-sm text-mist-600">No past conversations yet.</p>
        ) : (
          <ul className="mt-2.5 space-y-2">
            {conversations.map((c) => (
              <li
                key={c.id}
                className="rounded-xl border border-white/[0.07] bg-ink-850/70 px-3 py-2.5"
              >
                <p className="truncate text-sm text-mist-100" title={c.title}>
                  {c.title}
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-mist-600">
                  {typeof c.message_count === "number" &&
                    `${c.message_count} messages`}
                  {c.created_at && ` · ${new Date(c.created_at).toLocaleDateString()}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
