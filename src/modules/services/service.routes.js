import { Router } from "express";
import { authenticate } from "../../middleware/verifyJwt.js";
import { notBlocked } from "../../middleware/notBlocked.js";
import { validate } from "../../middleware/validate.js";
import {
  featuredQuery,
  objectIdParam,
  publicServicesQuery,
} from "./service.schema.js";
import {
  featuredServices,
  getServiceById,
  listCategories,
  listServices,
} from "./service.controller.js";

export const categoriesHandler = listCategories;

const router = Router();

router.get("/", validate({ query: publicServicesQuery }), listServices);
router.get("/featured", validate({ query: featuredQuery }), featuredServices);
router.get("/categories", listCategories);
router.get(
  "/:id",
  authenticate,
  notBlocked,
  validate({ params: objectIdParam }),
  getServiceById
);

export default router;
