import { test, expect } from "../../../fixtures/redline";
import { createBrandPayload, updateBrandPayload } from "./data/brand.data";
import { BrandListResponseSchema, BrandResponseSchema } from "./schemas/brand.schema";

test.describe("Brand test suits", () => {
  test("Get all brands successfully", { tag: "@TC-BRD-001" }, async ({ request }) => {
    const response = await test.step("Get brands", async () => {
      const resp = await request.get("/brands");
      expect(resp.status()).toBe(200);
      return resp;
    });

    await test.step("Validate response", async () => {
      const brands = BrandListResponseSchema.parse(await response.json());
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

  test("Get brand by id", { tag: "@TC-BRD-003" }, async ({ request }) => {
    const payload = createBrandPayload();

    const id = await test.step("Create new brand id", async () => {
      const response = await request.post("/brands", {
        data: payload,
      });
      const body = await response.json();
      expect(response.status()).toBe(201);
      return BrandResponseSchema.parse(body).id;
    });

    await test.step("Validate brand id", async () => {
      const response = await request.get(`/brands/${id}`);
      expect(response.status()).toBe(200);
      const body = await response.json();
      const brand = BrandResponseSchema.parse(await body);
      expect(brand).toMatchObject({ id, ...payload });
    });
  });

  test("Update brand by id", { tag: "@TC-BRD-004" }, async ({ request }) => {
    const id = await test.step("Create new brand id", async () => {
      const payload = createBrandPayload();
      const response = await request.post("/brands", {
        data: payload,
      });
      expect(response.status()).toBe(201);
      return BrandResponseSchema.parse(await response.json()).id;
    });

    await test.step("Update brand slug and name", async () => {
      const payload = updateBrandPayload();
      const response = await request.put(`/brands/${id}`, {
        data: payload,
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);

      const getResp = await request.get(`/brands/${id}`);
      expect(getResp.status()).toBe(200);
      const brand = BrandResponseSchema.parse(await getResp.json());
      expect(brand).toMatchObject({ id, ...payload });
    });
  });
});
