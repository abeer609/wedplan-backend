import { Router } from "express";
import { env } from "../../config/env.js";
import { authenticate } from "../../middleware/verifyJwt.js";
import { notBlocked } from "../../middleware/notBlocked.js";
import { strictLimiter } from "../../middleware/rateLimit.js";
import { ApiError } from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { upload } from "./upload.middleware.js";

const router = Router();

router.post(
  "/",
  strictLimiter,
  authenticate,
  notBlocked,
  upload.single("image"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new ApiError(400, "No image file provided", "NO_FILE");
    }
    if (!env.IMGBB_API_KEY) {
      throw new ApiError(503, "Image upload is not configured", "NOT_CONFIGURED");
    }
    const base64 = req.file.buffer.toString("base64");
    const form = new URLSearchParams();
    form.set("image", base64);
    form.set("name", req.file.originalname || "upload");
    const resp = await fetch(
      `https://api.imgbb.com/1/upload?key=${encodeURIComponent(env.IMGBB_API_KEY)}`,
      { method: "POST", body: form }
    );
    const json = await resp.json().catch(() => null);
    if (!resp.ok || !json?.data?.url) {
      throw new ApiError(502, "Image upload failed", "UPLOAD_FAILED");
    }
    res.status(201).json({
      success: true,
      data: {
        url: json.data.url,
        displayUrl: json.data.display_url || json.data.url,
        deleteUrl: json.data.delete_url,
      },
    });
  })
);

export default router;
