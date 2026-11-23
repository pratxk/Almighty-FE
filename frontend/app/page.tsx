"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import ChatMessage, { AgentOrb } from "@/components/ChatMessage";
import DocumentPanel from "@/components/DocumentPanel";
import InspectorPanel from "@/components/InspectorPanel";
import { useChat } from "@/hooks/useChat";
import { useDocuments } from "@/hooks/useDocuments";
import { health } from "@/services/api";

const EXAMPLE_QUESTIONS = [
  {
    q: "What are the main topics covered in my documents?",
    tag: "Overview",
  },
  {
    q: "Summarize the key points from the uploaded files.",
    tag: "Summary",
  },
  {
    q: "What does the document say about retrieval and grading?",
    tag: "Deep dive",
  },
  {
    q: "Give me an answer with citations from my sources.",
    tag: "Grounded",
  },
];

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const PROVIDER_LABEL: Record<string, string> = {
  gemini: "Gemini",
  ollama: "Ollama",
  none: "Extractive",
};

/**
 * Main page: product shell with a knowledge-base sidebar, a chat column,
 * and a right-hand run inspector. Composition only: chat state lives in
 * useChat, sidebar state in useDocuments, rendering in components/.
 */
export default function Home() {
  const { messages, loading, error, sendMessage, clearError, clearMessages } =
    useChat();
  const documents = useDocuments();
  const [input, setInput] = useState("");
  const [apiDown, setApiDown] = useState(false);
  const [provider, setProvider] = useState("gemini");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Backend availability probe — drives the status pill, not the chat.
  useEffect(() => {
    let cancelled = false;
    health()
      .then((res) => {
        if (!cancelled) {
          setApiDown(false);
          if (typeof res.llm_provider === "string") {
            setProvider(res.llm_provider);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setApiDown(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // A new question starts a new run — the inspector follows the latest run
  // unless the user explicitly picked an older one (handled by Inspect).
  useEffect(() => {
    setSelectedId(null);
  }, [messages.length]);

  const assistantMessages = messages.filter((m) => m.role === "assistant");
  const selectedMessage =
    (selectedId
      ? assistantMessages.find((m) => m.id === selectedId)
      : undefined) ?? assistantMessages[assistantMessages.length - 1];

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const question = input;
    setInput("");
    void sendMessage(question);
  };

  const askExample = (q: string) => {
    void sendMessage(q);
  };

  const inspect = (id: string) => {
    setSelectedId(id);
    setInspectorOpen(true);
  };

  const sidebar = (
    <DocumentPanel
      documents={documents.documents}
      conversations={documents.conversations}
      loading={documents.loading}
      uploading={documents.uploading}
      error={documents.error}
      lastIngest={documents.lastIngest}
      activeJob={documents.activeJob}
      onIngestFile={documents.ingestFile}
      onIngestUrl={documents.ingestUrl}
      onDeleteDocument={documents.deleteDocument}
      onRefresh={documents.refresh}
    />
  );

  return (
    <div className="flex h-screen flex-col">
      {/* Top bar */}
      <header className="z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-white/[0.06] bg-ink-900/80 px-4 backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            className="rounded-lg border border-white/10 px-2.5 py-1.5 text-sm text-mist-300 lg:hidden"
            aria-label="Toggle documents panel"
          >
            ☰
          </button>
          <AgentOrb />
          {/* Wordmark hidden on narrow phones (<480px): the eye orb
              carries the brand there, and the full title truncated
              to "Almig…" in the crowded header. */}
          <div className="hidden min-w-0 min-[480px]:block">
            <h1 className="wordmark truncate font-display text-[17px] font-bold leading-tight tracking-tight">
              Almighty
            </h1>
            <p className="truncate font-mono text-[11px] text-mist-600">
              Adaptive RAG · grounded answers · live agent trace
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-mono text-[11px] text-mist-500">
            {PROVIDER_LABEL[provider] ?? provider} · LangGraph
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
              apiDown
                ? "border-danger/40 bg-danger/10 text-danger"
                : "border-success/40 bg-success/10 text-success"
            }`}
            title={`Backend: ${API_URL}`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                apiDown ? "bg-danger" : "bg-success dot-live"
              }`}
            />
            {apiDown ? "API offline" : "API online"}
          </span>
          <button
            type="button"
            onClick={() => setInspectorOpen((v) => !v)}
            className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-medium text-mist-300 transition hover:bg-white/[0.05] xl:hidden"
            aria-label="Toggle run inspector"
          >
            Inspector
          </button>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={clearMessages}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-mist-300 transition hover:bg-white/[0.05]"
            >
              New chat
            </button>
          )}
        </div>
      </header>

      {apiDown && (
        <div
          role="alert"
          className="shrink-0 border-b border-danger/40 bg-danger/10 px-4 py-2.5 text-sm text-danger"
        >
          Cannot reach the API at {API_URL}. Start the backend, then refresh —
          chat and document actions will fail until it is back.
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Sidebar — desktop */}
        <aside className="hidden w-[300px] shrink-0 flex-col overflow-y-auto border-r border-white/[0.06] bg-ink-900/60 p-5 lg:flex">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-display text-sm font-semibold tracking-tight text-mist-100">
              Knowledge base
            </h2>
            <span className="rounded-full bg-accent-500/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-accent-300">
              {documents.documents.length} docs
            </span>
          </div>
          {sidebar}
        </aside>

        {/* Sidebar — mobile drawer */}
        {sidebarOpen && (
          <div className="absolute inset-0 z-40 flex lg:hidden">
            <div className="w-[300px] overflow-y-auto bg-ink-900 p-5 shadow-2xl">
              <div className="mb-4 flex items-baseline justify-between">
                <h2 className="font-display text-sm font-semibold tracking-tight text-mist-100">
                  Knowledge base
                </h2>
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="text-xs text-mist-500 hover:text-mist-100"
                  aria-label="Close documents panel"
                >
                  ✕
                </button>
              </div>
              {sidebar}
            </div>
            <button
              type="button"
              aria-label="Close documents panel"
              className="flex-1 bg-black/60 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />
          </div>
        )}

        {/* Chat column */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
            {messages.length === 0 ? (
              <div className="animate-fade-up mx-auto max-w-2xl pt-8 text-center sm:pt-14">
                {/* The Eye — orbital rings, breathing violet→gold glow */}
                <div className="relative mx-auto h-24 w-24">
                  <span
                    aria-hidden
                    className="orb-spin absolute -inset-3 rounded-full border border-dashed border-white/[0.12]"
                  />
                  <span
                    aria-hidden
                    className="orb-breathe absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,rgba(139,124,255,0.75),rgba(192,154,62,0.55),rgba(139,124,255,0.75))] opacity-70 blur-md"
                  />
                  <span className="absolute inset-0 flex items-center justify-center rounded-full border border-white/10 bg-ink-800">
                    <AgentOrb />
                  </span>
                </div>
                <p className="mt-8 font-mono text-[11px] font-semibold uppercase tracking-[0.32em] text-aurum-400">
                  Almighty · All-seeing knowledge
                </p>
                <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight tracking-tight text-mist-100 sm:text-4xl">
                  Ask your documents{" "}
                  <span className="bg-gradient-to-r from-accent-300 via-accent-400 to-aurum-300 bg-clip-text text-transparent">
                    anything.
                  </span>
                </h2>
                <p className="mx-auto mt-3 max-w-lg text-[15px] leading-relaxed text-mist-500">
                  Upload a PDF, text or Markdown file — or ingest a URL — and
                  the agent retrieves, grades, and grounds every answer in
                  your sources, showing its work as it goes.
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  {["Hybrid retrieval", "Grounded citations", "Live trace"].map(
                    (chip) => (
                      <span
                        key={chip}
                        className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-[11px] text-mist-500"
                      >
                        {chip}
                      </span>
                    ),
                  )}
                </div>
                <div className="mt-8 grid gap-2.5 text-left sm:grid-cols-2">
                  {EXAMPLE_QUESTIONS.map(({ q, tag }, i) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => askExample(q)}
                      style={{ animationDelay: `${i * 70}ms` }}
                      className="group animate-fade-up rounded-card border border-white/[0.07] bg-ink-800/70 p-4 text-left transition hover:-translate-y-0.5 hover:border-accent-500/40 hover:shadow-glow"
                    >
                      <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-300">
                        {tag}
                      </span>
                      <span className="mt-1.5 block text-sm leading-relaxed text-mist-100">
                        {q}
                      </span>
                      <span className="mt-2 block text-xs text-mist-600 transition group-hover:text-accent-300">
                        Ask →
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-3xl space-y-5">
                {messages.map((m) => (
                  <ChatMessage
                    key={m.id}
                    message={m}
                    selected={selectedMessage?.id === m.id}
                    onInspect={inspect}
                  />
                ))}
                <div ref={endRef} />
              </div>
            )}
          </div>

          {error && (
            <div
              role="alert"
              className="mx-4 mb-3 flex items-start justify-between gap-3 rounded-xl border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-sm text-danger sm:mx-6"
            >
              <span>{error}</span>
              <button
                type="button"
                onClick={clearError}
                className="shrink-0 text-danger hover:text-white"
                aria-label="Dismiss error"
              >
                ✕
              </button>
            </div>
          )}

          {/* Composer */}
          <div className="shrink-0 px-4 pb-5 pt-1 sm:px-6">
            <form onSubmit={handleSubmit} className="mx-auto max-w-3xl">
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-ink-800/90 p-2 pl-4 shadow-card backdrop-blur transition focus-within:border-accent-500/60 focus-within:shadow-glow">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask a question about your documents…"
                  aria-label="Question"
                  className="min-w-0 flex-1 bg-transparent py-2 text-[15px] text-mist-100 placeholder:text-mist-600 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  aria-label="Send question"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent-500 to-accent-700 text-white shadow-glow transition hover:from-accent-400 hover:to-accent-600 disabled:opacity-40 disabled:shadow-none"
                >
                  {loading ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-5 w-5"
                      aria-hidden
                    >
                      <path d="M12 19V5m0 0-6 6m6-6 6 6" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="mt-2 text-center font-mono text-[11px] text-mist-600">
                Enter to send · Answers are grounded in your documents, with
                citations
              </p>
            </form>
          </div>
        </main>

        {/* Inspector — desktop */}
        <aside className="hidden w-[380px] shrink-0 border-l border-white/[0.06] bg-ink-900/60 xl:block">
          <InspectorPanel message={selectedMessage} />
        </aside>

        {/* Inspector — mobile / tablet drawer */}
        {inspectorOpen && (
          <div className="absolute inset-0 z-40 flex justify-end xl:hidden">
            <button
              type="button"
              aria-label="Close inspector"
              className="flex-1 bg-black/60 backdrop-blur-sm"
              onClick={() => setInspectorOpen(false)}
            />
            <div className="w-[380px] max-w-[92vw] bg-ink-900 shadow-2xl">
              <InspectorPanel
                message={selectedMessage}
                onClose={() => setInspectorOpen(false)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
