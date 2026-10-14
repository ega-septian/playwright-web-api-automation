import { z } from "zod";

export const BrandResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
});

export const BrandListResponseSchema = z.array(BrandResponseSchema);

export const BrandNotFoundSchema = z.object({
  message: z.string(),
});

export const BrandErrorSchema = z.object({
  name: z.array(z.string()).optional(),
  slug: z.array(z.string()).optional(),
});
