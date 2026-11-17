"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/** My Closet lives in Studio now: this address opens Studio with the closet showing (?add=1 opens Add clothes). */
export default function ClosetAddress() {
  const router = useRouter();
  const searchParams = useSearchParams();
  useEffect(() => {
    router.replace(`/studio?closet=1${searchParams.get("add") === "1" ? "&add=1" : ""}`);
  }, [router, searchParams]);
  return <main className="flex-1" />;
}
