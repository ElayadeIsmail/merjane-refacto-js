import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { type FastifyInstance } from "fastify";
import supertest from "supertest";
import { eq } from "drizzle-orm";
import { type DeepMockProxy, mockDeep } from "vitest-mock-extended";
import { asValue } from "awilix";
import { type INotificationService } from "@/services/notifications.port.js";
import {
  type ProductInsert,
  products,
  orders,
  ordersToProducts,
} from "@/db/schema.js";
import { type Database } from "@/db/type.js";
import { buildFastify } from "@/fastify.js";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("OrderController Integration Tests", () => {
  let fastify: FastifyInstance;
  let database: Database;
  let notificationServiceMock: DeepMockProxy<INotificationService>;

  beforeEach(async () => {
    notificationServiceMock = mockDeep<INotificationService>();

    fastify = await buildFastify();
    fastify.diContainer.register({
      notificationService: asValue(
        notificationServiceMock as INotificationService,
      ),
    });
    await fastify.ready();
    database = fastify.database;
  });

  afterEach(async () => {
    await fastify.close();
  });

  function createOrderWithProducts(productList: ProductInsert[]): number {
    return database.transaction((tx) => {
      const inserted = tx
        .insert(products)
        .values(productList)
        .returning({ productId: products.id })
        .all();
      const [order] = tx.insert(orders).values([{}]).returning().all();
      tx.insert(ordersToProducts)
        .values(
          inserted.map((p) => ({
            orderId: order!.id,
            productId: p.productId,
          })),
        )
        .run();
      return order!.id;
    });
  }

  function createOrderWithNoProducts(): number {
    const [order] = database.insert(orders).values([{}]).returning().all();
    return order!.id;
  }

  it("returns 404 when order does not exist", async () => {
    const client = supertest(fastify.server);

    const response = await client
      .post("/orders/99999/processOrder")
      .expect(404);

    expect(response.body).toMatchObject({
      error: "Order not found: 99999",
      code: "ORDER_NOT_FOUND",
    });
  });

  it("returns 400 when orderId is not a positive number", async () => {
    const client = supertest(fastify.server);

    await client.post("/orders/0/processOrder").expect(400);
    await client.post("/orders/-1/processOrder").expect(400);
  });

  it("returns 400 when orderId is not a number", async () => {
    const client = supertest(fastify.server);

    await client.post("/orders/abc/processOrder").expect(400);
  });

  it("returns 200 and orderId when order has no products", async () => {
    const client = supertest(fastify.server);
    const orderId = createOrderWithNoProducts();

    const response = await client
      .post(`/orders/${orderId}/processOrder`)
      .expect(200)
      .expect("Content-Type", /application\/json/);

    expect(response.body).toEqual({ orderId });
  });

  it("returns 200 and decrements stock for NORMAL product in stock", async () => {
    const client = supertest(fastify.server);
    const orderId = createOrderWithProducts([
      {
        leadTime: 5,
        available: 10,
        type: "NORMAL",
        name: "USB Cable",
      },
    ]);

    await client.post(`/orders/${orderId}/processOrder`).expect(200);

    const [product] = await database.query.products.findMany({
      where: eq(products.name, "USB Cable"),
    });
    expect(product?.available).toBe(9);
    expect(
      notificationServiceMock.sendDelayNotification,
    ).not.toHaveBeenCalled();
  });

  it("returns 200 and sends delay notification for NORMAL product out of stock with lead time", async () => {
    const client = supertest(fastify.server);
    const orderId = createOrderWithProducts([
      {
        leadTime: 10,
        available: 0,
        type: "NORMAL",
        name: "USB Dongle",
      },
    ]);

    await client.post(`/orders/${orderId}/processOrder`).expect(200);

    expect(notificationServiceMock.sendDelayNotification).toHaveBeenCalledWith(
      10,
      "USB Dongle",
    );
  });

  it("returns 200 and decrements stock for EXPIRABLE product in date with stock", async () => {
    const client = supertest(fastify.server);
    const orderId = createOrderWithProducts([
      {
        leadTime: 0,
        available: 5,
        type: "EXPIRABLE",
        name: "Butter",
        expiryDate: new Date(Date.now() + 30 * DAY_MS),
      },
    ]);

    await client.post(`/orders/${orderId}/processOrder`).expect(200);

    const [product] = await database.query.products.findMany({
      where: eq(products.name, "Butter"),
    });
    expect(product?.available).toBe(4);
    expect(
      notificationServiceMock.sendExpirationNotification,
    ).not.toHaveBeenCalled();
  });

  it("returns 200 and sends expiration notification for EXPIRABLE product expired", async () => {
    const client = supertest(fastify.server);
    const expiryDate = new Date(Date.now() - 2 * DAY_MS);
    const orderId = createOrderWithProducts([
      {
        leadTime: 0,
        available: 3,
        type: "EXPIRABLE",
        name: "Milk",
        expiryDate,
      },
    ]);

    await client.post(`/orders/${orderId}/processOrder`).expect(200);

    expect(
      notificationServiceMock.sendExpirationNotification,
    ).toHaveBeenCalledWith("Milk", expiryDate);
    const [product] = await database.query.products.findMany({
      where: eq(products.name, "Milk"),
    });
    expect(product?.available).toBe(0);
  });

  it("returns 200 and decrements stock for SEASONAL product in season with stock", async () => {
    const client = supertest(fastify.server);
    const orderId = createOrderWithProducts([
      {
        leadTime: 7,
        available: 20,
        type: "SEASONAL",
        name: "Watermelon",
        seasonStartDate: new Date(Date.now() - 2 * DAY_MS),
        seasonEndDate: new Date(Date.now() + 58 * DAY_MS),
      },
    ]);

    await client.post(`/orders/${orderId}/processOrder`).expect(200);

    const [product] = await database.query.products.findMany({
      where: eq(products.name, "Watermelon"),
    });
    expect(product?.available).toBe(19);
  });

  it("returns 200 and sends out of stock or delay for SEASONAL product out of season", async () => {
    const client = supertest(fastify.server);
    const orderId = createOrderWithProducts([
      {
        leadTime: 15,
        available: 5,
        type: "SEASONAL",
        name: "Grapes",
        seasonStartDate: new Date(Date.now() + 180 * DAY_MS),
        seasonEndDate: new Date(Date.now() + 240 * DAY_MS),
      },
    ]);

    await client.post(`/orders/${orderId}/processOrder`).expect(200);

    const outOfStockCalls =
      notificationServiceMock.sendOutOfStockNotification.mock.calls;
    const delayCalls = notificationServiceMock.sendDelayNotification.mock.calls;
    expect(
      outOfStockCalls.some((c) => c[0] === "Grapes") ||
        delayCalls.some((c) => c[1] === "Grapes"),
    ).toBe(true);
  });

  it("returns 200 and processes mixed product types correctly", async () => {
    const client = supertest(fastify.server);
    const orderId = createOrderWithProducts([
      {
        leadTime: 15,
        available: 30,
        type: "NORMAL",
        name: "USB Cable",
      },
      {
        leadTime: 10,
        available: 0,
        type: "NORMAL",
        name: "USB Dongle",
      },
      {
        leadTime: 15,
        available: 30,
        type: "EXPIRABLE",
        name: "Butter",
        expiryDate: new Date(Date.now() + 26 * DAY_MS),
      },
      {
        leadTime: 90,
        available: 6,
        type: "EXPIRABLE",
        name: "Milk",
        expiryDate: new Date(Date.now() - 2 * DAY_MS),
      },
      {
        leadTime: 15,
        available: 30,
        type: "SEASONAL",
        name: "Watermelon",
        seasonStartDate: new Date(Date.now() - 2 * DAY_MS),
        seasonEndDate: new Date(Date.now() + 58 * DAY_MS),
      },
      {
        leadTime: 15,
        available: 30,
        type: "SEASONAL",
        name: "Grapes",
        seasonStartDate: new Date(Date.now() + 180 * DAY_MS),
        seasonEndDate: new Date(Date.now() + 240 * DAY_MS),
      },
    ]);

    const response = await client
      .post(`/orders/${orderId}/processOrder`)
      .expect(200)
      .expect("Content-Type", /application\/json/);

    expect(response.body).toEqual({ orderId });

    const resultOrder = await database.query.orders.findFirst({
      where: eq(orders.id, orderId),
    });
    expect(resultOrder?.id).toBe(orderId);

    const usbCable = (
      await database.query.products.findMany({
        where: eq(products.name, "USB Cable"),
      })
    )[0];
    expect(usbCable?.available).toBe(29);

    expect(notificationServiceMock.sendDelayNotification).toHaveBeenCalledWith(
      10,
      "USB Dongle",
    );
    expect(
      notificationServiceMock.sendExpirationNotification,
    ).toHaveBeenCalledWith("Milk", expect.any(Date));
  });
});
