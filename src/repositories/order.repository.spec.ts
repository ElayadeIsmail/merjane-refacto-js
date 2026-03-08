import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createDatabaseMock,
  cleanUp,
} from "../utils/test-utils/database-tools.js";
import { OrderRepository } from "./order.repository.js";
import {
  products,
  orders,
  ordersToProducts,
  type ProductInsert,
} from "@/db/schema.js";
import { type Database } from "@/db/type.js";

describe("OrderRepository", () => {
  let db: Database;
  let repository: OrderRepository;
  let databaseName: string;
  let closeDatabase: () => void;

  beforeEach(async () => {
    const ctx = await createDatabaseMock();
    db = ctx.databaseMock;
    databaseName = ctx.databaseName;
    closeDatabase = ctx.close;
    repository = new OrderRepository({ db });
  });

  afterEach(async () => {
    closeDatabase();
    await cleanUp(databaseName);
  });

  it("returns undefined when order does not exist", async () => {
    const result = await repository.findByIdWithProducts(999);

    expect(result).toBeUndefined();
  });

  it("returns order without products when order has no products", async () => {
    const [order] = await db.insert(orders).values({}).returning();

    const result = await repository.findByIdWithProducts(order!.id);

    expect(result?.id).toBe(order!.id);
    expect(result?.products).toEqual([]);
  });

  it("returns order with products when order has products", async () => {
    const [p1] = await db.insert(products).values(product(1)).returning();
    const [p2] = await db.insert(products).values(product(2)).returning();
    const [order] = await db.insert(orders).values({}).returning();
    await db.insert(ordersToProducts).values([
      { orderId: order!.id, productId: p1!.id },
      { orderId: order!.id, productId: p2!.id },
    ]);

    const result = await repository.findByIdWithProducts(order!.id);

    expect(result?.id).toBe(order!.id);
    expect(result?.products).toHaveLength(2);
    const productIds = result!.products!.map((r) => r.product.id).sort();
    expect(productIds).toEqual([p1!.id, p2!.id]);
  });
});

function product(id: number): ProductInsert {
  return {
    id,
    name: `Product ${id}`,
    type: "NORMAL",
    available: 1,
    leadTime: 0,
    expiryDate: null,
    seasonStartDate: null,
    seasonEndDate: null,
  };
}
