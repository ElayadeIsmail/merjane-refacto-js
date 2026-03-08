import { describe, it, expect, beforeEach } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import { OrderProcessingService } from "./order-processing.service.js";
import { type OrderRepository } from "@/repositories/order.repository.js";
import { type ProductOrderHandler } from "./product-order-handler.js";
import { OrderNotFoundError } from "@/errors/order-not-found.error.js";

describe("OrderProcessingService", () => {
  let orderRepository: DeepMockProxy<OrderRepository>;
  let productOrderHandler: DeepMockProxy<ProductOrderHandler>;

  beforeEach(() => {
    orderRepository = mockDeep<OrderRepository>();
    productOrderHandler = mockDeep<ProductOrderHandler>();
  });

  function createService() {
    return new OrderProcessingService({
      orderRepository,
      productOrderHandler,
    });
  }

  it("returns order id when order exists and has no products", async () => {
    const orderId = 42;
    orderRepository.findByIdWithProducts.mockResolvedValue({
      id: orderId,
      products: [],
    });

    const result = await createService().processOrder(orderId);

    expect(result).toEqual({ orderId: 42 });
    expect(orderRepository.findByIdWithProducts).toHaveBeenCalledWith(42);
    expect(productOrderHandler.handleProduct).not.toHaveBeenCalled();
  });

  it("returns order id and handles each product when order has products", async () => {
    const orderId = 1;
    const product = {
      id: 10,
      name: "USB Cable",
      type: "NORMAL" as const,
      available: 5,
      leadTime: 2,
      expiryDate: null,
      seasonStartDate: null,
      seasonEndDate: null,
    };
    orderRepository.findByIdWithProducts.mockResolvedValue({
      id: orderId,
      products: [{ product }, { product: { ...product, id: 11 } }],
    });

    const result = await createService().processOrder(orderId);

    expect(result).toEqual({ orderId: 1 });
    expect(productOrderHandler.handleProduct).toHaveBeenCalledTimes(2);
    expect(productOrderHandler.handleProduct).toHaveBeenNthCalledWith(
      1,
      product,
    );
    expect(productOrderHandler.handleProduct).toHaveBeenNthCalledWith(2, {
      ...product,
      id: 11,
    });
  });

  it("throws OrderNotFoundError when order does not exist", async () => {
    orderRepository.findByIdWithProducts.mockResolvedValue(undefined);

    await expect(createService().processOrder(999)).rejects.toThrow(
      OrderNotFoundError,
    );
    await expect(createService().processOrder(999)).rejects.toMatchObject({
      code: "ORDER_NOT_FOUND",
      message: "Order not found: 999",
    });
  });
});
