"use client";

import { useActionState, useState, type ReactNode } from "react";
import type { FormState } from "@/app/actions/types";
import { Alert, btnPrimary } from "@/components/ui";

type Action = (state: FormState, fd: FormData) => Promise<FormState>;

/** Formular mit Server Action, Fehler-/Erfolgsanzeige und Schutz vor Doppelklick (pending). */
export function ActionForm({
  action, children, submit, submitClass = btnPrimary, className = "space-y-4", encType,
}: {
  action: Action;
  children: ReactNode;
  submit: string;
  submitClass?: string;
  className?: string;
  encType?: "multipart/form-data";
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className={className} encType={encType}>
      {children}
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.ok && !state.link && <Alert kind="ok">{state.ok}</Alert>}
      {state?.link && <LinkBox link={state.link} message={state.ok} />}
      <button type="submit" disabled={pending} className={submitClass}>
        {pending ? "Bitte warten …" : submit}
      </button>
    </form>
  );
}

export function LinkBox({ link, message }: { link: string; message?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="fade-in space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm">
      {message && <p className="text-emerald-900">{message}</p>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input readOnly value={link} aria-label="Privater Freigabelink" onFocus={(e) => e.currentTarget.select()}
          className="min-h-11 w-full rounded-lg border border-emerald-200 bg-white px-3 text-sm" />
        <button type="button" className="min-h-11 rounded-lg border border-emerald-300 bg-white px-4 text-sm font-medium"
          onClick={async () => { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
          {copied ? "Kopiert" : "Link kopieren"}
        </button>
      </div>
      <p className="text-xs text-emerald-900/80">Der Link ist ein privater Zugangsschlüssel – nur an den Kunden weitergeben.</p>
    </div>
  );
}
