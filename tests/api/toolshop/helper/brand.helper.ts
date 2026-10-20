import { expect, type APIRequestContext } from "@playwright/test";
import { createBrandPayload } from "../data/brand.data";
import { BrandListResponseSchema, BrandResponseSchema } from "../schemas/brand.schema";

/** GET /brands, checking the status and schema. Confirms a rejected create was not stored. */
export async function getAllBrands(request: APIRequestContext) {
  const response = await request.get("/brands");
  expect(response.status()).toBe(200);
  return BrandListResponseSchema.parse(await response.json());
}

/** POST /brands with a valid payload, checking 201 and the schema. Test setup only. */
export async function createBrand(
  request: APIRequestContext,
  overrides: Parameters<typeof createBrandPayload>[0] = {},
) {
  const response = await request.post("/brands", { data: createBrandPayload(overrides) });
  expect(response.status()).toBe(201);
  return BrandResponseSchema.parse(await response.json());
}
