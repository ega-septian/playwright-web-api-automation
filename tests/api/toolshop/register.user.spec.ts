import { test, expect } from "./fixtures";
import { login } from "./fixtures/auth.fixture";
import { createUserPayload } from "./data/user.data";
import { UserResponseSchema } from "./schemas/user.schema";
import { toExpectedUser } from "./helper/user.helper";

test.describe("POST /users/register", () => {
  test(
    "Register using completed data successfully",
    { tag: "@TC-USR-001" },
    async ({ request }) => {
      const payload = createUserPayload();

      const user = await test.step("Register user", async () => {
        const response = await request.post("/users/register", { data: payload });
        expect(response.status()).toBe(201);
        const body = await response.json();
        const user = UserResponseSchema.parse(body);
        expect(user).toMatchObject(toExpectedUser(payload));
        expect(body).not.toHaveProperty("password");
        return user;
      });

      const token = await test.step("Log in as the new user", async () =>
        login(request, { email: payload.email, password: payload.password }));

      await test.step("Validate the user is stored", async () => {
        const response = await request.get("/users/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        expect(response.status()).toBe(200);
        const me = UserResponseSchema.parse(await response.json());
        expect(me).toMatchObject({ id: user.id, ...toExpectedUser(payload) });
      });
    },
  );
});
