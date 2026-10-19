"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** AI Stylist now lives in the Studio. */
export default function OutfitsRedirect() {
  const router = useRouter();
  useEffect(() => router.replace("/studio"), [router]);
  return <main className="flex-1" />;
}
