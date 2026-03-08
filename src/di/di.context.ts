import { type Cradle, diContainer } from "@fastify/awilix";
import { asClass, asValue } from "awilix";
import { type FastifyBaseLogger, type FastifyInstance } from "fastify";
import { type INotificationService } from "@/services/notifications.port.js";
import { NotificationService } from "@/services/impl/notification.service.js";
import { OrderProcessingService } from "@/services/impl/order-processing.service.js";
import { ProductOrderHandler } from "@/services/impl/product-order-handler.js";
import { type Database } from "@/db/type.js";
import { ProductService } from "@/services/impl/product.service.js";
import { ProductRepository } from "@/repositories/product.repository.js";
import { OrderRepository } from "@/repositories/order.repository.js";

declare module "@fastify/awilix" {
  interface Cradle {
    // eslint-disable-line @typescript-eslint/consistent-type-definitions
    logger: FastifyBaseLogger;
    db: Database;
    productRepository: ProductRepository;
    orderRepository: OrderRepository;
    notificationService: INotificationService;
    productService: ProductService;
    productOrderHandler: ProductOrderHandler;
    orderProcessingService: OrderProcessingService;
  }
}

export async function configureDiContext(
  server: FastifyInstance,
): Promise<void> {
  diContainer.register({
    logger: asValue(server.log),
  });
  diContainer.register({
    db: asValue(server.database),
  });
  diContainer.register({
    productRepository: asClass(ProductRepository),
  });
  diContainer.register({
    orderRepository: asClass(OrderRepository),
  });
  diContainer.register({
    notificationService: asClass(NotificationService),
  });
  diContainer.register({
    productService: asClass(ProductService),
  });
  diContainer.register({
    productOrderHandler: asClass(ProductOrderHandler),
  });
  diContainer.register({
    orderProcessingService: asClass(OrderProcessingService),
  });
}

export function resolve<Service extends keyof Cradle>(
  service: Service,
): Cradle[Service] {
  return diContainer.resolve(service);
}
