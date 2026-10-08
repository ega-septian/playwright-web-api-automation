import { faker } from "@faker-js/faker";
import { RegisterUserRequest } from "../types/user.types";

export function createUserPayload(
  overrides: Partial<RegisterUserRequest> = {},
): RegisterUserRequest {
  return {
    first_name: faker.person.firstName(),
    last_name: faker.person.lastName(),
    dob: "2000-01-02",
    phone: faker.string.numeric(10),
    address: {
      street: faker.location.street(),
      city: faker.location.city(),
      country: faker.location.country(),
      state: faker.location.state(),
      house_number: faker.location.buildingNumber(),
      postal_code: faker.location.zipCode(),
    },
    password: "Puy3r16@",
    email: faker.internet.email(),
    ...overrides,
  };
}
