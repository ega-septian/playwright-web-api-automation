import * as z from "zod";

export const AddressSchema = z.strictObject({
  street: z.string(),
  house_number: z.string().nullable(),
  city: z.string(),
  state: z.string().nullable(),
  country: z.string(),
  postal_code: z.string(),
});

export const RegisterUserResponse = z.strictObject({
  first_name: z.string(),
  last_name: z.string(),
  address: AddressSchema,
  phone: z.string().nullable(),
  dob: z.string(),
  email: z.string(),
  id: z.string(),
  created_at: z.string(),
  // Ada di kontrak (UserResponse), tapi tidak dikirim saat register.
  provider: z.string().nullable().optional(),
  totp_enabled: z.boolean().optional(),
  enabled: z.boolean().optional(),
  failed_login_attempts: z.number().int().nullable().optional(),
});

export const LoginResponseSchema = z.strictObject({
  access_token: z.string(),
  token_type: z.string(),
  expires_in: z.number(),
});
