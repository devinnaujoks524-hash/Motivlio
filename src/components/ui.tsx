import type { ComponentProps, ReactNode } from "react";
import { ORDER_STATUS_LABEL, VERSION_STATUS_LABEL } from "@/lib/domain";

export const btn =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";
export const btnPrimary = `${btn} border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-700`;
export const btnAccent = `${btn} border-accent bg-accent text-white hover:bg-accent-strong`;
export const btnSecondary = `${btn} border-line bg-white text-neutral-900 hover:bg-neutral-100`;
export const btnDanger = `${btn} border-red-200 bg-white text-red-700 hover:bg-red-50`;

export const inputCls =
  "block w-full min-h-11 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base sm:text-sm placeholder:text-neutral-400 focus:border-accent";

export function Card({ className = "", ...p }: ComponentProps<"section">) {
  return <section className={`rounded-xl border border-line bg-white p-5 sm:p-6 ${className}`} {...p} />;
}

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-neutral-800">{label}</label>
      {children}
      {hint && <p className="text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}

export function Alert({ kind, children }: { kind: "error" | "ok" | "info"; children: ReactNode }) {
  const cls = {
    error: "border-red-200 bg-red-50 text-red-800",
    ok: "border-emerald-200 bg-emerald-50 text-emerald-900",
    info: "border-line bg-neutral-50 text-neutral-700",
  }[kind];
  return (
    <div role={kind === "error" ? "alert" : "status"} className={`fade-in rounded-lg border px-4 py-3 text-sm ${cls}`}>
      {children}
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-neutral-100 text-neutral-700",
  waiting: "bg-amber-50 text-amber-800 ring-amber-200",
  pending: "bg-amber-50 text-amber-800 ring-amber-200",
  changes_requested: "bg-orange-50 text-orange-800 ring-orange-200",
  approved: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  archived: "bg-neutral-100 text-neutral-500",
  superseded: "bg-neutral-100 text-neutral-500",
};

export function StatusBadge({ status, kind = "order" }: { status: string; kind?: "order" | "version" }) {
  const labels = (kind === "order" ? ORDER_STATUS_LABEL : VERSION_STATUS_LABEL) as Record<string, string>;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ring-transparent ${STATUS_STYLE[status] ?? ""}`}>
      {labels[status] ?? status}
    </span>
  );
}

export function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-10 text-center">
      <p className="font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-neutral-600">{text}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, children, subtitle }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-neutral-600">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}
