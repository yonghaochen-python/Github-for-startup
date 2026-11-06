import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { STORE_PREVIEWS, type PlaceholderKind } from "@/lib/storeFeeds";
import { PageHeader, PageShell } from "@/components/ui";

/**
 * Store Preview (admin only). The admin check happens here on the server before anything is sent, so anyone else
 * gets the same "Page not found" as the dashboard. Every card is a labelled placeholder: no brand has given
 * permission or a product feed yet (see lib/storeFeeds).
 */

/** A soft outline of the kind of piece, standing in for a product picture. */
function Outline({ kind }: { kind: PlaceholderKind }) {
  const path: Record<PlaceholderKind, string> = {
    Top: "M22 14l10-6h16l10 6 10 12-10 6v38H22V32l-10-6z",
    Bottom: "M26 10h28l4 62H44l-4-40-4 40H22z",
    Outerwear: "M22 12l12-6 6 8 6-8 12 6 8 16-8 4v40H22V32l-8-4z",
    Dress: "M30 8h20l-2 14 14 50H18l14-50z",
    Shoes: "M10 50c0-6 4-10 10-10l14-2 8-10h10l4 14c8 2 14 6 14 12v4H10z",
    Accessory: "M24 30h32l4 40H20zM32 30v-8a8 8 0 0 1 16 0v8",
  };
  return (
    <svg viewBox="0 0 80 80" className="h-16 w-16 text-[#121821]/15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
      <path d={path[kind]} />
    </svg>
  );
}

export default async function StorePreviewPage() {
  const h = await headers();
  const user = await getCurrentUser(new Request("https://virm.local/admin/store-preview", { headers: h })).catch(() => null);

  if (!user || user.role !== "admin") {
    return (
      <main className="flex-1">
        <PageShell>
          <PageHeader title="Page not found" description="This page doesn't exist." />
        </PageShell>
      </main>
    );
  }

  return (
    <main className="flex-1 pb-20">
      <PageShell>
        <PageHeader label="Admin" title="Store Preview" back={{ href: "/admin", label: "Dashboard" }} />
        <p className="-mt-2 mb-10 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[1.4px] text-[#5d6874] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.08)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#a8801a]" aria-hidden /> Preview, not partners · placeholders only
        </p>

        <div className="flex flex-col gap-12">
          {STORE_PREVIEWS.map((store) => (
            <section key={store.id} aria-labelledby={`store-${store.id}`}>
              <div className="mb-4 flex items-baseline justify-between gap-4">
                <h2 id={`store-${store.id}`} className="font-display text-[30px] font-normal leading-none tracking-[-0.5px] text-[#121821] sm:text-[36px]">
                  {store.name}
                </h2>
                <span className="text-[11px] font-semibold uppercase tracking-[1.4px] text-[#5d6874]">No permission yet</span>
              </div>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {store.slots.map((kind) => (
                  <li key={kind}>
                    <div className="flex aspect-[3/4] items-center justify-center rounded-[18px] border border-dashed border-black/[0.12] bg-white/60">
                      <Outline kind={kind} />
                    </div>
                    <p className="mt-2.5 text-[10px] font-semibold uppercase tracking-[1.6px] text-[#5d6874]">Placeholder</p>
                    <p className="text-[13px] font-medium text-[#121821]">Sample {kind.toLowerCase()}</p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </PageShell>
    </main>
  );
}
