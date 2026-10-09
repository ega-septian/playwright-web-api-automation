import { faker } from "@faker-js/faker";
import { CreateBrandRequest } from "../types/brand.types";

export function createBrandPayload(override: Partial<CreateBrandRequest> = {}): CreateBrandRequest {
  return {
    name: faker.commerce.productName(),
    slug: faker.lorem.slug(),
    ...override,
  };
}

export function updateBrandPayload(override: Partial<CreateBrandRequest> = {}): CreateBrandRequest {
  return { name: faker.commerce.productName(), slug: faker.lorem.slug(), ...override };
}
