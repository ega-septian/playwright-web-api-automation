import { z } from "zod";

// Schema bersama untuk spec KAG. Spec tidak meng-import file ini langsung, tapi lewat helpers/brands.ts,
// jadi perubahan di sini tidak terlihat oleh hash kode test (hanya import langsung yang di-hash).
export const BrandSchema = z.object({ id: z.number(), name: z.string(), slug: z.string() });
export const BrandListSchema = z.array(BrandSchema);
export type Brand = z.infer<typeof BrandSchema>;
