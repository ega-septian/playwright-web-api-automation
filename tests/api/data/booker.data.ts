import { faker } from "@faker-js/faker";
import { CreateBookingTypes } from "../types/booker.types";

export function createBookingPayload(
  overrides: Partial<CreateBookingTypes> = {},
): CreateBookingTypes {
  return {
    firstname: faker.person.firstName(),
    lastname: faker.person.lastName(),
    totalprice: 100000,
    depositpaid: true,
    bookingdates: {
      checkin: "2026-05-08",
      checkout: "2026-06-07",
    },
    additionalneeds: "fried rice",
    ...overrides,
  };
}
