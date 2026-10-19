import { z } from "zod";

export const BrandResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
});

export const BrandListResponseSchema = z.array(BrandResponseSchema);

export const BrandNotFoundSchema = z.object({
  message: z.string(),
});

export const BrandSuccessFoundSchema = z.object({
  success: z.boolean(),
});

export const BrandErrorSchema = z.object({
  name: z.array(z.string()).optional(),
  slug: z.array(z.string()).optional(),
});

export const BrandConflictSchema = z.union([
  z.object({ message: z.string() }),
  z.record(z.string(), z.array(z.string())),
]);
