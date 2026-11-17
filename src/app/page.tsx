"use client";

import { useAuth } from "@/components/AuthProvider";
import { MyStyle } from "@/components/mystyle/MyStyle";
import { Welcome } from "@/components/Welcome";

/**
 * Virm's first page. Signed in: My Style (your next step, today's outfit, picks from your closet, Style it, and a
 * little inspiration from Discover). Signed out: the welcome page, with Try it free.
 */
export default function MyStylePage() {
  const { status } = useAuth();
  if (status === "signedOut") return <Welcome />;
  if (status !== "signedIn") return <main className="flex-1" />;
  return <MyStyle />;
}
