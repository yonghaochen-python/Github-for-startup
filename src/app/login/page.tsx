"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/auth/${mode === "login" ? "login" : "signup"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      router.push("/closet");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-24">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">
        {mode === "login" ? "Log in" : "Create an account"}
      </h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        {mode === "login" ? "Welcome back to your closet." : "Your own private digital closet."}
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-black/15 bg-white px-4 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:bg-zinc-950 dark:focus:border-white/40"
        />
        <input
          type="password"
          required
          minLength={8}
          placeholder="Password (min 8 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-black/15 bg-white px-4 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:bg-zinc-950 dark:focus:border-white/40"
        />

        {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 rounded-full bg-black px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          {submitting ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
        </button>
      </form>

      <button
        onClick={() => {
          setMode(mode === "login" ? "signup" : "login");
          setError(null);
        }}
        className="mt-4 text-sm text-zinc-600 hover:underline dark:text-zinc-400"
      >
        {mode === "login" ? "Need an account? Sign up" : "Already have an account? Log in"}
      </button>
    </main>
  );
}
