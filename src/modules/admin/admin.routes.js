import { Router } from "express";
import { authenticate } from "../../middleware/verifyJwt.js";
import { notBlocked } from "../../middleware/notBlocked.js";
import { requireRole } from "../../middleware/requireRole.js";
import { validate } from "../../middleware/validate.js";
import { objectIdParam } from "../services/service.schema.js";
import {
  adminServicesQuery,
  adminServiceModeration,
  adminTransactionsQuery,
  adminUsersQuery,
} from "./admin.schema.js";
import {
  adminDeleteService,
  adminStats,
  blockUser,
  getSubscriptionOverview,
  getUserById,
  listServices,
  listTransactions,
  listUsers,
  moderateService,
  unblockUser,
} from "./admin.controller.js";

const router = Router();

router.use(authenticate, notBlocked, requireRole("admin"));

router.get("/users", validate({ query: adminUsersQuery }), listUsers);
router.get("/users/:id", validate({ params: objectIdParam }), getUserById);
router.patch("/users/:id/block", validate({ params: objectIdParam }), blockUser);
router.patch("/users/:id/unblock", validate({ params: objectIdParam }), unblockUser);

router.get("/services", validate({ query: adminServicesQuery }), listServices);
router.patch(
  "/services/:id/approve",
  validate({ params: objectIdParam }),
  (req, res, next) => {
    req.validated = { body: { status: "approved" } };
    req.body = { status: "approved" };
    next();
  },
  moderateService
);
router.patch(
  "/services/:id/reject",
  validate({ params: objectIdParam }),
  (req, res, next) => {
    req.validated = { body: { status: "rejected" } };
    req.body = { status: "rejected" };
    next();
  },
  moderateService
);
router.patch(
  "/services/:id/status",
  validate({ params: objectIdParam, body: adminServiceModeration }),
  moderateService
);
router.delete("/services/:id", validate({ params: objectIdParam }), adminDeleteService);

router.get(
  "/transactions",
  validate({ query: adminTransactionsQuery }),
  listTransactions
);

router.get("/stats", adminStats);
router.get("/subscriptions/overview", getSubscriptionOverview);

export default router;
