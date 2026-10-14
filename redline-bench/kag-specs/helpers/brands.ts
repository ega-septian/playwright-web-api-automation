import { expect, type APIRequestContext } from "@playwright/test";
import { BrandListSchema, BrandSchema, type Brand } from "../schemas/brand";

// Helper bersama: dipakai brands.spec.ts dan products.spec.ts.
export async function listBrands(request: APIRequestContext): Promise<Brand[]> {
  const response = await request.get("/brands");
  expect(response.status()).toBe(200);
  return BrandListSchema.parse(await response.json());
}

export async function getBrand(request: APIRequestContext, id: number): Promise<Brand> {
  const response = await request.get(`/brands/${id}`);
  expect(response.status()).toBe(200);
  return BrandSchema.parse(await response.json());
}
