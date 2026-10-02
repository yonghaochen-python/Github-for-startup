"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

type Outfit = { id: string; isFavorite: boolean };

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const [closetCount, setClosetCount] = useState<number | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  useEffect(() => {
    let ignore = false;
    fetch("/api/closet/items")
      .then(async (res) => {
        if (ignore || !res.ok) return;
        const data = (await res.json()) as { items?: unknown[] };
        setClosetCount((data.items ?? []).length);
      })
      .catch(() => {});
    fetch("/api/outfits")
      .then(async (res) => {
        if (ignore || !res.ok) return;
        const data = (await res.json()) as { outfits?: Outfit[] };
        setSavedCount((data.outfits ?? []).filter((o) => o.isFavorite).length);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);

  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : "";

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 px-6 py-16 sm:px-8">
      <div
        className="mx-auto w-full max-w-[460px] border p-10 sm:p-12"
        style={{
          background: "linear-gradient(135deg, #f8fbfc 0%, #e4edf1 52%, #f3e9eb 78%, #f2ede3 100%)",
          borderColor: "#cbd8dd",
        }}
      >
        <div
          className="mb-10 flex h-[90px] w-[90px] items-center justify-center rounded-full border text-[27px] font-bold text-[#46555d]"
          style={{ borderColor: "#c1cdd2", background: "linear-gradient(145deg, #fcfefe, #bfcbd0 52%, #ecf1f3)" }}
        >
          {initials}
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[3px] text-[#7e888e]">Your style space</p>
        <h1 className="font-display mt-3 text-[40px] font-normal leading-none break-all text-[#1c2328] sm:text-[47px]">
          {user?.email ?? "…"}
        </h1>
        <p className="mt-3 text-xs text-[#788574]">Every good outfit starts with being yourself.</p>

        <div className="mt-16 flex gap-12 border-t pt-7" style={{ borderColor: "#d0dadd" }}>
          <div className="flex flex-col gap-1.5">
            <strong className="font-display text-[34px] font-normal text-[#1c2328]">{closetCount ?? "—"}</strong>
            <span className="text-[9px] tracking-[1.3px] text-[#818e7d]">CLOSET ITEMS</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <strong className="font-display text-[34px] font-normal text-[#1c2328]">{savedCount ?? "—"}</strong>
            <span className="text-[9px] tracking-[1.3px] text-[#818e7d]">SAVED LOOKS</span>
          </div>
        </div>

        <button
          onClick={logout}
          className="btn-tactile mt-8 border-0 border-b pb-1 text-[9px] font-bold tracking-[0.5px] text-[#667279] hover:border-[#29343a] hover:text-[#29343a]"
          style={{ borderColor: "#9ca6aa" }}
        >
          Log out of Virtual Mirror
        </button>
      </div>
    </main>
  );
}
