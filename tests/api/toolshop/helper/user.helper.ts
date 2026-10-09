import { RegisterUserRequest } from "../types/user.types";

export function toExpectedUser(payload: RegisterUserRequest) {
  const { password, ...rest } = payload;
  return rest;
}
