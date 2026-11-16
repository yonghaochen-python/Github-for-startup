"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** The feed's old address: Discover is the first page now (/), so links to /feed still land there. */
export default function OldFeedAddress() {
  const router = useRouter();
  useEffect(() => router.replace("/"), [router]);
  return <main className="flex-1" />;
}
