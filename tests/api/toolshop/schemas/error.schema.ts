import { z } from "zod";

// Body error dengan satu pesan, dipakai banyak endpoint: 401 "Unauthorized", 403 "Forbidden",
// 404 "Requested item not found".
export const MessageResponseSchema = z.strictObject({
  message: z.string(),
});
