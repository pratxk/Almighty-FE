"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { chat as chatApi, chatStream } from "@/services/api";
import { deriveRunStats, normalizeTrace } from "@/services/trace";
import type { ChatMessageData, HistoryMessage, TraceStep } from "@/types";

let nextId = 0;
function newId(): string {
  nextId += 1;
  return `msg-${Date.now()}-${nextId}`;
}

/**
 * Fold one live SSE step event into the message's TraceStep[].
 * "running" events add (or refresh) the node; "done" events replace it with
 * the finished step incl. detail + node data (chunk counts, rewritten
 * query). Order follows first-seen order, so the graph lights up in the
 * order the agent actually ran.
 */
function applyStepEvent(
  steps: TraceStep[],
  ev: Record<string, unknown>,
): TraceStep[] {
  const node = String(ev.node ?? ev.step ?? "unknown");
  const status = ev.status === "running" ? "running" : "done";
  const data = (ev.data ?? {}) as Record<string, unknown>;
  const step: TraceStep = {
    step: node,
    detail:
      typeof ev.detail === "string" ? ev.detail : `${node} ${status}`,
    status,
    data: Object.keys(data).length > 0 ? data : undefined,
  };
  if (node === "retrieve" && typeof data.retrieved === "number") {
    step.chunks = data.retrieved;
  }
  if (node === "grade_documents") {
    if (typeof data.kept === "number") step.chunks_kept = data.kept;
    if (typeof data.discarded === "number") step.chunks_discarded = data.discarded;
  }
  if (node === "rewrite_query" && typeof data.rewritten_query === "string") {
    step.rewritten_query = data.rewritten_query;
  }
  const idx = steps.findIndex((s) => s.step === node);
  if (idx === -1) return [...steps, step];
  return steps.map((s, i) => (i === idx ? step : s));
}

/**
 * Owns the chat conversation: message list, send flow, loading and error
 * state. Answers stream in over POST /api/chat/stream (SSE): an assistant
 * placeholder is added immediately, token deltas append to its content
 * live, step events light up its trace as the agent runs, and the final
 * `done` event swaps in the full answer, citations and stats. If the
 * stream cannot even start (backend down, non-OK response), it falls back
 * to the blocking POST /api/chat; a mid-stream failure keeps the partial
 * answer and reports the interruption instead of discarding the work.
 */
export function useChat() {
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);
  // Ref mirror of messages so sendMessage (memoized on [loading]) can
  // build the history payload from the latest turns without re-creating.
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const sendMessage = useCallback(async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    // Multi-turn history: the last 3 turns (6 messages) ride along so
    // follow-ups ("tell me more about that") resolve. Only finished
    // messages with content count; the streaming placeholder is excluded
    // because it is added below, after this snapshot is taken.
    const history: HistoryMessage[] = messagesRef.current
      .filter((m) => m.content.trim().length > 0)
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content }));

    const userMessage: ChatMessageData = {
      id: newId(),
      role: "user",
      content: trimmed,
    };
    const assistantId = newId();
    setMessages((prev) => [
      ...prev,
      userMessage,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        streaming: true,
        trace: [],
      },
    ]);
    setLoading(true);
    setError(null);
    abortRef.current = false;

    const patchAssistant = (
      patch:
        | Partial<ChatMessageData>
        | ((m: ChatMessageData) => ChatMessageData),
    ) =>
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? typeof patch === "function"
              ? patch(m)
              : { ...m, ...patch }
            : m,
        ),
      );

    let streamedAnything = false;
    try {
      const res = await chatStream(trimmed, {
        onStep: (ev) => {
          streamedAnything = true;
          patchAssistant((m) => ({
            ...m,
            trace: applyStepEvent(m.trace ?? [], ev),
          }));
        },
        onToken: (delta) => {
          streamedAnything = true;
          patchAssistant((m) => ({ ...m, content: m.content + delta }));
        },
        onDone: (payload) => {
          streamedAnything = true;
          patchAssistant((m) => ({
            ...m,
            content: String(payload.answer ?? m.content),
            confidence:
              typeof payload.confidence === "number"
                ? payload.confidence
                : m.confidence,
            sources:
              (payload.sources as ChatMessageData["sources"]) ?? m.sources,
            route: String(payload.route ?? m.route ?? ""),
            retries:
              typeof payload.retries === "number"
                ? payload.retries
                : m.retries,
            trace: normalizeTrace(payload.trace),
            stats: deriveRunStats(payload.trace),
            runId:
              typeof payload.run_id === "string"
                ? payload.run_id
                : m.runId,
            cached: payload.cached === true ? true : undefined,
            cache_hit_type:
              payload.cache_hit_type === "exact" ||
              payload.cache_hit_type === "semantic"
                ? payload.cache_hit_type
                : undefined,
            streaming: false,
          }));
        },
      }, history);
      // chatStream resolves with the same normalized payload — belt and
      // braces so the final state is exact even if an event was missed.
      patchAssistant((m) => ({
        ...m,
        content: res.answer,
        confidence: res.confidence,
        sources: res.sources,
        route: res.route,
        retries: res.retries,
        trace: res.trace,
        stats: res.stats,
        runId: res.run_id,
        cached: res.cached,
        cache_hit_type: res.cache_hit_type,
        streaming: false,
      }));
    } catch (err) {
      if (abortRef.current) return;
      if (!streamedAnything) {
        // Stream never started — fall back to the blocking endpoint.
        try {
          const res = await chatApi(trimmed, history);
          patchAssistant((m) => ({
            ...m,
            content: res.answer,
            confidence: res.confidence,
            sources: res.sources ?? [],
            route: res.route,
            retries: res.retries,
            trace: res.trace ?? [],
            runId: res.run_id,
            stats: res.stats,
            cached: res.cached,
            cache_hit_type: res.cache_hit_type,
            streaming: false,
          }));
        } catch (err2) {
          setMessages((prev) => prev.filter((m) => m.id !== assistantId));
          setError(
            err2 instanceof Error ? err2.message : "Something went wrong.",
          );
        }
      } else {
        // Mid-stream failure: keep the partial answer, mark it finished.
        patchAssistant((m) => ({ ...m, streaming: false }));
        setError(
          err instanceof Error
            ? `Stream interrupted: ${err.message}`
            : "Stream interrupted.",
        );
      }
    } finally {
      if (!abortRef.current) setLoading(false);
    }
  }, [loading]);

  const clearError = useCallback(() => setError(null), []);

  const clearMessages = useCallback(() => {
    abortRef.current = true;
    setMessages([]);
    setError(null);
    setLoading(false);
  }, []);

  return { messages, loading, error, sendMessage, clearError, clearMessages };
}
