import { Router } from "express";
import { authenticate } from "../../middleware/verifyJwt.js";
import { notBlocked } from "../../middleware/notBlocked.js";
import { validate } from "../../middleware/validate.js";
import { onboardingRoleSchema, updateProfileSchema } from "./user.schema.js";
import { getMe, onboardingRole, updateMe } from "./user.controller.js";

const router = Router();

router.use(authenticate, notBlocked);

router.get("/me", getMe);
router.patch("/me", validate({ body: updateProfileSchema }), updateMe);
router.patch(
  "/me/onboarding-role",
  validate({ body: onboardingRoleSchema }),
  onboardingRole
);

export default router;
