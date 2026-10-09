import { faker } from "@faker-js/faker";
import { z } from "zod";
import { expect, test } from "../../fixtures/redline";

// Spec dasar benchmark Redline: semuanya harus lulus. Bug ditanam oleh scripts/redline-bench.mts.
const BrandSchema = z.object({ id: z.number(), name: z.string(), slug: z.string() });
const BrandListSchema = z.array(BrandSchema);

test.describe("bench brands", () => {
  test("list brands", { tag: "@TC-BENCH-01" }, async ({ request }) => {
    const response = await request.get("/brands");
    expect(response.status()).toBe(200);
    const brands = BrandListSchema.parse(await response.json());
    expect(brands.length).toBeGreaterThan(0);
  });

  test("get brand by id", { tag: "@TC-BENCH-02" }, async ({ request }) => {
    const response = await request.get("/brands/1");
    expect(response.status()).toBe(200);
    const brand = BrandSchema.parse(await response.json());
    expect(brand.id).toBe(1);
  });

  test("create brand", { tag: "@TC-BENCH-03" }, async ({ request }) => {
    const name = `Bench ${faker.string.alphanumeric(8)}`;
    const payload = { name, slug: name.toLowerCase().replace(/\s+/g, "-") };
    const response = await request.post("/brands", { data: payload });
    expect(response.status()).toBe(201);
    const brand = BrandSchema.parse(await response.json());
    expect(brand).toMatchObject(payload);
  });

  test("create brand without name", { tag: "@TC-BENCH-04" }, async ({ request }) => {
    const response = await request.post("/brands", { data: { name: "", slug: "" } });
    expect(response.status()).toBe(422);
    const body = await response.json();
    expect(body.name).toContain("The name field is required.");
  });

  test("brand not found", { tag: "@TC-BENCH-05" }, async ({ request }) => {
    const response = await request.get("/brands/99999");
    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body.message).toBe("Requested item not found");
  });
});
