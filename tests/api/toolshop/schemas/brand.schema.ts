import { z } from "zod";

export const BrandResponseSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
});

export const BrandListResponseSchema = z.array(BrandResponseSchema);

export const BrandNotFoundSchema = z.strictObject({
  message: z.string(),
});

export const BrandSuccessFoundSchema = z.strictObject({
  success: z.boolean(),
});

export const BrandErrorSchema = z.strictObject({
  name: z.array(z.string()).optional(),
  slug: z.array(z.string()).optional(),
});

export const BrandConflictSchema = z.union([
  z.strictObject({ message: z.string() }),
  z.record(z.string(), z.array(z.string())),
]);
