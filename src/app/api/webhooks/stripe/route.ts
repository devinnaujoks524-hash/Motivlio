import type Stripe from "stripe";
import { requireEnv } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, planFromPriceId } from "@/lib/stripe";

export const runtime = "nodejs";

const RELEVANT = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

async function businessIdFor(admin: ReturnType<typeof createAdminClient>, sub: Stripe.Subscription) {
  if (sub.metadata?.business_id) return sub.metadata.business_id;
  const customer = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const { data } = await admin.from("subscriptions").select("business_id").eq("stripe_customer_id", customer).maybeSingle();
  return data?.business_id ?? null;
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const body = await request.text();
  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature ?? "", requireEnv("STRIPE_WEBHOOK_SECRET"));
  } catch {
    return new Response("Ungültige Signatur", { status: 400 });
  }
  if (!RELEVANT.has(event.type)) return Response.json({ received: true, ignored: true });

  let subscriptionId: string | null = null;
  if (event.type === "checkout.session.completed") {
    const s = event.data.object as Stripe.Checkout.Session;
    subscriptionId = typeof s.subscription === "string" ? s.subscription : (s.subscription?.id ?? null);
  } else {
    subscriptionId = (event.data.object as Stripe.Subscription).id;
  }
  if (!subscriptionId) return Response.json({ received: true });

  // Den aktuellen Stand immer von Stripe holen – der Zustand entscheidet, nicht die Rückleitung.
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const admin = createAdminClient();
  const businessId = await businessIdFor(admin, sub);
  if (!businessId) return Response.json({ received: true, unmatched: true });

  const item = sub.items.data[0];
  const plan = planFromPriceId(item?.price.id);
  const status = event.type === "customer.subscription.deleted" ? "canceled" : sub.status;
  const { error } = await admin.rpc("apply_subscription_event", {
    p_event_id: event.id,
    p_event_type: event.type,
    p_event_created: new Date(event.created * 1000).toISOString(),
    p_business: businessId,
    p_plan: plan,
    p_status: status,
    p_period_start: item?.current_period_start ? new Date(item.current_period_start * 1000).toISOString() : null,
    p_period_end: item?.current_period_end ? new Date(item.current_period_end * 1000).toISOString() : null,
    p_customer: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    p_subscription: sub.id,
  });
  // Fehler -> 500, damit Stripe erneut zustellt; wiederholte Zustellung ist durch die Event-ID wirkungslos.
  if (error) return new Response("Verarbeitung fehlgeschlagen", { status: 500 });
  return Response.json({ received: true });
}
