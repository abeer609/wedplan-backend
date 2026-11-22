import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
      index: true,
    },
    vendorId: { type: String, ref: "User", required: true, index: true },
    customerId: { type: String, ref: "User", required: true, index: true },
    eventDate: { type: Date, required: true },
    eventLocation: { type: String, required: true, trim: true },
    message: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "cancelled"],
      default: "pending",
      index: true,
    },
  },
  { timestamps: true }
);

bookingSchema.index(
  { serviceId: 1, customerId: 1, eventDate: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ["pending", "accepted"] } },
  }
);

export const Booking = mongoose.model("Booking", bookingSchema);
