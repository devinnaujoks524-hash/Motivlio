"use client";

import { useActionState, useState } from "react";
import { decide } from "@/app/actions/public";
import { Alert, Field, btnAccent, btnSecondary, inputCls } from "@/components/ui";
import { APPROVAL_TEXT } from "@/lib/config";

export function DecisionForm({ token }: { token: string }) {
  const [mode, setMode] = useState<"choose" | "approve" | "changes">("choose");
  const [state, action, pending] = useActionState(decide.bind(null, token), null);

  if (state?.ok === "approved") {
    return <Alert kind="ok"><strong>Vielen Dank – Ihre Freigabe wurde gespeichert.</strong> Sie erhalten eine Bestätigung per E-Mail.</Alert>;
  }
  if (state?.ok === "changes_requested") {
    return <Alert kind="ok"><strong>Ihr Änderungswunsch wurde übermittelt.</strong> Der Betrieb meldet sich mit einer neuen Version.</Alert>;
  }

  return (
    <div className="space-y-4">
      {mode === "choose" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => setMode("changes")} className={btnSecondary}>Änderungen anfordern</button>
          <button type="button" onClick={() => setMode("approve")} className={btnAccent}>Diese Version freigeben</button>
        </div>
      )}
      {mode !== "choose" && (
        <form action={action} className="fade-in space-y-4 rounded-xl border border-line bg-white p-5">
          {mode === "approve" ? (
            <>
              <input type="hidden" name="decision" value="approve" />
              <Field label="Ihr vollständiger Name" htmlFor="name">
                <input id="name" name="name" required minLength={2} autoComplete="name" className={inputCls} />
              </Field>
              <Field label="Anmerkung (optional)" htmlFor="comment"><textarea id="comment" name="comment" rows={2} className={inputCls} /></Field>
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" name="confirmed" required className="mt-1 size-5 shrink-0 accent-[var(--accent)]" />
                <span>{APPROVAL_TEXT}</span>
              </label>
            </>
          ) : (
            <>
              <input type="hidden" name="decision" value="request_changes" />
              <Field label="Was soll geändert werden?" htmlFor="comment">
                <textarea id="comment" name="comment" rows={4} required minLength={3} className={inputCls} />
              </Field>
              <Field label="Ihr Name (optional)" htmlFor="name"><input id="name" name="name" autoComplete="name" className={inputCls} /></Field>
            </>
          )}
          {state?.error && <Alert kind="error">{state.error}</Alert>}
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <button type="button" onClick={() => setMode("choose")} className={btnSecondary} disabled={pending}>Zurück</button>
            <button type="submit" disabled={pending} className={btnAccent}>
              {pending ? "Wird gespeichert …" : mode === "approve" ? "Freigabe bestätigen" : "Änderungswunsch senden"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
