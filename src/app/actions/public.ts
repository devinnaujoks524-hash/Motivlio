"use server";

import { revalidatePath } from "next/cache";
import { APPROVAL_TEXT } from "@/lib/config";
import { decisionSchema } from "@/lib/domain";
import { notifyDecision } from "@/lib/notify";
import { rateLimit } from "@/lib/ratelimit";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashToken, isPlausibleToken } from "@/lib/tokens";
import type { FormState } from "./types";

/**
 * Entscheidung des Kunden über den privaten Link. Die eigentliche Prüfung (aktuelle Version,
 * genau einmal, Freigabetext) passiert atomar in der Datenbankfunktion public_decide.
 */
export async function decide(token: string, _: FormState, fd: FormData): Promise<FormState> {
  if (!isPlausibleToken(token)) return { error: "Dieser Link ist ungültig." };
  if (!(await rateLimit("decide", 20, 600, false))) {
    return { error: "Zu viele Versuche. Bitte warten Sie einige Minuten und versuchen Sie es dann erneut." };
  }
  const parsed = decisionSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Bitte prüfen Sie Ihre Eingaben." };

  const input = parsed.data;
  const { data, error } = await createAdminClient().rpc("public_decide", {
    p_token_hash: hashToken(token),
    p_decision: input.decision,
    p_name: input.name || null,
    p_comment: input.comment || null,
    // Nur der serverseitig fest hinterlegte Text kann bestätigt werden.
    p_text: input.decision === "approve" ? APPROVAL_TEXT : null,
  });
  if (error) return { error: "Ihre Eingabe konnte nicht gespeichert werden. Bitte versuchen Sie es erneut." };

  const result = data as { result: string; version_id?: string };
  revalidatePath(`/f/${token}`);
  if (result.result === "approved" || result.result === "changes_requested") {
    await notifyDecision(result.version_id!, result.result);
    return { ok: result.result };
  }
  // Veraltet, bereits entschieden oder Link nicht mehr gültig: Seite neu laden zeigt den klaren Zustand.
  return { error: "Diese Version kann nicht mehr bearbeitet werden. Bitte laden Sie die Seite neu." };
}
