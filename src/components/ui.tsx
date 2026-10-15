import Link from "next/link";
import { ArrowLeftIcon } from "@/components/Icons";

/** Shared button looks: one dark primary action per screen, quiet secondary actions around it. */
export const btnPrimary =
  "btn-tactile inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[5px] bg-[#1c2328] px-5 py-2.5 text-[12.5px] font-semibold text-white shadow-[inset_0_1px_0_#ffffff30,0_6px_18px_rgba(28,35,40,0.18)] hover:bg-[#35414a] disabled:opacity-50";
export const btnSecondary =
  "btn-tactile inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[5px] border border-[#c3cfd4] bg-white/70 px-5 py-2.5 text-[12.5px] font-semibold text-[#26313a] hover:border-[#9fadb4] hover:bg-white disabled:opacity-50";
export const btnText =
  "inline-flex min-h-[44px] items-center gap-1.5 text-[12.5px] font-semibold text-[#26313a] underline-offset-4 hover:underline";

export const eyebrow = "text-[10px] font-bold uppercase tracking-[2.6px] text-[#7e888e]";

/** Page width + side padding used by every page. */
export function PageShell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1280px] px-5 sm:px-8 ${className}`}>{children}</div>;
}

/** Every main page starts the same way: where you are, what this page does, and its main action. */
export function PageHeader({
  label,
  title,
  description,
  actions,
  back,
}: {
  label?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="pb-7 pt-7 sm:pb-9 sm:pt-10">
      {back && (
        <Link href={back.href} className="mb-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#5f6a70] hover:text-[#1c2328]">
          <ArrowLeftIcon className="h-4 w-4" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          {label && <p className={`${eyebrow} mb-2`}>{label}</p>}
          <h1 className="font-display text-[40px] font-normal leading-[1.02] tracking-[-1.2px] text-[#1c2328] sm:text-[52px]">
            {title}
          </h1>
          {description && <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-[#5f6a70]">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
      </div>
    </header>
  );
}

/** A friendly "nothing here yet" panel that always says what to do next. */
export function EmptyState({
  title,
  body,
  action,
  children,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-4 border border-dashed border-[#b8c4ca] bg-white/50 px-6 py-10 sm:px-10 sm:py-14">
      {children}
      <h2 className="font-display text-[30px] font-normal leading-tight text-[#1c2328]">{title}</h2>
      <p className="max-w-md text-[13.5px] leading-relaxed text-[#5f6a70]">{body}</p>
      {action}
    </div>
  );
}

/** Small numbered "how this works" steps shown near the controls they describe. */
export function Steps({ steps }: { steps: string[] }) {
  return (
    <ol className="flex flex-wrap gap-x-6 gap-y-2 text-[12px] text-[#5f6a70]">
      {steps.map((step, i) => (
        <li key={step} className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[#b8c4ca] text-[10px] font-bold text-[#3b4850]">
            {i + 1}
          </span>
          {step}
        </li>
      ))}
    </ol>
  );
}

/** A visible error message with an optional way out. */
export function ErrorNote({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-[5px] border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
      {message}
    </p>
  );
}
