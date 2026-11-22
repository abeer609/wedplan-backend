import { ApiError } from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { data } from "../../middleware/validate.js";
import { getEffectivePlan } from "../../utils/subscription.js";

const ALLOWED_FIELDS = ["name", "image", "businessName", "phone"];

export const getMe = asyncHandler(async (req, res) => {
  const u = req.user.toObject ? req.user.toObject() : { ...req.user };
  u.effectivePlan = getEffectivePlan(req.user);
  res.json({ success: true, data: u });
});

export const updateMe = asyncHandler(async (req, res) => {
  const body = data(req, "body");
  for (const key of Object.keys(body)) {
    if (!ALLOWED_FIELDS.includes(key)) delete body[key];
  }
  Object.assign(req.user, body);
  await req.user.save();
  res.json({ success: true, data: req.user });
});

export const onboardingRole = asyncHandler(async (req, res) => {
  const body = data(req, "body");
  if (req.user.roleSelected) {
    throw new ApiError(409, "Role already selected", "ALREADY_SELECTED");
  }
  req.user.role = body.role;
  req.user.roleSelected = true;
  await req.user.save();
  res.json({ success: true, data: req.user });
});
