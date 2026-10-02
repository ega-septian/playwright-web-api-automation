import { z } from "zod";

export const UserResponseSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  email: z.email(),
  gender: z.enum(["male", "female"]),
  status: z.enum(["active", "inactive"]),
});

export const UserListResponseSchema = z.array(UserResponseSchema);

export const NotFoundErrorSchema = z.object({
  message: z.string(),
});

export const ValidationErrorSchema = z.object({
  field: z.string(),
  message: z.string(),
});
export const ValidationListErrorSchema = z.array(ValidationErrorSchema);
