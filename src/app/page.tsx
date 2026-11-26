"use client";

import { useAuth } from "@/components/AuthProvider";
import { MyStyle } from "@/components/mystyle/MyStyle";
import { Welcome } from "@/components/Welcome";
import { LandingTest } from "@/components/landing/LandingTest";
import { LANDING_TEST_ON } from "@/lib/landingTest";

/**
 * Virm's first page. Signed in: My Style (your next step, today's outfit, picks from your closet, Style it, and a
 * little inspiration from Discover). Signed out: landing A or B while the landing test is on (lib/landingTest),
 * otherwise the welcome page, with Try it free.
 */
export default function MyStylePage() {
  const { status } = useAuth();
  if (status === "signedOut") return LANDING_TEST_ON ? <LandingTest /> : <Welcome />;
  if (status !== "signedIn") return <main className="flex-1" />;
  return <MyStyle />;
}
