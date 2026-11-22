import { Router } from "express";
import { authenticate } from "../../middleware/verifyJwt.js";
import { notBlocked } from "../../middleware/notBlocked.js";
import { requireRole } from "../../middleware/requireRole.js";
import { validate } from "../../middleware/validate.js";
import { objectIdParam } from "../services/service.schema.js";
import {
  createServiceSchema,
  updateServiceSchema,
  vendorServiceQuery,
} from "./vendor.schema.js";
import {
  createService,
  deleteService,
  listMyServices,
  toggleAvailability,
  updateService,
} from "./vendor.controller.js";

const router = Router();

router.use(authenticate, notBlocked, requireRole("vendor", "admin"));

router.post("/services", validate({ body: createServiceSchema }), createService);
router.get(
  "/services",
  validate({ query: vendorServiceQuery }),
  listMyServices
);
router.patch(
  "/services/:id",
  validate({ params: objectIdParam, body: updateServiceSchema }),
  updateService
);
router.delete("/services/:id", validate({ params: objectIdParam }), deleteService);
router.patch(
  "/services/:id/availability",
  validate({ params: objectIdParam }),
  toggleAvailability
);

export default router;
