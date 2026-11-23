import { z } from "zod";
import { expect, test } from "./fixtures";

const BrandSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
});

test.describe("DEMO / interview", () => {
  test("list brands without await", { tag: "@TC-SHOT-001" }, async ({ request }) => {
    const response = await request.get("/brands");
    expect(response.status()).toBe(200);
    const brands = z.array(BrandSchema).parse(response.json());
    expect(brands.length).toBeGreaterThan(0);
  });

  test("invalid product sort returns 500", { tag: "@TC-SHOT-002" }, async ({ request }) => {
    const response = await request.get("/products?sort=invalid");
    expect(response.status()).toBe(200);
  });

  test("wrong port is unreachable", { tag: "@TC-SHOT-003" }, async ({ request }) => {
    const response = await request.get("http://localhost:9999/brands");
    expect(response.status()).toBe(200);
  });
});
