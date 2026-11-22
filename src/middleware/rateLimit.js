import rateLimit from "express-rate-limit";

const jsonHandler = (message, code) => (req, res) =>
  res.status(429).json({ success: false, message, code });

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonHandler("Too many requests, try again later", "RATE_LIMITED"),
});

export const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonHandler("Too many requests, try again later", "RATE_LIMITED"),
});
