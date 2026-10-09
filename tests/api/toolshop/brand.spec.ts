import { test, expect } from "../../../fixtures/redline";
import { createBrandPayload } from "./data/brand.data";
import { BrandListResponseSchema, BrandResponseSchema } from "./schemas/brand.schema";

test.describe("Brand test suits", () => {
  test("Get all brands successfully", { tag: "@TC-BRD-001" }, async ({ request }) => {
    const response = await test.step("Get brands", async () => {
      const resp = await request.get("/brands");
      expect(resp.status()).toBe(200);
      return resp;
    });

    test.step("Validate response", async () => {
      const brands = BrandListResponseSchema.parse(response.json());
      expect(brands.length).toBeGreaterThan(0);
    });
  });

  test("Create brand successfully", { tag: "@TC-BRD-002" }, async ({ request }) => {
    const payload = createBrandPayload();
    const response = await request.post("/brands", {
      data: payload,
    });
    expect(response.status()).toBe(201);
    const body = await response.json();

    const brand = BrandResponseSchema.parse(body);
    expect(brand).toMatchObject(payload);
  });
});
