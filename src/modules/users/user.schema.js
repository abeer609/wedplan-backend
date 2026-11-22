import { z } from "zod";

const urlOrEmpty = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => v === "" || /^https?:\/\//i.test(v), {
    message: "Must be a valid URL",
  });

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    image: urlOrEmpty.optional(),
    businessName: z.string().trim().max(150).optional(),
    phone: z.string().trim().max(30).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field is required",
  });

export const onboardingRoleSchema = z.object({
  role: z.enum(["customer", "vendor"]),
});
