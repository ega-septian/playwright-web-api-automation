import { test, expect } from "./fixtures";
import { login } from "./fixtures/auth.fixture";
import { createUserPayload } from "./data/user.data";
import { registerUser } from "./helper/user.helper";
import {
  LoginErrorSchema,
  LoginResponseSchema,
  UserResponseSchema,
  UserUpdateResponseSchema,
} from "./schemas/user.schema";
import { LoginRequest } from "./types/user.types";

// The contract documents only 200. The 401, 403 and 423 here pin current Toolshop behaviour, and the
// missing documentation is reported. A missing or wrong-type field gives 401, not 422: accepted, since
// a login that doesn't say which field was wrong gives an attacker less to go on.
const WRONG_PASSWORD = "Wrong-Pa55word";

test.describe("POST /users/login", () => {
  test("Login succeeds with a registered user", { tag: "@TC-USR-002" }, async ({ request }) => {
    const { user, credentials } = await test.step("Register a user", () => registerUser(request));

    const token = await test.step("Log in", async () => {
      const response = await request.post("/users/login", { data: credentials });
      expect(response.status()).toBe(200);
      const body = LoginResponseSchema.parse(await response.json());
      expect(body.token_type).toBe("bearer");
      expect(body.expires_in).toBeGreaterThan(0);
      return body.access_token;
    });

    await test.step("Validate the token belongs to the user", async () => {
      const response = await request.get("/users/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(response.status()).toBe(200);
      const me = UserResponseSchema.parse(await response.json());
      expect(me).toMatchObject({ id: user.id, email: credentials.email });
    });
  });

  test("Login fails when the password is wrong", { tag: "@TC-USR-003" }, async ({ request }) => {
    const { credentials } = await test.step("Register a user", () => registerUser(request));

    await test.step("Log in with a wrong password", async () => {
      const response = await request.post("/users/login", {
        data: { ...credentials, password: WRONG_PASSWORD },
      });
      expect(response.status()).toBe(401);
      expect(LoginErrorSchema.parse(await response.json())).toEqual({ error: "Unauthorized" });
    });

    await test.step("Validate the account still logs in", async () => {
      await login(request, credentials);
    });
  });

  test(
    "Login fails when the email is not registered",
    { tag: "@TC-USR-004" },
    async ({ request }) => {
      const { email, password } = createUserPayload();

      await test.step("Log in with an unregistered email", async () => {
        const response = await request.post("/users/login", { data: { email, password } });
        expect(response.status()).toBe(401);
        expect(LoginErrorSchema.parse(await response.json())).toEqual({ error: "Unauthorized" });
      });
    },
  );

  test("Login fails when email is missing", { tag: "@TC-USR-005" }, async ({ request }) => {
    const { password } = createUserPayload();

    await test.step("Log in without email", async () => {
      const response = await request.post("/users/login", { data: { password } });
      expect(response.status()).toBe(401);
      const body = LoginErrorSchema.parse(await response.json());
      expect(body).toEqual({ error: "Invalid login request" });
    });
  });

  test("Login fails when password is missing", { tag: "@TC-USR-006" }, async ({ request }) => {
    const { credentials } = await test.step("Register a user", () => registerUser(request));

    await test.step("Log in without password", async () => {
      const response = await request.post("/users/login", { data: { email: credentials.email } });
      expect(response.status()).toBe(401);
      const body = LoginErrorSchema.parse(await response.json());
      expect(body).toEqual({ error: "Invalid login request" });
    });
  });

  test("Login fails when email is empty", { tag: "@TC-USR-007" }, async ({ request }) => {
    const { password } = createUserPayload();

    await test.step("Log in with an empty email", async () => {
      const response = await request.post("/users/login", { data: { email: "", password } });
      expect(response.status()).toBe(401);
      const body = LoginErrorSchema.parse(await response.json());
      expect(body).toEqual({ error: "Invalid login request" });
    });
  });

  test("Login fails when email is a number", { tag: "@TC-USR-008" }, async ({ request }) => {
    const { password } = createUserPayload();

    await test.step("Log in with a number as email", async () => {
      const response = await request.post("/users/login", { data: { email: 12345, password } });
      expect(response.status()).toBe(401);
      expect(LoginErrorSchema.parse(await response.json())).toEqual({ error: "Unauthorized" });
    });
  });

  test("Login fails when password is a number", { tag: "@TC-USR-009" }, async ({ request }) => {
    const { credentials } = await test.step("Register a user", () => registerUser(request));

    await test.step("Log in with a number as password", async () => {
      const response = await request.post("/users/login", {
        data: { email: credentials.email, password: 12345678 },
      });
      expect(response.status()).toBe(401);
      expect(LoginErrorSchema.parse(await response.json())).toEqual({ error: "Unauthorized" });
    });
  });

  test(
    "Login fails when the account is locked after three wrong passwords",
    { tag: "@TC-USR-010" },
    async ({ request }) => {
      const { credentials } = await test.step("Register a user", () => registerUser(request));

      for (const attempt of [1, 2, 3]) {
        await test.step(`Log in with a wrong password, attempt ${attempt}`, async () => {
          const response = await request.post("/users/login", {
            data: { ...credentials, password: WRONG_PASSWORD },
          });
          expect(response.status()).toBe(401);
        });
      }

      await test.step("Log in with the right password", async () => {
        const response = await request.post("/users/login", { data: credentials });
        expect(response.status()).toBe(423);
        expect(LoginErrorSchema.parse(await response.json())).toEqual({
          error: "Account locked, too many failed attempts. Please contact the administrator.",
        });
      });
    },
  );

  test(
    "Login succeeds when a successful login resets the failed attempts",
    { tag: "@TC-USR-011" },
    async ({ request }) => {
      const { credentials } = await test.step("Register a user", () => registerUser(request));

      const wrong: LoginRequest = { ...credentials, password: WRONG_PASSWORD };
      const attempts = [
        { label: "a wrong", data: wrong, status: 401 },
        { label: "a wrong", data: wrong, status: 401 },
        { label: "the right", data: credentials, status: 200 },
        { label: "a wrong", data: wrong, status: 401 },
        { label: "a wrong", data: wrong, status: 401 },
        { label: "the right", data: credentials, status: 200 },
      ];

      for (const { label, data, status } of attempts) {
        await test.step(`Log in with ${label} password, expect ${status}`, async () => {
          const response = await request.post("/users/login", { data });
          expect(response.status()).toBe(status);
        });
      }
    },
  );

  test(
    "Login fails when the account is disabled",
    { tag: "@TC-USR-012" },
    async ({ request, adminToken }) => {
      const { user, credentials } = await test.step("Register a user", () => registerUser(request));

      await test.step("Disable the account as admin", async () => {
        const response = await request.patch(`/users/${user.id}`, {
          data: { enabled: false },
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        expect(response.status()).toBe(200);
        expect(UserUpdateResponseSchema.parse(await response.json())).toEqual({ success: true });
      });

      await test.step("Log in", async () => {
        const response = await request.post("/users/login", { data: credentials });
        expect(response.status()).toBe(403);
        expect(LoginErrorSchema.parse(await response.json())).toEqual({
          error: "Account disabled",
        });
      });
    },
  );
});
