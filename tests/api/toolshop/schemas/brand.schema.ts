import { z } from "zod";

export const BrandSchema = z.array(
  z.object({ id: z.number(), name: z.number(), slug: z.string() }),
);
