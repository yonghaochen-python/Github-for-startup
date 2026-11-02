"use client";

import { useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

/** An outfit's try-on now opens in the Studio with that outfit loaded. */
export default function OutfitTryOnRedirect() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  useEffect(() => {
    const start = searchParams.get("start") === "1" ? "&start=1" : "";
    router.replace(`/studio?outfit=${encodeURIComponent(params.id)}${start}`);
  }, [router, params.id, searchParams]);
  return <main className="flex-1" />;
}
