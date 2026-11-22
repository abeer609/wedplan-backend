import { Booking } from "../../models/booking.js";
import { Service } from "../../models/service.js";
import { Transaction } from "../../models/transaction.js";
import { User } from "../../models/user.js";
import { ApiError } from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { escapeRegExp } from "../../utils/helpers.js";
import { data } from "../../middleware/validate.js";

function paged(items, total, page, limit) {
  return {
    success: true,
    data: items,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

export const listUsers = asyncHandler(async (req, res) => {
  const q = data(req, "query");
  const filter = {};
  if (q.role) filter.role = q.role;
  if (q.search) {
    filter.$or = [
      { name: { $regex: escapeRegExp(q.search), $options: "i" } },
      { email: { $regex: escapeRegExp(q.search), $options: "i" } },
    ];
  }
  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
    User.countDocuments(filter),
  ]);
  res.json(paged(items, total, q.page, q.limit));
});

export const getUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = await User.findById(id).lean();
  if (!user) throw new ApiError(404, "User not found", "NOT_FOUND");
  res.json({ success: true, data: user });
});

async function setBlocked(req, res, blocked) {
  const { id } = req.params;
  if (String(req.user._id) === String(id)) {
    throw new ApiError(403, "You cannot change your own block status", "FORBIDDEN");
  }
  const target = await User.findById(id);
  if (!target) throw new ApiError(404, "User not found", "NOT_FOUND");
  if (target.role === "admin") {
    throw new ApiError(403, "Admins cannot block other admins", "FORBIDDEN");
  }
  target.isBlocked = blocked;
  await target.save();
  res.json({ success: true, data: target });
}

export const blockUser = (req, res, next) => setBlocked(req, res, true).catch(next);
export const unblockUser = (req, res, next) => setBlocked(req, res, false).catch(next);

export const listServices = asyncHandler(async (req, res) => {
  const q = data(req, "query");
  const filter = {};
  if (q.status) filter.status = q.status;
  if (q.category) filter.category = q.category;
  const [items, total] = await Promise.all([
    Service.find(filter).sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
    Service.countDocuments(filter),
  ]);
  res.json(paged(items, total, q.page, q.limit));
});

export const moderateService = asyncHandler(async (req, res) => {
  const body = data(req, "body");
  const nextStatus =
    body.status || (body.action === "approve" ? "approved" : "rejected");
  const service = await Service.findByIdAndUpdate(
    req.params.id,
    { $set: { status: nextStatus } },
    { returnDocument: 'after' }
  );
  if (!service) throw new ApiError(404, "Service not found", "NOT_FOUND");
  res.json({ success: true, data: service });
});

export const adminDeleteService = asyncHandler(async (req, res) => {
  const deleted = await Service.findByIdAndDelete(req.params.id);
  if (!deleted) throw new ApiError(404, "Service not found", "NOT_FOUND");
  res.json({ success: true, message: "Service deleted" });
});

export const listTransactions = asyncHandler(async (req, res) => {
  const q = data(req, "query");
  const filter = {};
  if (q.status) filter.status = q.status;
  const [items, total] = await Promise.all([
    Transaction.find(filter).sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
    Transaction.countDocuments(filter),
  ]);
  res.json(paged(items, total, q.page, q.limit));
});

export const adminStats = asyncHandler(async (req, res) => {
  const [
    users,
    blocked,
    vendors,
    customers,
    servicesPending,
    servicesApproved,
    bookingsPending,
    bookingsAccepted,
    revenueAgg,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ isBlocked: true }),
    User.countDocuments({ role: "vendor" }),
    User.countDocuments({ role: "customer" }),
    Service.countDocuments({ status: "pending" }),
    Service.countDocuments({ status: "approved" }),
    Booking.countDocuments({ status: "pending" }),
    Booking.countDocuments({ status: "accepted" }),
    Transaction.aggregate([
      { $match: { status: "paid" } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
  ]);
  res.json({
    success: true,
    data: {
      users: { total: users, blocked, vendors, customers },
      services: {
        pending: servicesPending,
        approved: servicesApproved,
        total: servicesPending + servicesApproved,
      },
      bookings: { pending: bookingsPending, accepted: bookingsAccepted },
      revenue: {
        total: revenueAgg?.[0]?.total || 0,
        paidTransactions: revenueAgg?.[0]?.count || 0,
      },
    },
  });
});

export const getSubscriptionOverview = asyncHandler(async (req, res) => {
  const [premium, free, paidTransactions, totalRevenue] = await Promise.all([
    User.countDocuments({ subscriptionPlan: "premium" }),
    User.countDocuments({ subscriptionPlan: { $ne: "premium" } }),
    Transaction.countDocuments({ status: "paid" }),
    Transaction.aggregate([
      { $match: { status: "paid" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
  ]);
  res.json({
    success: true,
    data: {
      premium,
      free,
      paidTransactions,
      totalRevenue: totalRevenue?.[0]?.total || 0,
    },
  });
});
