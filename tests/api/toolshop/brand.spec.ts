import { faker } from "@faker-js/faker";
import { test, expect } from "./fixtures";
import { createBrandPayload, updateBrandPayload } from "./data/brand.data";
import { getAllBrands } from "./helper/brand.helper";
import {
  BrandListResponseSchema,
  BrandResponseSchema,
  BrandErrorSchema,
  BrandSuccessFoundSchema,
  BrandConflictSchema,
} from "./schemas/brand.schema";
import { MessageResponseSchema } from "./schemas/error.schema";

test.describe("POST /brands", () => {
  test("Create brand successfully", { tag: "@TC-BRD-002" }, async ({ request }) => {
    const payload = createBrandPayload();

    const brand = await test.step("Create brand", async () => {
      const response = await request.post("/brands", { data: payload });
      expect(response.status()).toBe(201);
      const brand = BrandResponseSchema.parse(await response.json());
      expect(brand).toMatchObject(payload);
      return brand;
    });

    await test.step("Validate brand is stored", async () => {
      const response = await request.get(`/brands/${brand.id}`);
      expect(response.status()).toBe(200);
      expect(BrandResponseSchema.parse(await response.json())).toEqual(brand);
    });
  });

  test("Create brand fails when name is missing", { tag: "@TC-BRD-006" }, async ({ request }) => {
    const { name, ...payload } = createBrandPayload();

    await test.step("Create brand without name", async () => {
      const response = await request.post("/brands", { data: payload });
      expect(response.status()).toBe(422);
      const data = BrandErrorSchema.parse(await response.json());
      expect(data.name).toContainEqual("The name field is required.");
    });

    await test.step("Validate brand is not stored", async () => {
      const brands = await getAllBrands(request);
      expect(brands.filter((b) => b.slug === payload.slug)).toHaveLength(0);
    });
  });

  test("Create brand fails when name is empty", { tag: "@TC-BRD-022" }, async ({ request }) => {
    const payload = createBrandPayload({ name: "" });

    await test.step("Create brand with empty name", async () => {
      const response = await request.post("/brands", { data: payload });
      expect(response.status()).toBe(422);
      const data = BrandErrorSchema.parse(await response.json());
      expect(data.name).toContainEqual("The name field is required.");
    });

    await test.step("Validate brand is not stored", async () => {
      const brands = await getAllBrands(request);
      expect(brands.filter((b) => b.slug === payload.slug)).toHaveLength(0);
    });
  });

  test("Create brand fails when slug is missing", { tag: "@TC-BRD-007" }, async ({ request }) => {
    // Nama unik, supaya bisa dicek tidak tersimpan (tanpa slug).
    const { slug, ...payload } = createBrandPayload({ name: `No slug ${faker.string.uuid()}` });

    await test.step("Create brand without slug", async () => {
      const response = await request.post("/brands", { data: payload });
      expect(response.status()).toBe(422);
      const data = BrandErrorSchema.parse(await response.json());
      expect(data.slug).toContainEqual("The slug field is required.");
    });

    await test.step("Validate brand is not stored", async () => {
      const brands = await getAllBrands(request);
      expect(brands.filter((b) => b.name === payload.name)).toHaveLength(0);
    });
  });

  test(
    "Create brand fails when slug already exists",
    { tag: "@TC-BRD-008" },
    async ({ request }) => {
      const payload = createBrandPayload();

      await test.step("Create new brand slug", async () => {
        const response = await request.post("/brands", { data: payload });
        expect(response.status()).toBe(201);
      });

      await test.step("Create brand with slug already exists", async () => {
        const response = await request.post("/brands", { data: payload });
        expect(response.status()).toBe(409);
        const data = BrandConflictSchema.parse(await response.json());
        expect(data).toEqual({ slug: ["A brand already exists with this slug."] });
      });

      await test.step("Validate only one brand has the slug", async () => {
        const brands = await getAllBrands(request);
        expect(brands.filter((b) => b.slug === payload.slug)).toHaveLength(1);
      });
    },
  );

  test(
    "Create brand fails when name exceeds 120 characters",
    { tag: "@TC-BRD-009" },
    async ({ request }) => {
      const payload = createBrandPayload({ name: "a".repeat(121) });

      await test.step("Create brand with a 121-character name", async () => {
        const response = await request.post("/brands", { data: payload });
        expect(response.status()).toBe(422);
        const data = BrandErrorSchema.parse(await response.json());
        expect(data.name).toContainEqual("The name field must not be greater than 120 characters.");
      });

      await test.step("Validate brand is not stored", async () => {
        const brands = await getAllBrands(request);
        expect(brands.filter((b) => b.slug === payload.slug)).toHaveLength(0);
      });
    },
  );

  test(
    "Create brand succeeds when name is exactly 120 characters",
    { tag: "@TC-BRD-010" },
    async ({ request }) => {
      const payload = createBrandPayload({ name: "a".repeat(120) });

      const brand = await test.step("Create brand with a 120-character name", async () => {
        const response = await request.post("/brands", { data: payload });
        expect(response.status()).toBe(201);
        const brand = BrandResponseSchema.parse(await response.json());
        expect(brand).toMatchObject(payload);
        return brand;
      });

      await test.step("Validate brand is stored", async () => {
        const response = await request.get(`/brands/${brand.id}`);
        expect(response.status()).toBe(200);
        expect(BrandResponseSchema.parse(await response.json())).toEqual(brand);
      });
    },
  );

  test(
    "Create brand fails with empty request body",
    { tag: "@TC-BRD-011" },
    async ({ request }) => {
      // Tidak ada GET setelahnya: body kosong tidak punya nama atau slug untuk dicari di daftar.
      const response = await request.post("/brands", { data: {} });
      expect(response.status()).toBe(422);
      const data = BrandErrorSchema.parse(await response.json());
      expect(data.name).toContainEqual("The name field is required.");
      expect(data.slug).toContainEqual("The slug field is required.");
    },
  );
});

test.describe("GET /brands", () => {
  test("Get all brands successfully", { tag: "@TC-BRD-001" }, async ({ request }) => {
    const brand = await test.step("Create brand", async () => {
      const response = await request.post("/brands", { data: createBrandPayload() });
      expect(response.status()).toBe(201);
      return BrandResponseSchema.parse(await response.json());
    });

    await test.step("Validate the list contains the brand", async () => {
      const response = await request.get("/brands");
      expect(response.status()).toBe(200);
      const brands = BrandListResponseSchema.parse(await response.json());
      expect(brands).toContainEqual(brand);
    });
  });

  // Daftar brand berubah terus karena test lain membuat brand secara paralel, jadi 304 untuk /brands tidak
  // bisa diandalkan. Yang diuji: ETag ikut berubah ketika daftar berubah. Kasus 304 diuji di TC-BRD-014.
  test(
    "Get all brands returns a new ETag when the list changes",
    { tag: "@TC-BRD-013" },
    async ({ request }) => {
      const etag = await test.step("Get brands", async () => {
        const resp = await request.get("/brands");
        expect(resp.status()).toBe(200);
        BrandListResponseSchema.parse(await resp.json());
        const etag = resp.headers()["etag"];
        expect(etag).toBeTruthy();
        return etag;
      });

      await test.step("Create a brand so the list changes", async () => {
        const resp = await request.post("/brands", { data: createBrandPayload() });
        expect(resp.status()).toBe(201);
      });

      await test.step("Old ETag returns the new list", async () => {
        const resp = await request.get("/brands", { headers: { "If-None-Match": etag } });
        expect(resp.status()).toBe(200);
        BrandListResponseSchema.parse(await resp.json());
        expect(resp.headers()["etag"]).toBeTruthy();
        expect(resp.headers()["etag"]).not.toBe(etag);
      });
    },
  );
});

test.describe("GET /brands/{brandId}", () => {
  test("Get brand by id", { tag: "@TC-BRD-003" }, async ({ request }) => {
    const payload = createBrandPayload();

    const id = await test.step("Create new brand id", async () => {
      const response = await request.post("/brands", { data: payload });
      expect(response.status()).toBe(201);
      return BrandResponseSchema.parse(await response.json()).id;
    });

    await test.step("Validate brand id", async () => {
      const response = await request.get(`/brands/${id}`);
      expect(response.status()).toBe(200);
      const brand = BrandResponseSchema.parse(await response.json());
      expect(brand).toMatchObject({ id, ...payload });
    });
  });

  test(
    "Get brand by non-existing id returns not found",
    { tag: "@TC-BRD-012" },
    async ({ request, adminToken }) => {
      const id = await test.step("Create new brand id", async () => {
        const response = await request.post("/brands", { data: createBrandPayload() });
        expect(response.status()).toBe(201);
        return BrandResponseSchema.parse(await response.json()).id;
      });

      await test.step("Delete brand id", async () => {
        const response = await request.delete(`/brands/${id}`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        expect(response.status()).toBe(204);
      });

      await test.step("Validate brand id not found", async () => {
        const response = await request.get(`/brands/${id}`);
        expect(response.status()).toBe(404);
        const data = MessageResponseSchema.parse(await response.json());
        expect(data.message).toBe("Requested item not found");
      });
    },
  );

  test(
    "Get brand by id returns not modified when ETag matches",
    { tag: "@TC-BRD-014" },
    async ({ request }) => {
      const id = await test.step("Create new brand id", async () => {
        const response = await request.post("/brands", { data: createBrandPayload() });
        expect(response.status()).toBe(201);
        return BrandResponseSchema.parse(await response.json()).id;
      });

      const etag = await test.step("Get brand by id", async () => {
        const resp = await request.get(`/brands/${id}`);
        expect(resp.status()).toBe(200);
        const etag = resp.headers()["etag"];
        expect(etag).toBeTruthy();
        return etag;
      });

      await test.step("Get brand by id with the same ETag", async () => {
        const resp = await request.get(`/brands/${id}`, { headers: { "If-None-Match": etag } });
        // 304 tidak ada di kontrak (GET /brands/{brandId} hanya 200, 404, 405).
        expect(resp.status()).toBe(304);
      });
    },
  );
});

test.describe("PUT /brands/{brandId}", () => {
  test("Update brand by id", { tag: "@TC-BRD-004" }, async ({ request }) => {
    const id = await test.step("Create new brand id", async () => {
      const response = await request.post("/brands", { data: createBrandPayload() });
      expect(response.status()).toBe(201);
      return BrandResponseSchema.parse(await response.json()).id;
    });

    const payload = updateBrandPayload();

    await test.step("Update brand slug and name", async () => {
      const response = await request.put(`/brands/${id}`, { data: payload });
      expect(response.status()).toBe(200);
      const data = BrandSuccessFoundSchema.parse(await response.json());
      expect(data.success).toBe(true);
    });

    await test.step("Validate brand is updated", async () => {
      const response = await request.get(`/brands/${id}`);
      expect(response.status()).toBe(200);
      expect(BrandResponseSchema.parse(await response.json())).toEqual({ id, ...payload });
    });
  });

  test(
    "Update brand with non-existing id returns not found",
    { tag: "@TC-BRD-015" },
    async ({ request, adminToken }) => {
      const id = await test.step("Create new brand id", async () => {
        const response = await request.post("/brands", { data: createBrandPayload() });
        expect(response.status()).toBe(201);
        return BrandResponseSchema.parse(await response.json()).id;
      });

      await test.step("Delete brand id", async () => {
        const response = await request.delete(`/brands/${id}`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        expect(response.status()).toBe(204);
      });

      await test.step("Verify failed to update", async () => {
        const response = await request.put(`/brands/${id}`, { data: updateBrandPayload() });
        expect(response.status()).toBe(404);
        const data = MessageResponseSchema.parse(await response.json());
        expect(data.message).toBe("Requested item not found");
      });

      await test.step("Validate brand is still not found", async () => {
        const response = await request.get(`/brands/${id}`);
        expect(response.status()).toBe(404);
      });
    },
  );

  test(
    "Update brand succeeds when name is missing",
    { tag: "@TC-BRD-016" },
    async ({ request }) => {
      const brand = await test.step("Create new brand", async () => {
        const response = await request.post("/brands", { data: createBrandPayload() });
        expect(response.status()).toBe(201);
        return BrandResponseSchema.parse(await response.json());
      });

      // BrandRequest di kontrak tidak mewajibkan field apa pun, jadi PUT tanpa name boleh.
      const { name, ...payload } = updateBrandPayload();

      await test.step("Update brand without name", async () => {
        const response = await request.put(`/brands/${brand.id}`, { data: payload });
        expect(response.status()).toBe(200);
        const data = BrandSuccessFoundSchema.parse(await response.json());
        expect(data.success).toBe(true);
      });

      await test.step("Validate slug is updated and name is kept", async () => {
        const response = await request.get(`/brands/${brand.id}`);
        expect(response.status()).toBe(200);
        expect(BrandResponseSchema.parse(await response.json())).toEqual({
          id: brand.id,
          name: brand.name,
          slug: payload.slug,
        });
      });
    },
  );

  test(
    "Update brand fails when slug is used by another brand",
    { tag: "@TC-BRD-017" },
    async ({ request }) => {
      const createBrand = async () => {
        const response = await request.post("/brands", { data: createBrandPayload() });
        expect(response.status()).toBe(201);
        return BrandResponseSchema.parse(await response.json());
      };

      const brandA = await test.step("Create brand A", createBrand);

      const brandB = await test.step("Create brand B", createBrand);

      await test.step("Verify failed to update brand B with the slug of brand A", async () => {
        const response = await request.put(`/brands/${brandB.id}`, {
          data: updateBrandPayload({ slug: brandA.slug }),
        });
        expect(response.status()).toBe(409);
        const data = BrandConflictSchema.parse(await response.json());
        expect(data).toEqual({ message: "Duplicate Entry" });
      });

      await test.step("Validate brand B is unchanged", async () => {
        const response = await request.get(`/brands/${brandB.id}`);
        expect(response.status()).toBe(200);
        expect(BrandResponseSchema.parse(await response.json())).toEqual(brandB);
      });
    },
  );

  test(
    "Update brand fails when name exceeds 120 characters",
    { tag: "@TC-BRD-018" },
    async ({ request }) => {
      const brand = await test.step("Create new brand", async () => {
        const response = await request.post("/brands", { data: createBrandPayload() });
        expect(response.status()).toBe(201);
        return BrandResponseSchema.parse(await response.json());
      });

      await test.step("Verify failed to update with a 121-character name", async () => {
        const response = await request.put(`/brands/${brand.id}`, {
          data: updateBrandPayload({ name: "a".repeat(121) }),
        });
        expect(response.status()).toBe(422);
        const data = BrandErrorSchema.parse(await response.json());
        expect(data.name).toContainEqual("The name field must not be greater than 120 characters.");
      });

      await test.step("Validate brand is unchanged", async () => {
        const response = await request.get(`/brands/${brand.id}`);
        expect(response.status()).toBe(200);
        expect(BrandResponseSchema.parse(await response.json())).toEqual(brand);
      });
    },
  );

  test(
    "Update brand succeeds when slug is its own slug",
    { tag: "@TC-BRD-021" },
    async ({ request }) => {
      const brand = await test.step("Create new brand", async () => {
        const response = await request.post("/brands", { data: createBrandPayload() });
        expect(response.status()).toBe(201);
        return BrandResponseSchema.parse(await response.json());
      });

      // Nama diganti supaya GET membuktikan update benar-benar tersimpan
      const payload = updateBrandPayload({ slug: brand.slug });

      await test.step("Update brand with its own slug", async () => {
        const response = await request.put(`/brands/${brand.id}`, { data: payload });
        expect(response.status()).toBe(200);
        const data = BrandSuccessFoundSchema.parse(await response.json());
        expect(data.success).toBe(true);
      });

      await test.step("Validate brand is updated", async () => {
        const response = await request.get(`/brands/${brand.id}`);
        expect(response.status()).toBe(200);
        expect(BrandResponseSchema.parse(await response.json())).toEqual({
          id: brand.id,
          name: payload.name,
          slug: brand.slug,
        });
      });
    },
  );
});

test.describe("DELETE /brands/{brandId}", () => {
  test("Delete brand id", { tag: "@TC-BRD-005" }, async ({ request, adminToken }) => {
    const id = await test.step("Create new brand id", async () => {
      const response = await request.post("/brands", { data: createBrandPayload() });
      expect(response.status()).toBe(201);
      return BrandResponseSchema.parse(await response.json()).id;
    });

    await test.step("Delete brand id", async () => {
      const response = await request.delete(`/brands/${id}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(response.status()).toBe(204);
    });

    await test.step("Validate get deleted id", async () => {
      const response = await request.get(`/brands/${id}`);
      expect(response.status()).toBe(404);
      const data = MessageResponseSchema.parse(await response.json());
      expect(data.message).toBe("Requested item not found");
    });
  });

  test("Delete brand fails without token", { tag: "@TC-BRD-019" }, async ({ request }) => {
    const brand = await test.step("Create new brand", async () => {
      const response = await request.post("/brands", { data: createBrandPayload() });
      expect(response.status()).toBe(201);
      return BrandResponseSchema.parse(await response.json());
    });

    await test.step("Delete brand without token", async () => {
      const response = await request.delete(`/brands/${brand.id}`);
      expect(response.status()).toBe(401);
      expect(MessageResponseSchema.parse(await response.json()).message).toBe("Unauthorized");
    });

    await test.step("Validate brand is unchanged", async () => {
      const response = await request.get(`/brands/${brand.id}`);
      expect(response.status()).toBe(200);
      expect(BrandResponseSchema.parse(await response.json())).toEqual(brand);
    });
  });

  test(
    "Delete brand fails when user is not admin",
    { tag: "@TC-BRD-020" },
    async ({ request, customerToken }) => {
      const brand = await test.step("Create new brand", async () => {
        const response = await request.post("/brands", { data: createBrandPayload() });
        expect(response.status()).toBe(201);
        return BrandResponseSchema.parse(await response.json());
      });

      await test.step("Delete brand with customer token", async () => {
        const response = await request.delete(`/brands/${brand.id}`, {
          headers: { Authorization: `Bearer ${customerToken}` },
        });
        // 403 tidak ada di kontrak (DELETE /brands/{brandId} hanya 204, 401, 404, 405, 409, 422).
        expect(response.status()).toBe(403);
        expect(MessageResponseSchema.parse(await response.json()).message).toBe("Forbidden");
      });

      await test.step("Validate brand is unchanged", async () => {
        const response = await request.get(`/brands/${brand.id}`);
        expect(response.status()).toBe(200);
        expect(BrandResponseSchema.parse(await response.json())).toEqual(brand);
      });
    },
  );
});
