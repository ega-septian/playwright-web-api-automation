import { z } from "zod";
import { expect, test } from "./fixtures";

const BrandSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
});

test("fix PR pilot", { tag: "@TC-PILOT-PR-001" }, async ({ request }) => {
  const response = await request.get("/brands");
  expect(response.status()).toBe(200);
  const brands = z.array(BrandSchema).parse(response.json());
  expect(brands.length).toBeGreaterThan(0);
});
