import { z } from "zod";

export const BrandResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
});

export const BrandListResponseSchema = z.array(BrandResponseSchema);
