import { Router } from "express";
import { Booking } from "../../models/booking.js";
import { Service } from "../../models/service.js";
import { authenticate } from "../../middleware/verifyJwt.js";
import { notBlocked } from "../../middleware/notBlocked.js";
import { requireRole } from "../../middleware/requireRole.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { getEffectivePlan } from "../../utils/subscription.js";

const router = Router();

router.use(authenticate, notBlocked);

router.get(
  "/vendor/stats",
  requireRole("vendor", "admin"),
  asyncHandler(async (req, res) => {
    const vendorId = String(req.user._id);
    const [servicesTotal, servicesActive, servicesPending, bookingsPending, bookingsAccepted, bookingsTotal] =
      await Promise.all([
        Service.countDocuments({ vendorId }),
        Service.countDocuments({ vendorId, isActive: true, status: { $ne: "rejected" } }),
        Service.countDocuments({ vendorId, status: "pending" }),
        Booking.countDocuments({ vendorId, status: "pending" }),
        Booking.countDocuments({ vendorId, status: "accepted" }),
        Booking.countDocuments({ vendorId }),
      ]);
    res.json({
      success: true,
      data: {
        services: { total: servicesTotal, active: servicesActive, pending: servicesPending },
        bookings: { total: bookingsTotal, pending: bookingsPending, accepted: bookingsAccepted },
        plan: getEffectivePlan(req.user),
      },
    });
  })
);

router.get(
  "/customer/stats",
  requireRole("customer", "vendor", "admin"),
  asyncHandler(async (req, res) => {
    const customerId = String(req.user._id);
    const [total, pending, accepted, cancelled] = await Promise.all([
      Booking.countDocuments({ customerId }),
      Booking.countDocuments({ customerId, status: "pending" }),
      Booking.countDocuments({ customerId, status: "accepted" }),
      Booking.countDocuments({ customerId, status: "cancelled" }),
    ]);
    res.json({
      success: true,
      data: { bookings: { total, pending, accepted, cancelled } },
    });
  })
);

export default router;
