import { z } from "zod";

export const orderIdParamSchema = z.object({
  orderId: z.coerce.number().positive(),
});

export const orderResponseSchema = z.object({
  orderId: z.number(),
});

export const orderNotFoundSchema = z.object({
  error: z.string(),
  code: z.literal("ORDER_NOT_FOUND"),
});
