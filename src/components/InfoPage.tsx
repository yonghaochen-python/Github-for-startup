import { PageHeader, PageShell } from "@/components/ui";

/** A plain reading page (About, Privacy, Terms…): a title, then the text on a white card. */
export function InfoPage({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <main className="flex-1 pb-16">
      <PageShell>
        <PageHeader title={title} description={description} />
        <article className="info-prose max-w-3xl rounded-[22px] bg-white p-6 text-[15px] leading-[1.75] text-[#26313a] shadow-[0_1px_0_rgba(18,24,33,0.03),0_14px_36px_rgba(18,30,45,0.06)] sm:p-10">
          {children}
        </article>
      </PageShell>
    </main>
  );
}
