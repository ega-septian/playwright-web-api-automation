import { z } from "zod";
import { expect, test } from "./fixtures";

const BrandSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
});

test.describe("FAILURE DEMO", () => {
  test("list brands without await", { tag: "@TC-FAIL-001" }, async ({ request }) => {
    const response = await request.get("/brands");
    expect(response.status()).toBe(200);
    const brands = z.array(BrandSchema).parse(response.json());
    expect(brands.length).toBeGreaterThan(0);
  });

  test("request to a closed port expects 200", { tag: "@TC-FAIL-002" }, async ({ request }) => {
    const response = await request.get("http://localhost:9999/brands");
    expect(response.status()).toBe(200);
  });

  test("brand name is not the seeded value", { tag: "@TC-FAIL-003" }, async ({ request }) => {
    const response = await request.get("/brands");
    expect(response.status()).toBe(200);
    const brands = z.array(BrandSchema).parse(await response.json());
    expect(brands[0]?.name).toBe("a name that will never match");
  });
});
