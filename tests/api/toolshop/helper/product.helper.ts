import { expect, type APIRequestContext } from "@playwright/test";
import { createCategoryPayload } from "../data/category.data";
import { createProductPayload } from "../data/product.data";

/** The first image id from /images. Images can't be created through the API (there is only GET). */
async function firstImageId(request: APIRequestContext): Promise<string> {
  const response = await request.get("/images");
  expect(response.status()).toBe(200);
  const [first] = (await response.json()) as { id: string }[];
  expect(first?.id, "/images kosong: database belum di-seed?").toBeTruthy();
  return first.id;
}

async function createCategory(request: APIRequestContext): Promise<string> {
  const response = await request.post("/categories", { data: createCategoryPayload() });
  expect(response.status()).toBe(201);
  return ((await response.json()) as { id: string }).id;
}

/**
 * Creates a product for this brand. Test setup only, not the thing under test.
 * Toolshop clears its whole cache every time a product is created, and creating several products in
 * parallel can make the server answer 500. Keep this to one test.
 */
export async function createProductForBrand(request: APIRequestContext, brandId: string) {
  const data = createProductPayload({
    brand_id: brandId,
    category_id: await createCategory(request),
    product_image_id: await firstImageId(request),
  });
  const response = await request.post("/products", { data });
  // FIXME: the API answers 201, but the POST /products contract only lists 200.
  expect(response.status()).toBe(201);
}
