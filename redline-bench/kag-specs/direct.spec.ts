import { expect, test } from "redline-playwright/fixture";

// Memanggil endpoint yang sama dengan helper, tapi tanpa helper dan tanpa schema bersama.
test.describe("kag direct", () => {
  test("brand by id without helper", { tag: "@TC-KAG-05" }, async ({ request }) => {
    const response = await request.get("/brands/1");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.id).toBe(1);
    expect(typeof body.slug).toBe("string");
  });
});
