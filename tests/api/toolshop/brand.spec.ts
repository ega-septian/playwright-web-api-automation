import { test, expect } from "../../../fixtures/redline";
import { createBrandPayload, updateBrandPayload } from "./data/brand.data";
import {
  BrandListResponseSchema,
  BrandNotFoundSchema,
  BrandResponseSchema,
  BrandErrorSchema,
} from "./schemas/brand.schema";

test.describe("POST /brands", () => {
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

  test("Create brand fails when name is empty", { tag: "@TC-BRD-006" }, async ({ request }) => {
    const payload = createBrandPayload();
    const { name, ...newPayload } = payload;
    const response = await request.post("/brands", { data: newPayload });
    expect(response.status()).toBe(422);
    const body = await response.json();

    const data = BrandErrorSchema.parse(body);
    expect(data.name).toContainEqual("The name field is required.");
  });

  test("Create brand fails when slug is missing", { tag: "@TC-BRD-007" }, async ({ request }) => {
    const payload = createBrandPayload();
    const { slug, ...newPayload } = payload;
    const response = await request.post("/brands", { data: newPayload });
    expect(response.status()).toBe(422);
    const body = await response.json();

    const data = BrandErrorSchema.parse(body);
    expect(data.slug).toContainEqual("The slug field is required.");
  });

  test(
    "Create brand fails when slug already exists",
    { tag: "@TC-BRD-008" },
    async ({ request }) => {
      const payload = createBrandPayload();

      await test.step("Create new brand slug", async () => {
        const response = await request.post("/brands", {
          data: payload,
        });
        expect(response.status()).toBe(201);
      });

      await test.step("Create brand with slug already exists", async () => {
        const response = await request.post("/brands", {
          data: payload,
        });
        expect(response.status()).toBe(409);
        const body = await response.json();
        const data = BrandErrorSchema.parse(body);
        expect(data.slug).toContainEqual("A brand already exists with this slug.");
      });
    },
  );

  test(
    "Create brand fails when name exceeds 120 characters",
    { tag: "@TC-BRD-009" },
    async ({ request }) => {
      const payload = createBrandPayload({ name: "a".repeat(121) });
      const response = await request.post("/brands", { data: payload });
      expect(response.status()).toBe(422);
      const body = await response.json();

      const data = BrandErrorSchema.parse(body);
      expect(data.name).toContainEqual("The name field must not be greater than 120 characters.");
    },
  );

  test(
    "Create brand succeeds when name is exactly 120 characters",
    { tag: "@TC-BRD-010" },
    async ({ request }) => {
      const payload = createBrandPayload({ name: "a".repeat(120) });
      const response = await request.post("/brands", {
        data: payload,
      });
      expect(response.status()).toBe(201);
      const body = await response.json();

      const brand = BrandResponseSchema.parse(body);
      expect(brand).toMatchObject(payload);
    },
  );

  test(
    "Create brand fails with empty request body",
    { tag: "@TC-BRD-011" },
    async ({ request }) => {
      const payload = createBrandPayload();
      const { name, slug, ...newPayload } = payload;
      const response = await request.post("/brands", {
        data: newPayload,
      });
      expect(response.status()).toBe(422);
      const body = await response.json();

      const brand = BrandErrorSchema.parse(body);
      expect(brand.name).toContainEqual("The name field is required.");
      expect(brand.slug).toContainEqual("The slug field is required.");
    },
  );
});

test.describe("GET /brands", () => {
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
});

test.describe("PUT /brands", () => {
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

test.describe("DELETE /brands", () => {
  test("Delete brand id", { tag: "@TC-BRD-005" }, async ({ request }) => {
    const id = await test.step("Create new brand id", async () => {
      const payload = createBrandPayload();
      const response = await request.post("/brands", {
        data: payload,
      });
      expect(response.status()).toBe(201);
      return BrandResponseSchema.parse(await response.json()).id;
    });

    await test.step("Delete brand id", async () => {
      const response = await request.delete(`/brands/${id}`);
      expect(response.status()).toBe(204);
    });

    await test.step("Validate get deleted id", async () => {
      const response = await request.get(`/brands/${id}`);
      expect(response.status()).toBe(404);
      const body = await response.json();
      expect(BrandNotFoundSchema.parse(body).message).toBe("Requested item not found");
    });
  });
});
