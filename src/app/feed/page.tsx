"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** The feed's old address: Discover lives at /discover, so links to /feed still land there. */
export default function OldFeedAddress() {
  const router = useRouter();
  useEffect(() => router.replace("/discover"), [router]);
  return <main className="flex-1" />;
}
