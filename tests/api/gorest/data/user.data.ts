import { CreateUserRequest, UpdateUserRequest } from "../types/user.types";
import { faker } from "@faker-js/faker";

export function createUserPayload(overrides: Partial<CreateUserRequest> = {}): CreateUserRequest {
  return {
    name: "Name Automate Test",
    email: faker.internet.email(),
    gender: "male",
    status: "active",
    ...overrides,
  };
}

export function updateUserpayload(override: Partial<UpdateUserRequest> = {}): UpdateUserRequest {
  return {
    name: "Update Name Automation",
    status: "inactive",
    ...override,
  };
}
