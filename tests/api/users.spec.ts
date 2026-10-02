import { test, expect } from "@playwright/test";
import {
  NotFoundErrorSchema,
  UserListResponseSchema,
  UserResponseSchema,
  ValidationErrorSchema,
  ValidationListErrorSchema,
} from "./schemas/user.schema";
import { createUserPayload, updateUserpayload } from "./data/user.data";

test.describe("API User", () => {
  test("GET /users returns valid user list", async ({ request }) => {
    const res = await request.get("/public/v2/users");
    expect(res.status()).toBe(200);

    const users = UserListResponseSchema.parse(await res.json());
    expect(users.length).toBeGreaterThan(0);
  });

  test("Create a new user successfully", async ({ request }) => {
    const payload = createUserPayload();
    const res = await request.post("public/v2/users", {
      data: payload,
      headers: {
        Authorization: `Bearer ${process.env.GOREST_TOKEN}`,
      },
    });
    expect(res.status()).toBe(201);

    const users = UserResponseSchema.parse(await res.json());
    expect(users).toMatchObject(payload);
  });

  test("Verified email has already been taken", async ({ request }) => {
    const payload = createUserPayload();
    const newUser = await request.post("public/v2/users", {
      data: payload,
      headers: {
        Authorization: `Bearer ${process.env.GOREST_TOKEN}`,
      },
    });
    expect(newUser.status()).toBe(201);

    const res = await request.post("public/v2/users", {
      data: payload,
      headers: {
        Authorization: `Bearer ${process.env.GOREST_TOKEN}`,
      },
    });
    expect(res.status()).toBe(422);

    const users = ValidationListErrorSchema.parse(await res.json());
    expect(users).toContainEqual({
      field: "email",
      message: "has already been taken",
    });
  });

  test("Successfully update user name and status to inactive", async ({
    request,
  }) => {
    // Create a new user
    const payloadNewUser = createUserPayload();
    const reqNewUser = await request.post("public/v2/users", {
      data: payloadNewUser,
      headers: {
        Authorization: `Bearer ${process.env.GOREST_TOKEN}`,
      },
    });
    expect(reqNewUser.status()).toBe(201);
    const newUserID = UserResponseSchema.parse(await reqNewUser.json()).id;

    // Update user name & status
    const payloadUpdate = updateUserpayload();
    const res = await request.put(`public/v2/users/${newUserID}`, {
      data: payloadUpdate,
      headers: {
        Authorization: `Bearer ${process.env.GOREST_TOKEN}`,
      },
    });
    expect(res.status()).toBe(200);

    const respData = UserResponseSchema.parse(await res.json());
    expect(respData).toMatchObject(payloadUpdate);
  });

  test("Validate update user invalid data", async ({ request }) => {
    const payloadUpdate = updateUserpayload();
    const resp = await request.put(`public/v2/users/invalid`, {
      data: payloadUpdate,
      headers: {
        Authorization: `Bearer ${process.env.GOREST_TOKEN}`,
      },
    });

    expect(resp.status()).toBe(404);
    const respData = NotFoundErrorSchema.parse(await resp.json());
    expect(respData.message).toEqual("Resource not found");
  });
});
