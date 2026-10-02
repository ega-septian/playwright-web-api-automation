import * as z from "zod";

export const BookingdatesSchema = z.object({
  checkin: z.iso.date(),
  checkout: z.iso.date(),
});

export const BookingSchema = z.object({
  firstname: z.string().min(1),
  lastname: z.string().min(1),
  totalprice: z.number().positive().int(),
  depositpaid: z.boolean(),
  bookingdates: BookingdatesSchema,
  additionalneeds: z.string(),
});

export const CreateBookingResponseSchema = z.object({
  bookingid: z.number().positive().int(),
  booking: BookingSchema,
});

export const BookingIdListSchema = z.array(
  z.object({
    bookingid: z.number().positive().int(),
  }),
);
