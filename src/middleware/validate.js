import { ApiError } from "../utils/ApiError.js";

export const validate = (schemas) => (req, res, next) => {
  try {
    req.validated = req.validated || {};
    for (const [key, schema] of Object.entries(schemas)) {
      if (!schema) continue;
      const result = schema.safeParse(req[key]);
      if (!result.success) {
        const details = result.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        }));
        if (key === "params") {
          throw new ApiError(400, "Invalid id format", "BAD_ID", details);
        }
        throw new ApiError(422, "Validation failed", "VALIDATION_ERROR", details);
      }
      req.validated[key] = result.data;
      if (key === "body") {
        req[key] = result.data;
      }
    }
    next();
  } catch (err) {
    next(err);
  }
};

export const data = (req, key) =>
  (req.validated && req.validated[key]) || req[key];
