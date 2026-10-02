import { expect, test } from "@playwright/test";
import { createBookingPayload } from "./data/booker.data";
import {
  BookingIdListSchema,
  BookingSchema,
  CreateBookingResponseSchema,
} from "./schemas/booker.schema";
import { CreateBookingTypes } from "./types/booker.types";

test.describe("Create Booking", () => {
  const bookingCases = [
    { title: "deposit true", depositPaid: true },
    { title: "deposit false", depositPaid: false },
  ];

  for (const booking of bookingCases) {
    test(`Create booking using ${booking.title} successfully`, async ({
      request,
    }) => {
      const payload = createBookingPayload({
        depositpaid: booking.depositPaid,
      });

      const bookingId = await test.step("POST api create booking", async () => {
        const response = await request.post("/booking", {
          data: payload,
        });

        expect(response.status()).toBe(200);
        const data = CreateBookingResponseSchema.parse(await response.json());
        expect(data.booking).toMatchObject(payload);
        return data.bookingid;
      });

      await test.step("GET booking to verify it was saved", async () => {
        const response = await request.get(`/booking/${bookingId}`);
        expect(response.status()).toBe(200);
        const data = BookingSchema.parse(await response.json());
        expect(data).toMatchObject(payload);
      });
    });
  }
});

test.describe("Search Booking", () => {
  const searchCases = [
    {
      title: "firstname",
      params: (p: CreateBookingTypes) => ({ firstname: p.firstname }),
    },
    {
      title: "lastname",
      params: (p: CreateBookingTypes) => ({ lastname: p.lastname }),
    },
  ];

  for (const { title, params } of searchCases) {
    test(`User able to search booking using ${title}`, async ({ request }) => {
      const payload = createBookingPayload();

      const bookingId =
        await test.step("Precondition: create booking", async () => {
          const response = await request.post("/booking", {
            data: payload,
          });

          expect(response.status()).toBe(200);
          const data = CreateBookingResponseSchema.parse(await response.json());
          return data.bookingid;
        });

      await test.step(`Search booking using ${title}`, async () => {
        const response = await request.get("/booking", {
          params: params(payload),
        });

        expect(response.status()).toBe(200);
        const data = BookingIdListSchema.parse(await response.json());
        expect(data).toContainEqual({ bookingid: bookingId });
      });
    });
  }
});
