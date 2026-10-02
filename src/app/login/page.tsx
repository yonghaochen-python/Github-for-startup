"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

export default function LoginPage() {
  const { completeLogin } = useAuth();
  const [devLogin, setDevLogin] = useState(false);

  useEffect(() => {
    fetch("/api/config")
      .then((res) => res.json() as Promise<{ devLogin?: boolean }>)
      .then((data) => setDevLogin(Boolean(data.devLogin)))
      .catch(() => {});
  }, []);

  async function handleDevLogin() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/dev-login", { method: "POST" });
      if (!res.ok) throw new Error("Dev login isn't available here.");
      completeLogin("Developer access enabled.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  const [creating, setCreating] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/auth/${creating ? "signup" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      completeLogin(creating ? "Your Virtual Mirror is ready." : "Welcome back to your wardrobe.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <main className="relative grid min-h-screen flex-1 lg:grid-cols-[1.12fr_.88fr]">
      <Link
        href="/"
        className="font-display absolute left-6 top-7 z-10 text-[28px] tracking-[-0.7px] text-[#202529] lg:left-[42px] lg:top-[31px] lg:text-[31px] lg:text-[#f8fafb] lg:[text-shadow:0_2px_16px_#14202b77]"
      >
        Virtual <em className="font-normal">Mirror</em>
      </Link>

      <section
        className="relative hidden min-h-screen overflow-hidden lg:block"
        style={{ background: "#9ba5aa url('/chrome-flow.png') center/cover" }}
      >
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: "linear-gradient(180deg, #17232d19, #17232d12 50%, #131d26a1)" }}
        />
        <div className="absolute inset-[11%_10%_12%_12%] z-[1] overflow-hidden rounded-[8px] border border-white/55 shadow-[20px_25px_55px_#1019234f]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://images.unsplash.com/photo-1715559522419-db7face19c1c?auto=format&fit=crop&w=1200&q=85"
            alt="A person wearing a curated neutral outfit"
            className="h-full w-full object-cover grayscale-[.68] contrast-[1.05]"
          />
        </div>
        <div className="absolute bottom-[7%] left-[7%] z-[2] text-white">
          <span className="text-[8px] font-bold tracking-[2px]">YOUR WARDROBE, INTELLIGENTLY STYLED</span>
          <h1
            className="mt-3.5 font-medium leading-[1.02] tracking-[-2.5px]"
            style={{ fontSize: "clamp(48px, 5vw, 76px)" }}
          >
            Wear more of
            <br />
            <em className="font-display font-normal text-[#dce3e6]">what you love.</em>
          </h1>
        </div>
        <span className="absolute right-6 top-[30px] z-[2] text-[8px] font-bold tracking-[1.4px] text-[#f4f7f8] [writing-mode:vertical-rl]">
          VM / MEMBER ACCESS / 2025
        </span>
      </section>

      <section
        className="relative flex min-h-screen items-center justify-center px-6 pb-20 pt-28 sm:px-[clamp(45px,7vw,110px)] lg:py-8"
        style={{ background: "linear-gradient(135deg, #f9fdff 0%, #e8f0f4 55%, #f1e7e9 82%, #f2ede3 100%)" }}
      >
        <Link
          href="/"
          className="absolute right-6 top-8 text-[10px] font-bold text-[#6e7b82] hover:text-[#29343a] lg:left-[39px] lg:right-auto lg:top-[34px]"
        >
          ← Back to explore
        </Link>

        <form onSubmit={handleSubmit} className="w-full max-w-[430px]">
          <p className="text-[10px] font-bold uppercase tracking-[2.2px] text-[#7e888e]">
            {creating ? "Create your wardrobe" : "Member access"}
          </p>
          <h2 className="font-display mb-3 mt-4 text-[44px] font-normal tracking-[-1.4px] text-[#1c2328] sm:text-[55px]">
            {creating ? "Begin with your closet." : "Welcome back."}
          </h2>
          <p className="mb-9 text-xs leading-[1.75] text-[#7c878d]">
            {creating
              ? "Create an account to build your digital closet and discover new ways to wear it."
              : "Sign in to return to your closet, saved looks, and personal AI stylist."}
          </p>

          <label className="mt-5 flex flex-col gap-2.5 text-[8px] font-bold tracking-[1.6px] text-[#7f8a90]">
            EMAIL ADDRESS
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="h-[49px] w-full rounded-[3px] border border-[#d3dbde] bg-white px-3.5 text-xs font-normal tracking-normal text-[#29343a] outline-none focus:border-[#78878f] focus:shadow-[0_0_0_3px_#c8d1d536]"
            />
          </label>
          <label className="mt-5 flex flex-col gap-2.5 text-[8px] font-bold tracking-[1.6px] text-[#7f8a90]">
            PASSWORD
            <input
              type="password"
              required
              minLength={8}
              autoComplete={creating ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={creating ? "At least 8 characters" : "Enter your password"}
              className="h-[49px] w-full rounded-[3px] border border-[#d3dbde] bg-white px-3.5 text-xs font-normal tracking-normal text-[#29343a] outline-none focus:border-[#78878f] focus:shadow-[0_0_0_3px_#c8d1d536]"
            />
          </label>

          {error && <p className="mt-4 text-xs text-red-700">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="btn-tactile mt-8 flex h-[52px] w-full items-center justify-between rounded-[4px] border border-[#283239] bg-[#283239] px-[17px] text-[11px] font-bold text-white shadow-[inset_0_1px_#ffffff33] hover:bg-[#414d54] disabled:opacity-60"
          >
            {submitting ? "Please wait…" : creating ? "Create My Closet" : "Enter Virtual Mirror"}
            <span aria-hidden className="text-base">
              →
            </span>
          </button>

          {devLogin && (
            <>
              <div className="my-5 flex items-center gap-3 text-[8px] font-bold tracking-[1.6px] text-[#a0a9ad]">
                <span className="h-px flex-1 bg-[#d3dbde]" />
                OR
                <span className="h-px flex-1 bg-[#d3dbde]" />
              </div>
              <button
                type="button"
                onClick={handleDevLogin}
                disabled={submitting}
                className="btn-tactile flex h-[48px] w-full items-center justify-between rounded-[4px] border border-[#cbd7dc] bg-white/70 px-[17px] text-[11px] font-bold text-[#3b4850] hover:bg-white disabled:opacity-60"
              >
                Continue with dev account
                <span className="text-[8px] tracking-[1.4px] text-[#8b959a]">NO PASSWORD</span>
              </button>
            </>
          )}

          <div className="mt-6 flex justify-center gap-[7px] text-[10px] text-[#8b959a]">
            <span>{creating ? "Already have an account?" : "New to Virtual Mirror?"}</span>
            <button
              type="button"
              onClick={() => {
                setCreating((v) => !v);
                setError(null);
              }}
              className="border-0 border-b border-[#8f9a9f] pb-0.5 font-bold text-[#48565d]"
            >
              {creating ? "Sign in" : "Create an account"}
            </button>
          </div>
        </form>

        <p className="absolute bottom-[26px] text-[7px] font-bold tracking-[1.4px] text-[#a0a9ad]">
          PRIVATE BY DESIGN · YOUR CLOSET STAYS YOURS
        </p>
      </section>
    </main>
  );
}
