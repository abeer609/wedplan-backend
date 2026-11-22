import { Router } from "express";
import { authenticate } from "../../middleware/verifyJwt.js";
import { notBlocked } from "../../middleware/notBlocked.js";
import { requireRole } from "../../middleware/requireRole.js";
import { validate } from "../../middleware/validate.js";
import { objectIdParam } from "../services/service.schema.js";
import { bookingListQuery, createBookingSchema } from "./booking.schema.js";
import {
  acceptBooking,
  cancelBooking,
  createBooking,
  myBookings,
  rejectBooking,
  vendorBookings,
} from "./booking.controller.js";

const router = Router();

router.use(authenticate, notBlocked);

router.post(
  "/",
  requireRole("customer"),
  validate({ body: createBookingSchema }),
  createBooking
);
router.get(
  "/mine",
  requireRole("customer"),
  validate({ query: bookingListQuery }),
  myBookings
);
router.patch(
  "/:id/cancel",
  requireRole("customer"),
  validate({ params: objectIdParam }),
  cancelBooking
);

export const vendorBookingRouter = Router();
vendorBookingRouter.use(authenticate, notBlocked, requireRole("vendor", "admin"));
vendorBookingRouter.get(
  "/bookings",
  validate({ query: bookingListQuery }),
  vendorBookings
);
vendorBookingRouter.patch(
  "/bookings/:id/accept",
  validate({ params: objectIdParam }),
  acceptBooking
);
vendorBookingRouter.patch(
  "/bookings/:id/reject",
  validate({ params: objectIdParam }),
  rejectBooking
);

export default router;
