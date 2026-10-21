import { expect, type APIRequestContext } from "@playwright/test";
import { createUserPayload } from "../data/user.data";
import { UserResponseSchema } from "../schemas/user.schema";
import { LoginRequest, RegisterUserRequest } from "../types/user.types";

export function toExpectedUser(payload: RegisterUserRequest) {
  const { password, ...rest } = payload;
  return rest;
}

/** POST /users/register with a fresh user, checking 201 and the schema. Test setup only. */
export async function registerUser(request: APIRequestContext) {
  const payload = createUserPayload();
  const response = await request.post("/users/register", { data: payload });
  expect(response.status()).toBe(201);
  const user = UserResponseSchema.parse(await response.json());
  const credentials: LoginRequest = { email: payload.email, password: payload.password };
  return { user, credentials };
}
