"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/** Try On now lives in the Studio (?change=1 still opens the photo change). */
export default function TryOnRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  useEffect(() => router.replace(searchParams.get("change") === "1" ? "/studio?change=1" : "/studio"), [router, searchParams]);
  return <main className="flex-1" />;
}
