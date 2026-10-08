import { test, expect } from "../../../fixtures/redline";
import { BrandSchema } from "./schemas/brand.schema";

test.describe("Brand test suits", () => {
  test("Get all brands successfully", { tag: "@TC-BRD-001" }, async ({ request }) => {
    const response = await request.get("/brands");
    expect(response.status()).toBe(200);

    const brands = BrandSchema.parse(await response.json());
    expect(brands.length).toBeGreaterThan(0);
  });
});
