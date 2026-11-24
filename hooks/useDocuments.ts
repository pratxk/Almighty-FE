"use client";

import { useCallback, useEffect, useState } from "react";
import {
  deleteDocument as deleteDocumentApi,
  getJob as getJobApi,
  ingestFile as ingestFileApi,
  ingestUrl as ingestUrlApi,
  listConversations,
  listDocuments,
} from "@/services/api";
import type {
  Conversation,
  DocumentInfo,
  IngestJob,
  IngestResponse,
} from "@/types";

// How often to ask the backend for a job's status, and how long to
// keep asking before giving up (a big document can take minutes).
const JOB_POLL_MS = 2000;
const JOB_POLL_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * Owns the knowledge-base sidebar state: document list, conversation
 * history, file/URL ingestion (including the ingest stats the backend
 * returns) and deletion. Loading and error are surfaced separately so the
 * sidebar can fail without taking the chat down with it.
 */
export function useDocuments() {
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastIngest, setLastIngest] = useState<IngestResponse | null>(null);
  // The ingest job currently running, if any — the panel shows its
  // queued/processing state and progress from this.
  const [activeJob, setActiveJob] = useState<IngestJob | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [docs, convos] = await Promise.all([
        listDocuments(),
        listConversations(),
      ]);
      setDocuments(docs);
      setConversations(convos);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load documents.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /**
   * Wait for a queued job to finish, polling the backend. Resolves
   * with the finished job (or throws with its error). The job's stats
   * become the "Last ingest" numbers, and the document list refreshes
   * only once the document actually exists.
   */
  const waitForJob = useCallback(
    async (jobId: string, title: string): Promise<IngestResponse> => {
      const started = Date.now();
      for (;;) {
        const job = await getJobApi(jobId);
        setActiveJob(job);
        if (job.status === "done") {
          const stats = (job.stats ?? {}) as Record<string, unknown>;
          const num = (v: unknown) =>
            typeof v === "number" ? v : undefined;
          const result: IngestResponse = {
            job_id: job.job_id,
            status: "done",
            title: job.title || title,
            document_id:
              typeof stats.document_id === "string"
                ? stats.document_id
                : undefined,
            chunks_created: num(stats.chunks),
            total_characters: num(stats.chars),
            total_tokens: num(stats.approx_tokens),
            chunk_size: num(stats.chunk_size),
            chunk_overlap: num(stats.chunk_overlap),
          };
          setLastIngest(result);
          await refresh();
          return result;
        }
        if (job.status === "failed") {
          throw new Error(
            job.error || "Ingest failed for an unknown reason.",
          );
        }
        if (Date.now() - started > JOB_POLL_TIMEOUT_MS) {
          throw new Error(
            "Ingest is taking too long — it is still queued on the server. " +
              "Refresh the document list in a bit to check.",
          );
        }
        await new Promise((resolve) => setTimeout(resolve, JOB_POLL_MS));
      }
    },
    [refresh],
  );

  const ingestFile = useCallback(
    async (file: File) => {
      setUploading(true);
      setError(null);
      setActiveJob(null);
      try {
        // The 202 only says the file was accepted — the real work
        // happens in the background, so wait for the job here.
        const ack = await ingestFileApi(file);
        return await waitForJob(ack.job_id, file.name);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Upload failed.";
        setError(message);
        throw new Error(message);
      } finally {
        setUploading(false);
      }
    },
    [waitForJob],
  );

  const ingestUrl = useCallback(
    async (url: string) => {
      setUploading(true);
      setError(null);
      setActiveJob(null);
      try {
        const ack = await ingestUrlApi(url);
        return await waitForJob(ack.job_id, url);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "URL ingest failed.";
        setError(message);
        throw new Error(message);
      } finally {
        setUploading(false);
      }
    },
    [waitForJob],
  );

  const deleteDocument = useCallback(async (id: string) => {
    setError(null);
    try {
      await deleteDocumentApi(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not delete document.",
      );
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    documents,
    conversations,
    loading,
    uploading,
    error,
    lastIngest,
    activeJob,
    refresh,
    ingestFile,
    ingestUrl,
    deleteDocument,
    clearError,
  };
}
