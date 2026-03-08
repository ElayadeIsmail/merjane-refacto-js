import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify from "fastify";
import { asValue } from "awilix";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import supertest from "supertest";
import { awilixPlugin } from "@/di/awilix.plugin.js";
import { OrderController } from "./order.controller.js";
import { type OrderProcessingService } from "@/services/impl/order-processing.service.js";
import { OrderNotFoundError } from "@/errors/order-not-found.error.js";

describe("ProcessOrder route", () => {
  let app: Awaited<ReturnType<typeof createApp>>;
  let orderProcessingServiceMock: DeepMockProxy<OrderProcessingService>;

  async function createApp() {
    const server = Fastify();
    await server.register(awilixPlugin());
    server.diContainer.register({
      orderProcessingService: asValue(
        orderProcessingServiceMock as unknown as OrderProcessingService,
      ),
    });
    await server.register(OrderController);
    return server;
  }

  beforeEach(async () => {
    orderProcessingServiceMock = mockDeep<OrderProcessingService>();
    app = await createApp();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns 200 and orderId when processing succeeds", async () => {
    orderProcessingServiceMock.processOrder.mockResolvedValue({ orderId: 42 });

    const response = await supertest(app.server)
      .post("/orders/42/processOrder")
      .expect(200);

    expect(response.body).toEqual({ orderId: 42 });
    expect(orderProcessingServiceMock.processOrder).toHaveBeenCalledWith(42);
  });

  it("returns 404 and error body when order is not found", async () => {
    orderProcessingServiceMock.processOrder.mockRejectedValue(
      new OrderNotFoundError(99),
    );

    const response = await supertest(app.server)
      .post("/orders/99/processOrder")
      .expect(404);

    expect(response.body).toMatchObject({
      error: "Order not found: 99",
      code: "ORDER_NOT_FOUND",
    });
  });

  it("returns 400 when orderId param is not a positive number", async () => {
    await supertest(app.server).post("/orders/0/processOrder").expect(400);

    await supertest(app.server).post("/orders/-1/processOrder").expect(400);

    expect(orderProcessingServiceMock.processOrder).not.toHaveBeenCalled();
  });

  it("returns 400 when orderId param is not a number", async () => {
    await supertest(app.server).post("/orders/abc/processOrder").expect(400);

    expect(orderProcessingServiceMock.processOrder).not.toHaveBeenCalled();
  });
});
