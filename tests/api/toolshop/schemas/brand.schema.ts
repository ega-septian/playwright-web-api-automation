import { z } from "zod";

export const BrandResponseSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
});

export const BrandListResponseSchema = z.array(BrandResponseSchema);

export const BrandSuccessFoundSchema = z.strictObject({
  success: z.boolean(),
});

// 422: error per field. Minimal satu field, supaya body kosong tidak lolos.
export const BrandErrorSchema = z
  .strictObject({
    name: z.array(z.string()).optional(),
    slug: z.array(z.string()).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, "body 422 tanpa error per field");

// 409 menurut kontrak sprint 5 (DuplicateConflictResponse): pesan umum dari database, atau error per field
// dari validator.
export const BrandConflictSchema = z.union([
  z.strictObject({ message: z.string() }),
  z.record(z.string(), z.array(z.string())),
]);
