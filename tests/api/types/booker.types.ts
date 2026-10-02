export type CreateBookingTypes = {
  firstname: string;
  lastname: string;
  totalprice: number;
  depositpaid: boolean;
  bookingdates: BookingDateTypes;
  additionalneeds: string;
};

export type BookingDateTypes = {
  checkin: string;
  checkout: string;
};
