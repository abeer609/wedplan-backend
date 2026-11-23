import { z } from "zod";

export const createBookingSchema = z.object({
  serviceId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid service id"),
  eventDate: z.coerce.date().refine((d) => d.getTime() > Date.now(), {
    message: "eventDate must be in the future",
  }),
  eventLocation: z.string().trim().min(2).max(300),
  phone: z.string().trim().min(7, "Phone number is required").max(30),
  message: z.string().trim().max(1000).optional().default(""),
});

export const bookingListQuery = z.object({
  status: z.enum(["pending", "accepted", "rejected", "cancelled"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
