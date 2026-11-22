import multer from "multer";

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const ok = ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype);
    if (!ok) {
      const err = new Error("Only jpg, png, webp images are allowed");
      err.statusCode = 400;
      return cb(err);
    }
    cb(null, true);
  },
});
