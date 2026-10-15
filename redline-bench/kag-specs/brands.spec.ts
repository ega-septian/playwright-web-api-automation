import { expect, test } from "redline-playwright/fixture";
import { getBrand, listBrands } from "./helpers/brands";

// Spec dasar skenario KAG: semuanya harus lulus. Bug ditanam oleh scripts/redline-bench.mts.
test.describe("kag brands", () => {
  test("list brands via helper", { tag: "@TC-KAG-01" }, async ({ request }) => {
    const brands = await listBrands(request);
    expect(brands.length).toBeGreaterThan(0);
  });

  test("get brand via helper", { tag: "@TC-KAG-02" }, async ({ request }) => {
    const brand = await getBrand(request, 1);
    expect(brand.id).toBe(1);
    expect(brand.slug).toBeTruthy();
  });
});
