import { z } from "zod";
import { SERVICE_CATEGORIES } from "../../models/service.js";

const urlOrEmpty = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => v === "" || /^https?:\/\//i.test(v), {
    message: "Must be a valid URL",
  });

export const createServiceSchema = z.object({
  serviceName: z.string().trim().min(3).max(120),
  category: z.enum(SERVICE_CATEGORIES),
  description: z.string().trim().min(10).max(5000),
  price: z.coerce.number().min(0).max(100000000),
  location: z.string().trim().min(2).max(200),
  images: z.array(urlOrEmpty).max(10).optional().default([]),
});

export const updateServiceSchema = z
  .object({
    serviceName: z.string().trim().min(3).max(120).optional(),
    category: z.enum(SERVICE_CATEGORIES).optional(),
    description: z.string().trim().min(10).max(5000).optional(),
    price: z.coerce.number().min(0).max(100000000).optional(),
    location: z.string().trim().min(2).max(200).optional(),
    images: z.array(urlOrEmpty).max(10).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field is required",
  });

export const vendorServiceQuery = z.object({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
