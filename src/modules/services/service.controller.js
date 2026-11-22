import { Service, SERVICE_CATEGORIES } from "../../models/service.js";
import { ApiError } from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { escapeRegExp } from "../../utils/helpers.js";
import { data } from "../../middleware/validate.js";

const PUBLIC_FILTER = { status: "approved", isActive: true };

function sortFor(sort) {
  if (sort === "price_asc") return { price: 1 };
  if (sort === "price_desc") return { price: -1 };
  return { createdAt: -1 };
}

export const listServices = asyncHandler(async (req, res) => {
  const q = data(req, "query");
  const filter = { ...PUBLIC_FILTER };
  if (q.category) filter.category = q.category;
  if (q.location) filter.location = { $regex: escapeRegExp(q.location), $options: "i" };
  if (q.search) {
    filter.$or = [
      { serviceName: { $regex: escapeRegExp(q.search), $options: "i" } },
      { description: { $regex: escapeRegExp(q.search), $options: "i" } },
      { location: { $regex: escapeRegExp(q.search), $options: "i" } },
    ];
  }
  const page = q.page;
  const limit = q.limit;
  const [items, total] = await Promise.all([
    Service.find(filter).sort(sortFor(q.sort)).skip((page - 1) * limit).limit(limit).lean(),
    Service.countDocuments(filter),
  ]);
  res.json({
    success: true,
    data: items,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export const featuredServices = asyncHandler(async (req, res) => {
  const q = data(req, "query");
  const items = await Service.find(PUBLIC_FILTER)
    .sort({ createdAt: -1 })
    .limit(q.limit)
    .lean();
  res.json({ success: true, data: items });
});

export const listCategories = asyncHandler(async (req, res) => {
  res.json({ success: true, data: SERVICE_CATEGORIES });
});

export const getServiceById = asyncHandler(async (req, res) => {
  const { id } = data(req, "params");
  const service = await Service.findById(id).lean();
  if (!service) throw new ApiError(404, "Service not found", "NOT_FOUND");
  const isOwner =
    req.user && String(service.vendorId) === String(req.user._id);
  const isAdmin = req.user?.role === "admin";
  const isPublic = service.status === "approved" && service.isActive === true;
  if (!isPublic && !isOwner && !isAdmin) {
    throw new ApiError(404, "Service not found", "NOT_FOUND");
  }
  res.json({ success: true, data: service });
});
