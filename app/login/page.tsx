"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AgentOrb } from "@/components/ChatMessage";
import { loginUser } from "@/services/api";

/**
 * Login page: email + password, mirroring Elric's login flow.
 * On success the access token is kept in memory (services/api.ts)
 * and the user lands on the app. With no session the main page sends
 * the user back here (see app/page.tsx).
 */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await loginUser(email.trim(), password);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-900 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <AgentOrb />
          <h1 className="mt-4 font-display text-2xl font-bold tracking-tight text-mist-100">
            Almighty
          </h1>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.32em] text-aurum-400">
            Adaptive RAG
          </p>
        </div>
        <form
          onSubmit={handleSubmit}
          className="rounded-card border border-white/[0.07] bg-ink-800/70 p-6 shadow-card"
        >
          <h2 className="font-display text-lg font-semibold text-mist-100">
            Log in
          </h2>
          <p className="mt-1 text-sm text-mist-500">
            Your documents and chats belong to your account only.
          </p>
          {error && (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-sm text-danger"
            >
              {error}
            </div>
          )}
          <label
            className="mt-5 block text-sm font-medium text-mist-300"
            htmlFor="email"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-ink-900 px-3.5 py-2.5 text-[15px] text-mist-100 placeholder:text-mist-600 focus:border-accent-500/60 focus:outline-none"
          />
          <label
            className="mt-4 block text-sm font-medium text-mist-300"
            htmlFor="password"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-ink-900 px-3.5 py-2.5 text-[15px] text-mist-100 placeholder:text-mist-600 focus:border-accent-500/60 focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy}
            className="mt-6 w-full rounded-xl bg-gradient-to-br from-accent-500 to-accent-700 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:from-accent-400 hover:to-accent-600 disabled:opacity-40"
          >
            {busy ? "Logging in…" : "Log in"}
          </button>
          <p className="mt-4 text-center text-sm text-mist-500">
            No account yet?{" "}
            <Link
              href="/register"
              className="font-medium text-accent-300 hover:text-accent-200"
            >
              Create one
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
