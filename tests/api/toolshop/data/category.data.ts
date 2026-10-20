import { faker } from "@faker-js/faker";
import { CreateCategoryRequest } from "../types/category.types";

export function createCategoryPayload(
  overrides: Partial<CreateCategoryRequest> = {},
): CreateCategoryRequest {
  return {
    name: faker.commerce.department(),
    slug: `${faker.lorem.slug()}-${faker.string.alphanumeric(6).toLowerCase()}`,
    ...overrides,
  };
}
