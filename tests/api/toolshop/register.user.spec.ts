import { expect, test } from "../../../fixtures/redline";
import { createUserPayload } from "./data/user.data";
import { RegisterUserResponse } from "./schemas/user.schema";
import { toExpectedUser } from "./helper/user.helper";

test.describe.skip("Register User Suite", () => {
  test("Register using completed data successfully", { tag: "@TC-USR-001" }, async ({ request }) => {
    const payload = createUserPayload();
    const response = await request.post("/users/register", {
      data: payload,
    });
    const body = await response.json();
    expect(response.status()).toBe(201);
    const data = RegisterUserResponse.parse(body);
    expect(data).toMatchObject(toExpectedUser(payload));
    expect(body).not.toHaveProperty("password");
  });
});
