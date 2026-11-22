import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { sanitize } from "./middleware/sanitize.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import { notFound } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";
import webhookRouter from "./modules/webhooks/stripe.webhook.js";
import serviceRouter, { categoriesHandler } from "./modules/services/service.routes.js";
import vendorRouter from "./modules/vendor/vendor.routes.js";
import bookingRouter, { vendorBookingRouter } from "./modules/bookings/booking.routes.js";
import userRouter from "./modules/users/user.routes.js";
import subscriptionRouter from "./modules/subscriptions/subscription.routes.js";
import adminRouter from "./modules/admin/admin.routes.js";
import statsRouter from "./modules/stats/stats.routes.js";
import uploadRouter from "./modules/uploads/upload.routes.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");

  app.use(helmet());
  app.use(
    cors({
      origin: [env.CLIENT_URL, env.BETTER_AUTH_URL].filter(Boolean),
      credentials: true,
    })
  );

  app.use("/api/webhooks", express.raw({ type: "application/json" }), webhookRouter);

  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(sanitize);

  app.get("/health", (req, res) => {
    res.json({ success: true, message: "ok", uptime: process.uptime() });
  });

  app.use("/api", apiLimiter);
  app.get("/api", (req, res) => {
    res.json({
      success: true,
      data: {
        name: "wedplan-server",
        version: "1.0.0",
        docs: "/api/services, /api/categories, ...",
      },
    });
  });
  app.get("/api/categories", categoriesHandler);
  app.use("/api/services", serviceRouter);
  app.use("/api/vendor", vendorRouter);
  app.use("/api/bookings", bookingRouter);
  app.use("/api/vendor", vendorBookingRouter);
  app.use("/api/users", userRouter);
  app.use("/api/subscriptions", subscriptionRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/uploads", uploadRouter);
  app.use("/api", statsRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
