import { type FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { OrderNotFoundError } from "@/errors/order-not-found.error.js";
import {
  orderIdParamSchema,
  orderResponseSchema,
  orderNotFoundSchema,
} from "./order.schema.js";

export const processOrderRoute: FastifyPluginAsyncZod = async (server) => {
  server.post(
    "/orders/:orderId/processOrder",
    {
      schema: {
        params: orderIdParamSchema,
        response: {
          200: orderResponseSchema,
          404: orderNotFoundSchema,
        },
      },
    },
    async (request, reply) => {
      const { orderProcessingService } = server.diContainer.cradle;

      try {
        const result = await orderProcessingService.processOrder(
          request.params.orderId,
        );
        return reply.send(result);
      } catch (error) {
        if (error instanceof OrderNotFoundError) {
          return reply.status(404).send({
            error: error.message,
            code: error.code,
          });
        }
        throw error;
      }
    },
  );
};
