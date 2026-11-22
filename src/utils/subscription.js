import { Service } from "../models/service.js";
import { ApiError } from "./ApiError.js";

export const FREE_ACTIVE_SERVICE_LIMIT = 3;

export function getEffectivePlan(user) {
  if (!user) return "free";
  return user.subscriptionPlan === "premium" ? "premium" : "free";
}

export function countActiveVendorServices(vendorId) {
  return Service.countDocuments({
    vendorId,
    status: { $ne: "rejected" },
    isActive: true,
  });
}

export async function assertCanActivateService(vendorId, effectivePlan) {
  if (effectivePlan !== "free") return;
  const count = await countActiveVendorServices(vendorId);
  if (count >= FREE_ACTIVE_SERVICE_LIMIT) {
    throw new ApiError(
      403,
      "Free plan allows up to 3 active services. Upgrade to premium to add more.",
      "UPGRADE_REQUIRED"
    );
  }
}
