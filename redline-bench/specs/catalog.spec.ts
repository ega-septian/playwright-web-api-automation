import { z } from "zod";
import { expect, test } from "../../fixtures/redline";

const CategorySchema = z.object({
  id: z.number(),
  parent_id: z.number().nullable(),
  name: z.string(),
  slug: z.string(),
});
const ProductSchema = z.object({
  id: z.number(),
  name: z.string(),
  price: z.number(),
  brand: z.object({ id: z.number(), slug: z.string() }),
  category: z.object({ id: z.number(), name: z.string() }),
});

test.describe("bench catalog", () => {
  test("list categories", { tag: "@TC-BENCH-06" }, async ({ request }) => {
    const response = await request.get("/categories");
    expect(response.status()).toBe(200);
    const categories = z.array(CategorySchema).parse(await response.json());
    expect(categories.some((c) => c.parent_id === null)).toBe(true);
  });

  test("category tree has sub categories", { tag: "@TC-BENCH-07" }, async ({ request }) => {
    const response = await request.get("/categories/tree");
    expect(response.status()).toBe(200);
    const tree = await response.json();
    expect(Array.isArray(tree[0].sub_categories)).toBe(true);
  });

  test("product detail", { tag: "@TC-BENCH-08" }, async ({ request }) => {
    const response = await request.get("/products/1");
    expect(response.status()).toBe(200);
    const product = ProductSchema.parse(await response.json());
    expect(product.brand.slug).toBeTruthy();
    expect(product.price).toBeGreaterThan(0);
  });
});
