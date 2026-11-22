export const errorHandler = (err, req, res, next) => {
  let status = err.statusCode || 500;
  let code = err.code;
  let message = err.message || "Internal server error";

  if (err?.code === 11000 || err?.cause?.code === 11000) {
    status = 409;
    code = "DUPLICATE";
    message = "Duplicate entry";
  }
  if (err?.name === "CastError") {
    status = 400;
    code = code || "BAD_ID";
    message = "Invalid id format";
  }
  if (err?.name === "MulterError") {
    status = 400;
    code = "UPLOAD_ERROR";
    if (err.code === "LIMIT_FILE_SIZE") message = "File too large (max 2MB)";
  }

  if (status === 500) console.error(err);

  res.status(status).json({
    success: false,
    message,
    ...(code ? { code } : {}),
    ...(err.details ? { details: err.details } : {}),
  });
};
