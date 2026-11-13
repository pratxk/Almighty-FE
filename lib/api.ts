/**
 * Backwards-compatible re-export of the typed API client.
 * New code should import from "@/services/api" (and "@/services/runs"
 * for run inspection); this module exists so `lib/api` stays a valid
 * import path per the original layout.
 */
export * from "@/services/api";
export { getRun } from "@/services/runs";
