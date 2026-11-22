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
    const startedAt = Date.now();
    console.log(
      `[upload] incoming: user=${req.user?._id} file=${req.file?.originalname} mimetype=${req.file?.mimetype} size=${req.file?.size} bytes`
    );
    if (!req.file) {
      console.log("[upload] rejected: no file received by multer");
      throw new ApiError(400, "No image file provided", "NO_FILE");
    }
    if (!env.FREEIMAGE_API_KEY) {
      console.log("[upload] rejected: FREEIMAGE_API_KEY missing");
      throw new ApiError(503, "Image upload is not configured", "NOT_CONFIGURED");
    }
    const form = new FormData();
    form.set("key", env.FREEIMAGE_API_KEY);
    form.set("action", "upload");
    form.set("format", "json");
    form.set(
      "source",
      new Blob([req.file.buffer], { type: req.file.mimetype }),
      req.file.originalname || "upload"
    );
    const resp = await fetch("https://freeimage.host/api/1/upload", {
      method: "POST",
      body: form,
    });
    const elapsed = Date.now() - startedAt;
    const json = await resp.json().catch(() => null);
    console.log(
      `[upload] provider responded in ${elapsed}ms: http=${resp.status} status_code=${json?.status_code} status_txt=${json?.status_txt} error=${json?.error ? JSON.stringify(json.error) : "none"}`
    );
    const image = json?.image;
    if (json?.status_code !== 200 || !image?.url) {
      const providerMsg =
        json?.error?.message || json?.status_txt || `HTTP ${resp.status}`;
      console.error(
        "freeimage.host upload failed:",
        resp.status,
        JSON.stringify(json)?.slice(0, 500)
      );
      throw new ApiError(
        502,
        `Image upload failed: ${providerMsg}`,
        "UPLOAD_FAILED"
      );
    }
    res.status(201).json({
      success: true,
      data: {
        url: image.url,
        displayUrl: image.display_url || image.url,
        viewerUrl: image.url_viewer || null,
        thumbUrl: image.thumb?.url || null,
        mediumUrl: image.medium?.url || null,
        ...(image.delete_url ? { deleteUrl: image.delete_url } : {}),
      },
    });
    console.log(
      `[upload] success in ${Date.now() - startedAt}ms: url=${image.url}`
    );
  })
);

export default router;
