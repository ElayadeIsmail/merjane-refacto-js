import fastifyPlugin from "fastify-plugin";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { processOrderRoute } from "./process-order.route.js";

export const OrderController = fastifyPlugin(async (server) => {
  server.setValidatorCompiler(validatorCompiler);
  server.setSerializerCompiler(serializerCompiler);

  await server.withTypeProvider<ZodTypeProvider>().register(processOrderRoute);
});
