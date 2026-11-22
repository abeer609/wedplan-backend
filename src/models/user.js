import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    email: { type: String, unique: true, sparse: true, index: true },
    image: { type: String, default: "" },
    phone: { type: String, default: "" },
    role: {
      type: String,
      enum: ["customer", "vendor", "admin"],
      default: "customer",
      index: true,
    },
    isBlocked: { type: Boolean, default: false, index: true },
    roleSelected: { type: Boolean, default: false },
    businessName: { type: String, default: "" },
    subscriptionPlan: {
      type: String,
      enum: ["free", "premium"],
      default: "free",
      index: true,
    },
    subscriptionExpiresAt: { type: Date, default: null },
    stripeCustomerId: { type: String, default: null, index: true },
  },
  { timestamps: true, collection: "user" }
);

export const User = mongoose.model("User", userSchema);
