import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { CONFIRMED_LIVE_COST, DEFAULT_COSTS } from "@/lib/businessCosts";
import { CostCalculator } from "@/components/admin/CostCalculator";
import { PageHeader, PageShell } from "@/components/ui";

/**
 * Costs & break-even (admin only). The admin check happens here on the server before anything is sent: anyone else
 * gets the same "Page not found" as the dashboard, and the business assumptions only reach admins (as props).
 */
export default async function CostsPage() {
  const h = await headers();
  const user = await getCurrentUser(new Request("https://virm.local/admin/costs", { headers: h })).catch(() => null);

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
        <PageHeader
          label="Admin"
          title="Costs & break-even"
          description="Estimates only, not guaranteed profits. Change any assumption; your changes stay in this browser."
          back={{ href: "/admin", label: "Dashboard" }}
        />
        <CostCalculator defaults={DEFAULT_COSTS} confirmedLiveCost={CONFIRMED_LIVE_COST} />
      </PageShell>
    </main>
  );
}
