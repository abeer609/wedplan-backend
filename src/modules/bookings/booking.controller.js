import { Booking } from "../../models/booking.js";
import { Service } from "../../models/service.js";
import { ApiError } from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { data } from "../../middleware/validate.js";

export const createBooking = asyncHandler(async (req, res) => {
  const body = data(req, "body");
  const service = await Service.findById(body.serviceId);
  if (!service || service.status !== "approved" || service.isActive !== true) {
    throw new ApiError(404, "Service not available", "NOT_FOUND");
  }
  const customerId = String(req.user._id);
  if (String(service.vendorId) === customerId) {
    throw new ApiError(403, "You cannot book your own service", "FORBIDDEN");
  }
  try {
    const booking = await Booking.create({
      serviceId: service._id,
      vendorId: String(service.vendorId),
      customerId,
      eventDate: body.eventDate,
      eventLocation: body.eventLocation,
      message: body.message || "",
    });
    res.status(201).json({ success: true, data: booking });
  } catch (err) {
    if (err?.code === 11000) {
      throw new ApiError(
        409,
        "You already have a pending/accepted booking for this service on that date",
        "DUPLICATE"
      );
    }
    throw err;
  }
});

export const myBookings = asyncHandler(async (req, res) => {
  const q = data(req, "query");
  const filter = { customerId: String(req.user._id) };
  if (q.status) filter.status = q.status;
  const [items, total] = await Promise.all([
    Booking.find(filter)
      .populate("serviceId", "serviceName images price location")
      .sort({ createdAt: -1 })
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .lean(),
    Booking.countDocuments(filter),
  ]);
  res.json({
    success: true,
    data: items,
    pagination: { page: q.page, limit: q.limit, total, pages: Math.ceil(total / q.limit) },
  });
});

export const cancelBooking = asyncHandler(async (req, res) => {
  const { id } = data(req, "params");
  const updated = await Booking.findOneAndUpdate(
    { _id: id, customerId: String(req.user._id), status: "pending" },
    { $set: { status: "cancelled" } },
    { returnDocument: 'after' }
  );
  if (!updated) {
    const existing = await Booking.findById(id);
    if (!existing) throw new ApiError(404, "Booking not found", "NOT_FOUND");
    if (String(existing.customerId) !== String(req.user._id)) {
      throw new ApiError(403, "You do not own this booking", "FORBIDDEN");
    }
    throw new ApiError(409, "Booking can no longer be cancelled", "ALREADY_PROCESSED");
  }
  res.json({ success: true, data: updated });
});

export const vendorBookings = asyncHandler(async (req, res) => {
  const q = data(req, "query");
  const filter = { vendorId: String(req.user._id) };
  if (q.status) filter.status = q.status;
  const [items, total] = await Promise.all([
    Booking.find(filter)
      .populate("serviceId", "serviceName images price location")
      .populate("customerId", "name email image phone")
      .sort({ createdAt: -1 })
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .lean(),
    Booking.countDocuments(filter),
  ]);
  res.json({
    success: true,
    data: items,
    pagination: { page: q.page, limit: q.limit, total, pages: Math.ceil(total / q.limit) },
  });
});

async function transitionVendorBooking(req, res, to) {
  const { id } = data(req, "params");
  const updated = await Booking.findOneAndUpdate(
    { _id: id, vendorId: String(req.user._id), status: "pending" },
    { $set: { status: to } },
    { returnDocument: 'after' }
  )
    .populate("serviceId", "serviceName images price location")
    .populate("customerId", "name email image phone");
  if (!updated) {
    const existing = await Booking.findById(id);
    if (!existing) throw new ApiError(404, "Booking not found", "NOT_FOUND");
    if (String(existing.vendorId) !== String(req.user._id)) {
      throw new ApiError(403, "You do not own this booking", "FORBIDDEN");
    }
    throw new ApiError(409, "Booking already processed", "ALREADY_PROCESSED");
  }
  res.json({ success: true, data: updated });
}

export const acceptBooking = (req, res, next) =>
  transitionVendorBooking(req, res, "accepted").catch(next);

export const rejectBooking = (req, res, next) =>
  transitionVendorBooking(req, res, "rejected").catch(next);
