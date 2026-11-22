import { z } from "zod";

export const adminUsersQuery = z.object({
  search: z.string().trim().max(100).optional().default(""),
  role: z.enum(["customer", "vendor", "admin"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const adminServicesQuery = z.object({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  category: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const adminTransactionsQuery = z.object({
  status: z.enum(["paid", "failed", "refunded", "expired"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const adminServiceModeration = z.object({
  status: z.enum(["approved", "rejected", "pending"]).optional(),
  action: z.enum(["approve", "reject"]).optional(),
}).refine((v) => v.status || v.action, { message: "status or action is required" });
