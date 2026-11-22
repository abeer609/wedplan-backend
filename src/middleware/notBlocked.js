import { ApiError } from "../utils/ApiError.js";

export const notBlocked = (req, res, next) => {
  if (req.user?.isBlocked) {
    return next(
      new ApiError(403, "Your account has been blocked", "ACCOUNT_BLOCKED")
    );
  }
  next();
};
