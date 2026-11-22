import { Router } from "express";
import { env } from "../../config/env.js";
import { requireStripe } from "../../config/stripe.js";
import { Transaction } from "../../models/transaction.js";
import { User } from "../../models/user.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const router = Router();

export function currentPeriodEnd(subscription) {
  const ts =
    subscription?.current_period_end ??
    subscription?.currentPeriodEnd ??
    subscription?.items?.data?.[0]?.current_period_end;
  return ts ? new Date(ts * 1000) : null;
}

export async function applyDowngrade(vendorId, subscriptionId) {
  await User.findByIdAndUpdate(vendorId, {
    $set: { subscriptionPlan: "free", subscriptionExpiresAt: null },
  });
  if (subscriptionId) {
    await Transaction.findOneAndUpdate(
      { stripeSubscriptionId: subscriptionId },
      { $set: { status: "expired" } }
    );
  }
}

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
        if (vendorId) {
          let subscription = null;
          if (s.subscription) {
            subscription = await stripe.subscriptions.retrieve(s.subscription);
          }
          const expiresAt = subscription ? currentPeriodEnd(subscription) : null;
          const txn = await Transaction.findOneAndUpdate(
            { stripeSessionId: s.id },
            {
              $setOnInsert: {
                vendorId,
                plan: "premium",
                amount: (s.amount_total ?? 0) / 100,
                currency: s.currency || "usd",
                stripeSessionId: s.id,
                status: "paid",
              },
              $set: {
                ...(s.subscription ? { stripeSubscriptionId: s.subscription } : {}),
                status: "paid",
              },
            },
            { upsert: true, returnDocument: 'after' }
          );
          await User.findByIdAndUpdate(vendorId, {
            $set: {
              subscriptionPlan: "premium",
              ...(expiresAt ? { subscriptionExpiresAt: expiresAt } : {}),
              ...(typeof s.customer === "string" ? { stripeCustomerId: s.customer } : {}),
            },
          });
          if (txn && s.subscription && !txn.stripeSubscriptionId) {
            await Transaction.findOneAndUpdate(
              { stripeSessionId: s.id },
              { $set: { stripeSubscriptionId: s.subscription } }
            );
          }
        }
        break;
      }
      case "invoice.paid": {
        const invoice = event.data.object;
        const subscriptionId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription?.id;
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const vendorId = subscription.metadata?.vendorId;
          const expiresAt = currentPeriodEnd(subscription);
          if (vendorId) {
            await User.findByIdAndUpdate(vendorId, {
              $set: {
                subscriptionPlan: "premium",
                ...(expiresAt ? { subscriptionExpiresAt: expiresAt } : {}),
              },
            });
            await Transaction.findOneAndUpdate(
              { stripeSubscriptionId: subscriptionId },
              { $set: { status: "paid" } }
            );
          }
        }
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const subscriptionId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription?.id;
        if (subscriptionId) {
          await Transaction.findOneAndUpdate(
            { stripeSubscriptionId: subscriptionId },
            { $set: { status: "failed" } }
          );
        }
        break;
      }
      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const vendorId = subscription.metadata?.vendorId;
        if (vendorId) {
          if (subscription.status === "active" || subscription.status === "trialing") {
            const expiresAt = currentPeriodEnd(subscription);
            await User.findByIdAndUpdate(vendorId, {
              $set: {
                subscriptionPlan: "premium",
                ...(expiresAt ? { subscriptionExpiresAt: expiresAt } : {}),
              },
            });
          } else {
            await applyDowngrade(vendorId, subscription.id);
          }
        }
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const vendorId = subscription.metadata?.vendorId;
        if (vendorId) await applyDowngrade(vendorId, subscription.id);
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
          const sessions = await stripe.checkout.sessions.list({
            payment_intent: pi,
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
