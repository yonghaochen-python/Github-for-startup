import Link from "next/link";
import { ArrowLeftIcon } from "@/components/Icons";

/** Shared button looks: one dark primary action per screen, quiet secondary actions around it. */
export const btnPrimary =
  "btn-tactile inline-flex min-h-[46px] items-center justify-center gap-2 rounded-full bg-[#121821] px-6 py-2.5 text-[13.5px] font-medium text-white hover:bg-[#2a3542] disabled:opacity-50";
export const btnSecondary =
  "btn-tactile inline-flex min-h-[46px] items-center justify-center gap-2 rounded-full bg-white px-6 py-2.5 text-[13.5px] font-medium text-[#121821] shadow-[inset_0_0_0_1px_rgba(18,24,33,0.14)] hover:shadow-[inset_0_0_0_1px_rgba(18,24,33,0.3)] disabled:opacity-50";
export const btnText =
  "inline-flex min-h-[44px] items-center gap-1.5 text-[13px] font-medium text-[#121821] underline-offset-4 hover:underline";

export const eyebrow = "text-[11px] font-medium uppercase tracking-[2.2px] text-[#6b7783]";

/** The standard surface: white, softly lifted, rounded — instead of bordered boxes. */
export const surface = "rounded-[22px] bg-white shadow-[0_1px_0_rgba(18,24,33,0.03),0_14px_36px_rgba(18,30,45,0.06)]";

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
    <header className="pb-8 pt-8 sm:pb-10 sm:pt-12">
      {back && (
        <Link href={back.href} className="mb-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#4f5b66] hover:text-[#121821]">
          <ArrowLeftIcon className="h-4 w-4" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          {label && <p className={`${eyebrow} mb-2`}>{label}</p>}
          <h1 className="font-display text-[44px] font-normal leading-[1] tracking-[-1.4px] text-[#121821] sm:text-[60px]">
            {title}
          </h1>
          {description && <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-[#4f5b66]">{description}</p>}
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
    <div className="flex flex-col items-start gap-4 rounded-[22px] bg-white px-6 py-10 shadow-[0_1px_0_rgba(18,24,33,0.03),0_14px_36px_rgba(18,30,45,0.06)] sm:px-10 sm:py-14">
      {children}
      <h2 className="font-display text-[34px] font-normal leading-tight text-[#121821]">{title}</h2>
      <p className="max-w-md text-[14.5px] leading-relaxed text-[#4f5b66]">{body}</p>
      {action}
    </div>
  );
}

/** Small numbered "how this works" steps shown near the controls they describe. */
export function Steps({ steps }: { steps: string[] }) {
  return (
    <ol className="flex flex-wrap gap-x-6 gap-y-2 text-[12px] text-[#4f5b66]">
      {steps.map((step, i) => (
        <li key={step} className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#121821] text-[10px] font-semibold text-white">
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
    <p role="alert" className="rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
      {message}
    </p>
  );
}
