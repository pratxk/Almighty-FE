"use client";

import { useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  type Edge,
  type Node,
} from "reactflow";
import "reactflow/dist/style.css";
import type { TraceStep, TraceStatus } from "@/types";

/**
 * Live visualisation of the LangGraph workflow for one run — a vertical
 * pipeline in the inspector. Nodes are the fixed pipeline steps; their
 * status comes from the trace returned by the chat response /
 * GET /api/runs/{id}. Edges between two steps that both executed are the
 * flow actually taken (animated, solid emerald); the remaining canonical
 * edges are faint and dashed. Clicking a node opens a detail panel with
 * the data that flowed through that step.
 */

interface CanonicalStep {
  id: string;
  label: string;
  /** Lowercase substrings matched against trace step names. */
  match: string[];
}

const CANONICAL_STEPS: CanonicalStep[] = [
  // First: the contextualize pre-step lights up on follow-up turns.
  // ("query-analysis" matches ["analys", "analyze"] only — the bare
  // "query" substring would also match contextualize_query, since it
  // runs first in the trace and contains "query".)
  { id: "contextualize", label: "Contextualize", match: ["contextual"] },
  { id: "query-analysis", label: "Query analysis", match: ["analys", "analyze"] },
  { id: "routing", label: "Routing", match: ["rout"] },
  { id: "retrieval", label: "Retrieval", match: ["retriev"] },
  { id: "grading", label: "Relevance grading", match: ["grad", "relevan"] },
  { id: "rewriting", label: "Query rewriting", match: ["rewrit"] },
  { id: "generation", label: "Generation", match: ["generat"] },
  { id: "grounding", label: "Grounding check", match: ["ground", "verif", "hallucin"] },
  { id: "self-correction", label: "Self-correction", match: ["correct", "retry", "self"] },
];

const STATUS_META: Record<TraceStatus, { label: string; dot: string; text: string }> = {
  pending: { label: "pending", dot: "bg-mist-600", text: "text-mist-600" },
  running: { label: "running", dot: "bg-warn dot-running", text: "text-warn" },
  done: { label: "done", dot: "bg-success", text: "text-success" },
  failed: { label: "failed", dot: "bg-danger", text: "text-danger" },
};

function matchStep(trace: TraceStep[], step: CanonicalStep): TraceStep | undefined {
  if (!Array.isArray(trace)) return undefined;
  return trace.find((t) =>
    step.match.some((m) => t.step.toLowerCase().includes(m)),
  );
}

export default function AgentGraph({ trace }: { trace: TraceStep[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Defensive: a non-array trace (e.g. a raw backend run object) must
  // render an empty graph, never throw inside useMemo.
  const steps = Array.isArray(trace) ? trace : [];

  const { nodes, edges, selectedStep } = useMemo(() => {
    const executed = new Set<string>();
    const built: Node[] = CANONICAL_STEPS.map((step, i) => {
      const hit = matchStep(steps, step);
      const status: TraceStatus = hit ? hit.status ?? "done" : "pending";
      if (hit) executed.add(step.id);
      const meta = STATUS_META[status];
      const isSelected = selectedId === step.id;
      const isRunning = status === "running";

      return {
        id: step.id,
        position: { x: 0, y: i * 92 },
        data: {
          label: (
            <div style={{ textAlign: "left", width: "100%" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontFamily: "var(--font-display)",
                    fontWeight: 600,
                    fontSize: 13.5,
                    color: status === "pending" ? "#6b7386" : "#e9ecf3",
                  }}
                >
                  <span
                    className={`inline-block h-2 w-2 shrink-0 rounded-full ${meta.dot}`}
                  />
                  {step.label}
                </span>
                {hit?.data && typeof hit.data === "object" &&
                typeof (hit.data as Record<string, unknown>).duration_ms === "number" ? (
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "#6b7386",
                    }}
                  >
                    {((hit.data as Record<string, unknown>).duration_ms as number).toLocaleString()} ms
                  </span>
                ) : null}
              </div>
              <div
                style={{
                  marginTop: 4,
                  paddingLeft: 16,
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                }}
                className={meta.text}
              >
                ● {meta.label}
                {hit?.chunks !== undefined ? ` · ${hit.chunks} chunks` : ""}
                {hit?.chunks_kept !== undefined ? ` · kept ${hit.chunks_kept}` : ""}
              </div>
            </div>
          ),
        },
        style: {
          background:
            status === "done"
              ? "rgba(52,211,153,0.06)"
              : status === "running"
                ? "rgba(251,191,36,0.07)"
                : status === "failed"
                  ? "rgba(248,113,113,0.07)"
                  : "rgba(255,255,255,0.02)",
          border: isSelected
            ? "1px solid rgba(139,124,255,0.8)"
            : status === "done"
              ? "1px solid rgba(52,211,153,0.28)"
              : status === "running"
                ? "1px solid rgba(251,191,36,0.55)"
                : status === "failed"
                  ? "1px solid rgba(248,113,113,0.5)"
                  : "1px solid rgba(255,255,255,0.09)",
          borderRadius: 14,
          width: 316,
          padding: "12px 14px",
          boxShadow: isRunning
            ? "0 0 0 1px rgba(251,191,36,0.5), 0 0 24px -4px rgba(251,191,36,0.45)"
            : isSelected
              ? "0 0 0 1px rgba(139,124,255,0.35), 0 8px 32px -8px rgba(139,124,255,0.45)"
              : undefined,
        },
      };
    });

    const builtEdges: Edge[] = CANONICAL_STEPS.slice(0, -1).map((step, i) => {
      const next = CANONICAL_STEPS[i + 1];
      const taken = executed.has(step.id) && executed.has(next.id);
      return {
        id: `e-${step.id}-${next.id}`,
        source: step.id,
        target: next.id,
        animated: taken,
        markerEnd: { type: MarkerType.ArrowClosed, color: taken ? "#34d399" : "#3a4152" },
        style: taken
          ? { stroke: "#34d399", strokeWidth: 2 }
          : { stroke: "#2b3140", strokeWidth: 1.5, strokeDasharray: "4 5" },
      };
    });

    const selectedStep =
      selectedId !== null
        ? matchStep(steps, CANONICAL_STEPS.find((s) => s.id === selectedId)!)
        : undefined;

    return { nodes: built, edges: builtEdges, selectedStep };
  }, [steps, selectedId]);

  const executedCount = steps.filter((s) => s.status !== "pending").length;
  const selectedLabel =
    CANONICAL_STEPS.find((s) => s.id === selectedId)?.label ?? null;

  return (
    <div>
      <div className="flex items-baseline justify-between px-1">
        <h4 className="font-display text-sm font-semibold text-mist-100">
          Agent graph
        </h4>
        <span className="font-mono text-[11px] text-mist-600">
          {steps.length === 0
            ? "No trace yet"
            : `${executedCount}/${CANONICAL_STEPS.length} steps ran`}
        </span>
      </div>

      <div className="mt-3 h-[640px] w-full overflow-hidden rounded-card border border-white/[0.07] bg-ink-850/80">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodeClick={(_, node) => setSelectedId(node.id)}
          nodesDraggable={false}
          nodesConnectable={false}
          fitView
          fitViewOptions={{ padding: 0.12 }}
          minZoom={0.6}
          maxZoom={1.4}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} size={1} color="#1c2230" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      <p className="mt-2 px-1 text-xs leading-relaxed text-mist-600">
        Click a node for the data that flowed through it. Solid green edges
        are the path actually taken; dashed edges were not taken in this run.
      </p>

      {selectedId && (
        <div className="animate-fade-up mt-3 rounded-card border border-accent-500/30 bg-ink-850/90 p-4 text-sm">
          <div className="flex items-baseline justify-between">
            <h5 className="font-display font-semibold text-mist-100">
              {selectedLabel}
            </h5>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="text-xs text-mist-500 hover:text-mist-100"
            >
              Close ✕
            </button>
          </div>
          {!selectedStep ? (
            <p className="mt-1.5 text-mist-500">
              This step did not run for this answer — it is pending.
            </p>
          ) : (
            <div className="mt-2 space-y-1.5 text-mist-500">
              <p className="whitespace-pre-wrap leading-relaxed text-mist-300">
                {selectedStep.detail}
              </p>
              {selectedStep.status && (
                <p>
                  Status:{" "}
                  <span className="font-medium text-mist-100">
                    {selectedStep.status}
                  </span>
                </p>
              )}
              {selectedStep.documents && selectedStep.documents.length > 0 && (
                <div>
                  <p className="text-mist-100">Documents / chunks:</p>
                  <ul className="ml-4 list-disc">
                    {selectedStep.documents.map((d) => (
                      <li key={d} className="break-all">{d}</li>
                    ))}
                  </ul>
                </div>
              )}
              {selectedStep.chunks !== undefined && (
                <p>Chunks: <span className="text-mist-100">{selectedStep.chunks}</span></p>
              )}
              {selectedStep.chunks_kept !== undefined && (
                <p>
                  Kept after grading:{" "}
                  <span className="text-mist-100">{selectedStep.chunks_kept}</span>
                  {selectedStep.chunks_discarded !== undefined &&
                    ` · discarded: ${selectedStep.chunks_discarded}`}
                </p>
              )}
              {selectedStep.rewritten_query && (
                <p>
                  Rewritten query:{" "}
                  <span className="text-mist-100">{selectedStep.rewritten_query}</span>
                </p>
              )}
              {selectedStep.tokens !== undefined && (
                <p>Tokens sent to LLM: <span className="text-mist-100">{selectedStep.tokens.toLocaleString()}</span></p>
              )}
              {selectedStep.characters !== undefined && (
                <p>Characters: <span className="text-mist-100">{selectedStep.characters.toLocaleString()}</span></p>
              )}
              {selectedStep.data && (
                <pre className="overflow-x-auto rounded-lg bg-ink-950 p-2.5 font-mono text-xs leading-relaxed text-mist-300">
                  {JSON.stringify(selectedStep.data, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
