"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AgentOrb } from "@/components/ChatMessage";
import { registerUser } from "@/services/api";

/**
 * Register page: email + password. The password policy (12-72 chars,
 * upper, lower, digit, symbol) is enforced by the backend and its
 * message is shown here when the password does not qualify. The first
 * account to register claims the documents ingested before auth
 * landed; later accounts start with an empty library.
 */
export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await registerUser(email.trim(), password);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
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
            Create an account
          </h2>
          <p className="mt-1 text-sm text-mist-500">
            Passwords need 12–72 characters, with an upper-case letter, a
            lower-case letter, a digit, and a symbol.
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
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="12+ characters, mixed case, digit, symbol"
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-ink-900 px-3.5 py-2.5 text-[15px] text-mist-100 placeholder:text-mist-600 focus:border-accent-500/60 focus:outline-none"
          />
          <label
            className="mt-4 block text-sm font-medium text-mist-300"
            htmlFor="confirm"
          >
            Confirm password
          </label>
          <input
            id="confirm"
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repeat your password"
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-ink-900 px-3.5 py-2.5 text-[15px] text-mist-100 placeholder:text-mist-600 focus:border-accent-500/60 focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy}
            className="mt-6 w-full rounded-xl bg-gradient-to-br from-accent-500 to-accent-700 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:from-accent-400 hover:to-accent-600 disabled:opacity-40"
          >
            {busy ? "Creating account…" : "Create account"}
          </button>
          <p className="mt-4 text-center text-sm text-mist-500">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-accent-300 hover:text-accent-200"
            >
              Log in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
