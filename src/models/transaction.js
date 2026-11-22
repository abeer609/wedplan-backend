import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    vendorId: { type: String, ref: "User", required: true, index: true },
    plan: { type: String, enum: ["premium"], default: "premium" },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "usd" },
    stripeSessionId: { type: String, unique: true, sparse: true, index: true },
    stripePaymentIntentId: { type: String, default: null, index: true },
    status: {
      type: String,
      enum: ["paid", "failed", "refunded", "expired"],
      default: "paid",
      index: true,
    },
  },
  { timestamps: true }
);

export const Transaction = mongoose.model("Transaction", transactionSchema);
