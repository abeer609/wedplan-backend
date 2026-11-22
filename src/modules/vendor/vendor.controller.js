import { Service } from "../../models/service.js";
import { ApiError } from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  assertCanActivateService,
  getEffectivePlan,
} from "../../utils/subscription.js";
import { data } from "../../middleware/validate.js";

const KEY_FIELDS = ["serviceName", "category", "description", "price", "location"];

export const createService = asyncHandler(async (req, res) => {
  const body = data(req, "body");
  const vendorId = String(req.user._id);
  const effectivePlan = getEffectivePlan(req.user);
  await assertCanActivateService(vendorId, effectivePlan);
  const service = await Service.create({ ...body, vendorId });
  res.status(201).json({ success: true, data: service });
});

export const listMyServices = asyncHandler(async (req, res) => {
  const q = data(req, "query");
  const filter = { vendorId: String(req.user._id) };
  if (q.status) filter.status = q.status;
  const [items, total] = await Promise.all([
    Service.find(filter)
      .sort({ createdAt: -1 })
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .lean(),
    Service.countDocuments(filter),
  ]);
  res.json({
    success: true,
    data: items,
    pagination: { page: q.page, limit: q.limit, total, pages: Math.ceil(total / q.limit) },
  });
});

export const updateService = asyncHandler(async (req, res) => {
  const { id } = data(req, "params");
  const body = data(req, "body");
  const vendorId = String(req.user._id);
  const service = await Service.findOne({ _id: id, vendorId });
  if (!service) {
    const exists = await Service.exists({ _id: id });
    if (!exists) throw new ApiError(404, "Service not found", "NOT_FOUND");
    throw new ApiError(403, "You do not own this service", "FORBIDDEN");
  }
  const touchesKeyField = KEY_FIELDS.some((f) => body[f] !== undefined);
  Object.assign(service, body);
  if (touchesKeyField && service.status !== "rejected") {
    service.status = "pending";
  }
  await service.save();
  res.json({ success: true, data: service });
});

export const deleteService = asyncHandler(async (req, res) => {
  const { id } = data(req, "params");
  const vendorId = String(req.user._id);
  const deleted = await Service.findOneAndDelete({ _id: id, vendorId });
  if (!deleted) {
    const exists = await Service.exists({ _id: id });
    if (!exists) throw new ApiError(404, "Service not found", "NOT_FOUND");
    throw new ApiError(403, "You do not own this service", "FORBIDDEN");
  }
  res.json({ success: true, message: "Service deleted" });
});

export const toggleAvailability = asyncHandler(async (req, res) => {
  const { id } = data(req, "params");
  const vendorId = String(req.user._id);
  const service = await Service.findOne({ _id: id, vendorId });
  if (!service) {
    const exists = await Service.exists({ _id: id });
    if (!exists) throw new ApiError(404, "Service not found", "NOT_FOUND");
    throw new ApiError(403, "You do not own this service", "FORBIDDEN");
  }
  if (!service.isActive) {
    const effectivePlan = getEffectivePlan(req.user);
    await assertCanActivateService(vendorId, effectivePlan);
  }
  service.isActive = !service.isActive;
  await service.save();
  res.json({ success: true, data: service });
});
