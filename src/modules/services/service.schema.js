import { z } from "zod";
import { SERVICE_CATEGORIES } from "../../models/service.js";

export const objectIdParam = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id format"),
});

export const publicServicesQuery = z.object({
  search: z.string().trim().max(100).optional().default(""),
  category: z.enum(SERVICE_CATEGORIES).optional(),
  location: z.string().trim().max(100).optional().default(""),
  sort: z.enum(["price_asc", "price_desc", "newest"]).optional().default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

export const featuredQuery = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(8),
});
