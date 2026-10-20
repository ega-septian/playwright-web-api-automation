import { faker } from "@faker-js/faker";
import { CreateProductRequest } from "../types/product.types";

/** Category, brand and image ids are required. The image is from /images; tests create the rest. */
export function createProductPayload(
  refs: Pick<CreateProductRequest, "category_id" | "brand_id" | "product_image_id">,
  overrides: Partial<CreateProductRequest> = {},
): CreateProductRequest {
  return {
    name: faker.commerce.productName(),
    description: faker.commerce.productDescription(),
    price: Number(faker.commerce.price({ min: 1, max: 100 })),
    // Fixed on purpose: a regular product, not a rental or location offer. Not relevant to brands.
    is_location_offer: false,
    is_rental: false,
    co2_rating: faker.helpers.arrayElement(["A", "B", "C", "D", "E"]),
    ...refs,
    ...overrides,
  };
}
