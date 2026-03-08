import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { type FastifyInstance } from "fastify";
import { buildFastify } from "@/fastify.js";
import { resolve } from "./di.context.js";
import { OrderRepository } from "@/repositories/order.repository.js";
import { ProductRepository } from "@/repositories/product.repository.js";
import { ProductService } from "@/services/impl/product.service.js";
import { ProductOrderHandler } from "@/services/impl/product-order-handler.js";
import { OrderProcessingService } from "@/services/impl/order-processing.service.js";
import { OrderNotFoundError } from "@/errors/order-not-found.error.js";

describe("DI context", () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
    fastify = await buildFastify();
    await fastify.ready();
  });

  afterEach(async () => {
    await fastify.close();
  });

  it("resolves logger", () => {
    const logger = resolve("logger");

    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.error).toBe("function");
  });

  it("resolves db", () => {
    const db = resolve("db");

    expect(db).toBeDefined();
    expect(db.query).toBeDefined();
    expect(db.query.orders).toBeDefined();
    expect(db.query.products).toBeDefined();
  });

  it("resolves orderRepository as OrderRepository", () => {
    const orderRepository = resolve("orderRepository");

    expect(orderRepository).toBeInstanceOf(OrderRepository);
    expect(typeof orderRepository.findByIdWithProducts).toBe("function");
  });

  it("resolves productRepository as ProductRepository", () => {
    const productRepository = resolve("productRepository");

    expect(productRepository).toBeInstanceOf(ProductRepository);
    expect(typeof productRepository.update).toBe("function");
    expect(typeof productRepository.decrementStock).toBe("function");
  });

  it("resolves notificationService", () => {
    const notificationService = resolve("notificationService");

    expect(notificationService).toBeDefined();
    expect(typeof notificationService.sendDelayNotification).toBe("function");
    expect(typeof notificationService.sendOutOfStockNotification).toBe(
      "function",
    );
    expect(typeof notificationService.sendExpirationNotification).toBe(
      "function",
    );
  });

  it("resolves productService as ProductService", () => {
    const productService = resolve("productService");

    expect(productService).toBeInstanceOf(ProductService);
    expect(typeof productService.notifyDelay).toBe("function");
    expect(typeof productService.handleSeasonalProduct).toBe("function");
    expect(typeof productService.handleExpiredProduct).toBe("function");
  });

  it("resolves productOrderHandler as ProductOrderHandler", () => {
    const productOrderHandler = resolve("productOrderHandler");

    expect(productOrderHandler).toBeInstanceOf(ProductOrderHandler);
    expect(typeof productOrderHandler.handleProduct).toBe("function");
  });

  it("resolves orderProcessingService as OrderProcessingService", () => {
    const orderProcessingService = resolve("orderProcessingService");

    expect(orderProcessingService).toBeInstanceOf(OrderProcessingService);
    expect(typeof orderProcessingService.processOrder).toBe("function");
  });

  it("orderProcessingService is wired and uses orderRepository", async () => {
    const orderProcessingService = resolve("orderProcessingService");

    await expect(orderProcessingService.processOrder(99999)).rejects.toThrow(
      OrderNotFoundError,
    );
  });
});
