import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import {
  createDatabaseMock,
  cleanUp,
} from "../utils/test-utils/database-tools.js";
import { ProductRepository } from "./product.repository.js";
import { products, type Product } from "@/db/schema.js";
import { type Database } from "@/db/type.js";

describe("ProductRepository", () => {
  let db: Database;
  let repository: ProductRepository;
  let databaseName: string;
  let closeDatabase: () => void;

  beforeEach(async () => {
    const ctx = await createDatabaseMock();
    db = ctx.databaseMock;
    databaseName = ctx.databaseName;
    closeDatabase = ctx.close;
    repository = new ProductRepository({ db });
  });

  afterEach(async () => {
    closeDatabase();
    await cleanUp(databaseName);
  });

  it("update changes product fields", async () => {
    const product: Product = {
      id: 1,
      name: "USB Cable",
      type: "NORMAL",
      available: 10,
      leadTime: 5,
      expiryDate: null,
      seasonStartDate: null,
      seasonEndDate: null,
    };
    await db.insert(products).values(product);

    await repository.update(1, { leadTime: 20, available: 0 });

    const row = await db.query.products.findFirst({
      where: eq(products.id, 1),
    });
    expect(row?.leadTime).toBe(20);
    expect(row?.available).toBe(0);
    expect(row?.name).toBe("USB Cable");
  });

  it("decrementStock reduces available by one", async () => {
    const product: Product = {
      id: 2,
      name: "Dongle",
      type: "NORMAL",
      available: 3,
      leadTime: 0,
      expiryDate: null,
      seasonStartDate: null,
      seasonEndDate: null,
    };
    await db.insert(products).values(product);

    await repository.decrementStock(2, 3);

    const row = await db.query.products.findFirst({
      where: eq(products.id, 2),
    });
    expect(row?.available).toBe(2);
  });

  it("decrementStock can go to zero", async () => {
    const product: Product = {
      id: 3,
      name: "Last One",
      type: "NORMAL",
      available: 1,
      leadTime: 0,
      expiryDate: null,
      seasonStartDate: null,
      seasonEndDate: null,
    };
    await db.insert(products).values(product);

    await repository.decrementStock(3, 1);

    const row = await db.query.products.findFirst({
      where: eq(products.id, 3),
    });
    expect(row?.available).toBe(0);
  });
});
