import { Router } from "express";
import { env } from "../../config/env.js";
import { requireStripe } from "../../config/stripe.js";
import { Transaction } from "../../models/transaction.js";
import { User } from "../../models/user.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const router = Router();

router.post(
  "/stripe",
  asyncHandler(async (req, res) => {
    const stripe = requireStripe();
    const sig = req.headers["stripe-signature"];
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, env.STRIPE_WEBHOOK_SECRET);
    } catch {
      return res.status(400).json({ success: false, message: "Invalid signature", code: "BAD_SIGNATURE" });
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object;
        const vendorId = s.client_reference_id || s.metadata?.vendorId;
        if (
          vendorId &&
          s.payment_status === "paid" &&
          s.mode === "payment"
        ) {
          const pi =
            typeof s.payment_intent === "string" ? s.payment_intent : null;
          await Transaction.findOneAndUpdate(
            { stripeSessionId: s.id },
            {
              $setOnInsert: {
                vendorId,
                plan: "premium",
                amount: (s.amount_total ?? 0) / 100,
                currency: s.currency || "usd",
                stripeSessionId: s.id,
              },
              $set: {
                ...(pi ? { stripePaymentIntentId: pi } : {}),
                status: "paid",
              },
            },
            { upsert: true, returnDocument: "after" }
          );
          await User.updateOne(
            { _id: vendorId },
            {
              $set: {
                subscriptionPlan: "premium",
                subscriptionExpiresAt: null,
                ...(typeof s.customer === "string" ? { stripeCustomerId: s.customer } : {}),
              },
            }
          );
        }
        break;
      }
      case "checkout.session.async_payment_succeeded": {
        const s = event.data.object;
        const vendorId = s.client_reference_id || s.metadata?.vendorId;
        if (vendorId) {
          await Transaction.findOneAndUpdate(
            { stripeSessionId: s.id },
            { $set: { status: "paid" } }
          );
          await User.updateOne(
            { _id: vendorId },
            { $set: { subscriptionPlan: "premium", subscriptionExpiresAt: null } }
          );
        }
        break;
      }
      case "checkout.session.async_payment_failed": {
        const s = event.data.object;
        await Transaction.findOneAndUpdate(
          { stripeSessionId: s.id },
          { $set: { status: "failed" } }
        );
        break;
      }
      case "checkout.session.expired": {
        const s = event.data.object;
        await Transaction.findOneAndUpdate(
          { stripeSessionId: s.id },
          { $set: { status: "expired" } }
        );
        break;
      }
      case "charge.refunded": {
        const charge = event.data.object;
        const pi = typeof charge.payment_intent === "string" ? charge.payment_intent : null;
        if (pi) {
          await Transaction.findOneAndUpdate(
            { stripePaymentIntentId: pi },
            { $set: { status: "refunded" } }
          );
        } else {
          const sessions = await stripe.checkout.sessions.list({
            payment_intent: charge.payment_intent,
            limit: 1,
          });
          const sid = sessions.data?.[0]?.id;
          if (sid) {
            await Transaction.findOneAndUpdate(
              { stripeSessionId: sid },
              { $set: { status: "refunded" } }
            );
          }
        }
        break;
      }
      default:
        break;
    }

    res.json({ received: true });
  })
);

export default router;
