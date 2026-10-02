"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { HeroBlob } from "@/components/HeroBlob";

const MODELS = {
  female: {
    src: "https://images.unsplash.com/photo-1585685674190-5b11f080af33?auto=format&fit=crop&w=900&q=80",
    alt: "A woman in a white shirt and black denim jeans, seated in a soft studio",
    index: "01",
    pieces: "White shirt · Black denim",
  },
  male: {
    src: "https://images.unsplash.com/photo-1788500304887-6711fead4b54?auto=format&fit=crop&w=900&q=80",
    alt: "A man in a rust tee and stone shorts with a jacket over his shoulders, in a soft studio",
    index: "02",
    pieces: "Rust tee · Stone shorts",
  },
};

function ModelPanel({ model, className = "" }: { model: (typeof MODELS)[keyof typeof MODELS]; className?: string }) {
  return (
    <figure className={`group relative ${className}`}>
      <div
        className="relative aspect-[4/5.4] overflow-hidden border bg-[#e9e6e1]"
        style={{ borderColor: "#ffffffb0", boxShadow: "0 28px 60px rgba(20,32,40,0.16)" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={model.src}
          alt={model.alt}
          className="h-full w-full object-cover object-top saturate-[.9] transition-transform duration-700 ease-out group-hover:scale-[1.03]"
        />
      </div>
      <figcaption className="mt-3 flex items-baseline gap-3 text-[9px] font-bold tracking-[1.6px] text-[#7e888e]">
        <span className="text-[#29343a]">{model.index}</span>
        <span className="uppercase">{model.pieces}</span>
      </figcaption>
    </figure>
  );
}

export default function LoginPage() {
  const { completeLogin } = useAuth();
  const [devLogin, setDevLogin] = useState(false);
  const [creating, setCreating] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    <main className="relative flex min-h-screen flex-1 flex-col overflow-hidden">
      <HeroBlob variant="frost" className="-left-[10%] top-[-12%] h-[60%] w-[34%] opacity-40" />
      <HeroBlob variant="mercury" className="-right-[12%] bottom-[-18%] h-[70%] w-[36%] opacity-40" />

      <header className="relative z-10 flex items-center justify-between px-6 pt-7 sm:px-10 lg:px-[42px] lg:pt-[31px]">
        <Link href="/" className="font-display text-[28px] leading-none tracking-[-0.7px] text-[#202529] lg:text-[32px]">
          Virtual <em className="font-normal">Mirror</em>
        </Link>
        <Link href="/" className="text-[10px] font-bold text-[#6e7b82] hover:text-[#29343a]">
          ← Back to explore
        </Link>
      </header>

      <div className="relative z-10 mx-auto grid w-full max-w-[1480px] flex-1 items-center gap-x-[clamp(24px,4vw,72px)] gap-y-8 px-6 pb-16 pt-8 sm:px-10 lg:grid-cols-[1fr_minmax(340px,430px)_1fr] lg:pt-4">
        {/* Phone/tablet: both models as a cropped strip above the form, never covering it. */}
        <div className="grid grid-cols-2 gap-3 lg:hidden">
          {[MODELS.female, MODELS.male].map((m) => (
            <div key={m.index} className="relative h-44 overflow-hidden border border-white/70 bg-[#e9e6e1] sm:h-60">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.src} alt={m.alt} className="h-full w-full object-cover object-top saturate-[.9]" />
            </div>
          ))}
        </div>

        <ModelPanel model={MODELS.female} className="hidden max-w-[470px] justify-self-end lg:block lg:-translate-y-6" />

        <form
          onSubmit={handleSubmit}
          className="mx-auto w-full max-w-[430px] border bg-white/55 p-7 backdrop-blur-sm sm:p-9"
          style={{ borderColor: "#cbd7dcb0", boxShadow: "0 18px 44px rgba(20,32,40,0.07)" }}
        >
          <p className="text-[10px] font-bold uppercase tracking-[2.2px] text-[#7e888e]">
            {creating ? "Create your wardrobe" : "Member access"}
          </p>
          <h1 className="font-display mb-3 mt-4 text-[44px] font-normal leading-none tracking-[-1.4px] text-[#1c2328] sm:text-[52px]">
            {creating ? "Begin with your closet." : "Welcome back."}
          </h1>
          <p className="mb-8 text-xs leading-[1.75] text-[#7c878d]">
            {creating
              ? "Create an account to build your digital closet and discover new ways to wear it."
              : "Sign in to return to your closet, saved looks, and personal AI stylist."}
          </p>

          <label className="flex flex-col gap-2.5 text-[8px] font-bold tracking-[1.6px] text-[#7f8a90]">
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
            className="btn-tactile mt-7 flex h-[52px] w-full items-center justify-between rounded-[4px] border border-[#283239] bg-[#283239] px-[17px] text-[11px] font-bold text-white shadow-[inset_0_1px_#ffffff33] hover:bg-[#414d54] disabled:opacity-60"
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

        <ModelPanel model={MODELS.male} className="hidden max-w-[470px] justify-self-start lg:block lg:translate-y-10" />
      </div>

      <p className="relative z-10 pb-6 text-center text-[7px] font-bold tracking-[1.4px] text-[#a0a9ad]">
        PRIVATE BY DESIGN · YOUR CLOSET STAYS YOURS
      </p>
    </main>
  );
}
