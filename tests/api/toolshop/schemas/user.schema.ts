import * as z from "zod";

export const AddressSchema = z.object({
  street: z.string(),
  house_number: z.string().nullable(),
  city: z.string(),
  state: z.string().nullable(),
  country: z.string(),
  postal_code: z.string(),
});

export const RegisterUserResponse = z.object({
  first_name: z.string(),
  last_name: z.string(),
  address: AddressSchema,
  phone: z.string().nullable(),
  dob: z.string(),
  email: z.string(),
  id: z.string(),
  created_at: z.string(),
});
