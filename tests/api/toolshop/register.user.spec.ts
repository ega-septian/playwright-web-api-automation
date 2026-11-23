import { test, expect } from "./fixtures";
import { login } from "./fixtures/auth.fixture";
import { createUserPayload } from "./data/user.data";
import {
  LoginErrorSchema,
  UserConflictSchema,
  UserResponseSchema,
  UserValidationErrorSchema,
} from "./schemas/user.schema";
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

  test("Register fails when first name is missing", { tag: "@TC-USR-002" }, async ({ request }) => {
    const { first_name, ...payload } = createUserPayload();

    await test.step("Register without first name", async () => {
      const response = await request.post("/users/register", { data: payload });
      expect(response.status()).toBe(422);
      const data = UserValidationErrorSchema.parse(await response.json());
      expect(data.first_name).toContainEqual("The first name field is required.");
    });

    await test.step("Validate no account was created", async () => {
      const response = await request.post("/users/login", {
        data: { email: payload.email, password: payload.password },
      });
      expect(response.status()).toBe(401);
      LoginErrorSchema.parse(await response.json());
    });
  });

  test("Register fails when last name is missing", { tag: "@TC-USR-003" }, async ({ request }) => {
    const { last_name, ...payload } = createUserPayload();

    await test.step("Register without last name", async () => {
      const response = await request.post("/users/register", { data: payload });
      expect(response.status()).toBe(422);
      const data = UserValidationErrorSchema.parse(await response.json());
      expect(data.last_name).toContainEqual("The last name field is required.");
    });

    await test.step("Validate no account was created", async () => {
      const response = await request.post("/users/login", {
        data: { email: payload.email, password: payload.password },
      });
      expect(response.status()).toBe(401);
      LoginErrorSchema.parse(await response.json());
    });
  });

  test("Register fails when email is missing", { tag: "@TC-USR-004" }, async ({ request }) => {
    const { email, ...payload } = createUserPayload();

    await test.step("Register without email", async () => {
      const response = await request.post("/users/register", { data: payload });
      expect(response.status()).toBe(422);
      const data = UserValidationErrorSchema.parse(await response.json());
      expect(data.email).toContainEqual("The email field is required.");
    });

    // No email was sent, so there is no address to look up with the login endpoint.
  });

  test("Register fails when password is missing", { tag: "@TC-USR-005" }, async ({ request }) => {
    const { password, ...payload } = createUserPayload();

    await test.step("Register without password", async () => {
      const response = await request.post("/users/register", { data: payload });
      expect(response.status()).toBe(422);
      const data = UserValidationErrorSchema.parse(await response.json());
      expect(data.password).toContainEqual("The password field is required.");
    });

    await test.step("Validate no account was created", async () => {
      const response = await request.post("/users/login", {
        data: { email: payload.email, password: "Puy3r16@" },
      });
      expect(response.status()).toBe(401);
      LoginErrorSchema.parse(await response.json());
    });
  });

  test(
    "Register fails when password is shorter than 8 characters",
    { tag: "@TC-USR-006" },
    async ({ request }) => {
      const payload = createUserPayload({ password: "Pu3r@" });

      await test.step("Register with a short password", async () => {
        const response = await request.post("/users/register", { data: payload });
        expect(response.status()).toBe(422);
        const data = UserValidationErrorSchema.parse(await response.json());
        expect(data.password).toContainEqual("The password field must be at least 8 characters.");
      });

      await test.step("Validate no account was created", async () => {
        const response = await request.post("/users/login", {
          data: { email: payload.email, password: payload.password },
        });
        expect(response.status()).toBe(401);
        LoginErrorSchema.parse(await response.json());
      });
    },
  );

  test(
    "Register fails when password has no uppercase or lowercase letter",
    { tag: "@TC-USR-007" },
    async ({ request }) => {
      const payload = createUserPayload({ password: "puy3r16@" });

      await test.step("Register with a password without an uppercase letter", async () => {
        const response = await request.post("/users/register", { data: payload });
        expect(response.status()).toBe(422);
        const data = UserValidationErrorSchema.parse(await response.json());
        expect(data.password).toContainEqual(
          "The password field must contain at least one uppercase and one lowercase letter.",
        );
      });

      await test.step("Validate no account was created", async () => {
        const response = await request.post("/users/login", {
          data: { email: payload.email, password: payload.password },
        });
        expect(response.status()).toBe(401);
        LoginErrorSchema.parse(await response.json());
      });
    },
  );

  test(
    "Register fails when password has no number",
    { tag: "@TC-USR-008" },
    async ({ request }) => {
      const payload = createUserPayload({ password: "Puyer!ab" });

      await test.step("Register with a password without a number", async () => {
        const response = await request.post("/users/register", { data: payload });
        expect(response.status()).toBe(422);
        const data = UserValidationErrorSchema.parse(await response.json());
        expect(data.password).toContainEqual(
          "The password field must contain at least one number.",
        );
      });

      await test.step("Validate no account was created", async () => {
        const response = await request.post("/users/login", {
          data: { email: payload.email, password: payload.password },
        });
        expect(response.status()).toBe(401);
        LoginErrorSchema.parse(await response.json());
      });
    },
  );

  test(
    "Register fails when password has no symbol",
    { tag: "@TC-USR-009" },
    async ({ request }) => {
      const payload = createUserPayload({ password: "Puy3r16a" });

      await test.step("Register with a password without a symbol", async () => {
        const response = await request.post("/users/register", { data: payload });
        expect(response.status()).toBe(422);
        const data = UserValidationErrorSchema.parse(await response.json());
        expect(data.password).toContainEqual(
          "The password field must contain at least one symbol.",
        );
      });

      await test.step("Validate no account was created", async () => {
        const response = await request.post("/users/login", {
          data: { email: payload.email, password: payload.password },
        });
        expect(response.status()).toBe(401);
        LoginErrorSchema.parse(await response.json());
      });
    },
  );

  test(
    "Register fails when the email is already registered",
    { tag: "@TC-USR-010" },
    async ({ request }) => {
      const payload = createUserPayload();

      const original = await test.step("Register the original user", async () => {
        const response = await request.post("/users/register", { data: payload });
        expect(response.status()).toBe(201);
        return UserResponseSchema.parse(await response.json());
      });

      await test.step("Register again with the same email", async () => {
        const response = await request.post("/users/register", {
          data: { ...createUserPayload(), email: payload.email },
        });
        expect(response.status()).toBe(409);
        const data = UserConflictSchema.parse(await response.json());
        expect(data.email).toContainEqual("A customer with this email address already exists.");
      });

      await test.step("Validate the original user is unchanged", async () => {
        const token = await login(request, {
          email: payload.email,
          password: payload.password,
        });
        const response = await request.get("/users/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        expect(response.status()).toBe(200);
        const me = UserResponseSchema.parse(await response.json());
        expect(me).toMatchObject({
          id: original.id,
          first_name: payload.first_name,
          last_name: payload.last_name,
        });
      });
    },
  );
});
