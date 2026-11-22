import Stripe from "stripe";
import { env } from "./env.js";

export const stripe = env.STRIPE_SECRET_KEY
  ? new Stripe(env.STRIPE_SECRET_KEY)
  : null;

export function requireStripe() {
  if (!stripe) {
    const err = new Error("Stripe is not configured (STRIPE_SECRET_KEY missing)");
    err.statusCode = 503;
    throw err;
  }
  return stripe;
}
