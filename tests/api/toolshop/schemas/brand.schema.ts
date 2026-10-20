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

// 422: error messages per field. At least one field, so an empty body does not pass.
export const BrandErrorSchema = z
  .strictObject({
    name: z.array(z.string()).optional(),
    slug: z.array(z.string()).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, "body 422 tanpa error per field");

// 409 per the contract (DuplicateConflictResponse): a general database message or per-field errors.
export const BrandConflictSchema = z.union([
  z.strictObject({ message: z.string() }),
  z.record(z.string(), z.array(z.string())),
]);

// 409 when deleting a brand that a product still uses. The contract describes it but has no body.
export const BrandInUseSchema = z.strictObject({
  success: z.boolean(),
  message: z.string(),
});
