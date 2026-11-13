"use client";

import { useCallback, useEffect, useState } from "react";
import {
  deleteDocument as deleteDocumentApi,
  ingestFile as ingestFileApi,
  ingestUrl as ingestUrlApi,
  listConversations,
  listDocuments,
} from "@/services/api";
import type {
  Conversation,
  DocumentInfo,
  IngestResponse,
} from "@/types";

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

  const ingestFile = useCallback(async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const result = await ingestFileApi(file);
      setLastIngest(result);
      await refresh();
      return result;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Upload failed.";
      setError(message);
      throw new Error(message);
    } finally {
      setUploading(false);
    }
  }, [refresh]);

  const ingestUrl = useCallback(async (url: string) => {
    setUploading(true);
    setError(null);
    try {
      const result = await ingestUrlApi(url);
      setLastIngest(result);
      await refresh();
      return result;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "URL ingest failed.";
      setError(message);
      throw new Error(message);
    } finally {
      setUploading(false);
    }
  }, [refresh]);

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
    refresh,
    ingestFile,
    ingestUrl,
    deleteDocument,
    clearError,
  };
}
