import { Pricing } from "@/components/Pricing";
import { PageHeader, PageShell } from "@/components/ui";

/** Planned pricing, shown for feedback. Display only: nothing can be bought here yet. */
export default function PricingPage() {
  return (
    <main className="flex-1 pb-20">
      <PageShell>
        <PageHeader label="Pricing" title="Choose your mirror" description="Start free. Upgrade when you want more try-ons, live." />
        <Pricing />
      </PageShell>
    </main>
  );
}
