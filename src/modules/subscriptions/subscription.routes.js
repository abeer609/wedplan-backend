import { Router } from "express";
import { env } from "../../config/env.js";
import { requireStripe } from "../../config/stripe.js";
import { authenticate } from "../../middleware/verifyJwt.js";
import { notBlocked } from "../../middleware/notBlocked.js";
import { requireRole } from "../../middleware/requireRole.js";
import { ApiError } from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { getEffectivePlan } from "../../utils/subscription.js";

const router = Router();

router.use(authenticate, notBlocked, requireRole("vendor", "admin"));

router.get(
  "/me",
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      data: {
        plan: getEffectivePlan(req.user),
        subscriptionPlan: req.user.subscriptionPlan,
        subscriptionExpiresAt: req.user.subscriptionExpiresAt,
        stripeCustomerId: req.user.stripeCustomerId,
      },
    });
  })
);

router.post(
  "/checkout",
  asyncHandler(async (req, res) => {
    if (!env.STRIPE_PRICE_ID) {
      throw new ApiError(503, "Stripe price is not configured", "NOT_CONFIGURED");
    }
    const stripe = requireStripe();
    const vendorId = String(req.user._id);
    let customerId = req.user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.user.email || undefined,
        name: req.user.name || undefined,
        metadata: { vendorId },
      });
      customerId = customer.id;
      req.user.stripeCustomerId = customerId;
      await req.user.save();
    }
    const successUrl = `${env.CLIENT_URL.replace(/\/$/, "")}/payment/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${env.CLIENT_URL.replace(/\/$/, "")}/payment/cancelled`;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: vendorId,
      line_items: [{ price: env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { vendorId },
      subscription_data: { metadata: { vendorId } },
    });
    res.status(201).json({ success: true, data: { url: session.url, sessionId: session.id } });
  })
);

router.post(
  "/portal",
  asyncHandler(async (req, res) => {
    const stripe = requireStripe();
    if (!req.user.stripeCustomerId) {
      throw new ApiError(404, "No Stripe customer found", "NOT_FOUND");
    }
    const portal = await stripe.billingPortal.sessions.create({
      customer: req.user.stripeCustomerId,
      return_url: env.CLIENT_URL,
    });
    res.json({ success: true, data: { url: portal.url } });
  })
);

export default router;
