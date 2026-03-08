import { type Cradle } from "@fastify/awilix";
import { OrderNotFoundError } from "@/errors/order-not-found.error.js";
import { type OrderRepository } from "@/repositories/order.repository.js";
import { type ProductOrderHandler } from "./product-order-handler.js";

export type ProcessOrderResult = { orderId: number };

export class OrderProcessingService {
  private readonly orderRepository: OrderRepository;
  private readonly productOrderHandler: ProductOrderHandler;

  public constructor({
    orderRepository,
    productOrderHandler,
  }: Pick<Cradle, "orderRepository" | "productOrderHandler">) {
    this.orderRepository = orderRepository;
    this.productOrderHandler = productOrderHandler;
  }

  public async processOrder(orderId: number): Promise<ProcessOrderResult> {
    const order = await this.orderRepository.findByIdWithProducts(orderId);

    if (!order) {
      throw new OrderNotFoundError(orderId);
    }

    if (order.products) {
      for (const { product } of order.products) {
        await this.productOrderHandler.handleProduct(product);
      }
    }

    return { orderId: order.id };
  }
}
