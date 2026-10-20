import { z } from "zod";

// Error body with a single message, used by many endpoints: 401 "Unauthorized", 403 "Forbidden",
// 404 "Requested item not found".
export const MessageResponseSchema = z.strictObject({
  message: z.string(),
});
