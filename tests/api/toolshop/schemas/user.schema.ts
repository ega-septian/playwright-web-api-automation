import * as z from "zod";

export const AddressSchema = z.strictObject({
  street: z.string(),
  house_number: z.string().nullable(),
  city: z.string(),
  state: z.string().nullable(),
  country: z.string(),
  postal_code: z.string().nullable(),
});

// UserResponse in the contract: the response of register and GET /users/me.
export const UserResponseSchema = z.strictObject({
  first_name: z.string(),
  last_name: z.string(),
  address: AddressSchema,
  phone: z.string().nullable(),
  dob: z.string(),
  email: z.string(),
  id: z.string(),
  created_at: z.string(),
  // In the contract but not always sent: register leaves them out, /users/me sends some.
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

// 401 from POST /users/login: {"error":"Unauthorized"} — not the {message} shape.
export const LoginErrorSchema = z.strictObject({
  error: z.string(),
});

// 422 from POST /users/register: the API documents 400/401/403/409, but required fields and
// password rules return a per-field MessageBag. Fields are optional because each case sends one.
export const UserValidationErrorSchema = z
  .strictObject({
    first_name: z.array(z.string()).optional(),
    last_name: z.array(z.string()).optional(),
    email: z.array(z.string()).optional(),
    password: z.array(z.string()).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, "body 422 tanpa error per field");

// 409 from POST /users/register when the email is already registered (field-level MessageBag).
export const UserConflictSchema = z.strictObject({
  email: z.array(z.string()),
});
