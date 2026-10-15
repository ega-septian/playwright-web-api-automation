import { z } from "zod";
import { expect, test } from "redline-playwright/fixture";
import { getBrand } from "./helpers/brands";

const ProductSchema = z.object({
  id: z.number(),
  price: z.number(),
  brand: z.object({ id: z.number(), slug: z.string() }),
});

test.describe("kag products", () => {
  test("product brand matches brand endpoint", { tag: "@TC-KAG-03" }, async ({ request }) => {
    const response = await request.get("/products/1");
    expect(response.status()).toBe(200);
    const product = ProductSchema.parse(await response.json());
    const brand = await getBrand(request, product.brand.id);
    expect(brand.slug).toBe(product.brand.slug);
  });

  test("product detail", { tag: "@TC-KAG-04" }, async ({ request }) => {
    const response = await request.get("/products/1");
    expect(response.status()).toBe(200);
    const product = ProductSchema.parse(await response.json());
    expect(product.price).toBeGreaterThan(0);
  });
});
