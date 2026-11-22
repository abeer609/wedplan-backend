import mongoose from "mongoose";

export const SERVICE_CATEGORIES = [
  "venue",
  "catering",
  "photography",
  "decoration",
  "music",
  "makeup",
];

const serviceSchema = new mongoose.Schema(
  {
    vendorId: { type: String, ref: "User", required: true, index: true },
    serviceName: { type: String, required: true, trim: true },
    category: { type: String, enum: SERVICE_CATEGORIES, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    location: { type: String, required: true, trim: true, index: true },
    images: { type: [String], default: [] },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

serviceSchema.index({ status: 1, isActive: 1, category: 1, location: 1 });
serviceSchema.index({ price: 1 });
serviceSchema.index({ serviceName: "text" });

export const Service = mongoose.model("Service", serviceSchema);
