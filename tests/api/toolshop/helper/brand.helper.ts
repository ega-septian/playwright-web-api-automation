import { expect, type APIRequestContext } from "@playwright/test";
import { BrandListResponseSchema } from "../schemas/brand.schema";

/** GET /brands, dicek status dan schema-nya. Untuk memastikan create yang ditolak tidak menyimpan apa-apa. */
export async function getAllBrands(request: APIRequestContext) {
  const response = await request.get("/brands");
  expect(response.status()).toBe(200);
  return BrandListResponseSchema.parse(await response.json());
}
