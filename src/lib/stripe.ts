import "server-only";
import Stripe from "stripe";
import { requireEnv } from "@/lib/config";

export function getStripe() {
  return new Stripe(requireEnv("STRIPE_SECRET_KEY"));
}

export const PLAN_PRICE_ENV = { starter: "STRIPE_PRICE_STARTER", studio: "STRIPE_PRICE_STUDIO" } as const;
export type PlanId = keyof typeof PLAN_PRICE_ENV;

export const PLAN_INFO: Record<PlanId, { name: string; price: string; orders: number }> = {
  starter: { name: "Starter", price: "29 € netto / Monat", orders: 50 },
  studio: { name: "Studio", price: "49 € netto / Monat", orders: 200 },
};

export function planFromPriceId(priceId: string | undefined): PlanId | null {
  for (const [plan, env] of Object.entries(PLAN_PRICE_ENV)) {
    if (priceId && process.env[env] === priceId) return plan as PlanId;
  }
  return null;
}
