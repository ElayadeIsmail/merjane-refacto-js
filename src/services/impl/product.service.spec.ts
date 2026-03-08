import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import { type INotificationService } from "../notifications.port.js";
import {
  createDatabaseMock,
  cleanUp,
} from "../../utils/test-utils/database-tools.js";
import { ProductService } from "./product.service.js";
import { ProductRepository } from "@/repositories/product.repository.js";
import { products, type Product } from "@/db/schema.js";
import { type Database } from "@/db/type.js";

describe("ProductService Tests", () => {
  let notificationServiceMock: DeepMockProxy<INotificationService>;
  let productService: ProductService;
  let databaseMock: Database;
  let databaseName: string;
  let closeDatabase: () => void;

  beforeEach(async () => {
    ({
      databaseMock,
      databaseName,
      close: closeDatabase,
    } = await createDatabaseMock());
    notificationServiceMock = mockDeep<INotificationService>();
    const productRepository = new ProductRepository({ db: databaseMock });
    productService = new ProductService({
      notificationService: notificationServiceMock,
      productRepository,
    });
  });

  afterEach(async () => {
    closeDatabase();
    await cleanUp(databaseName);
  });

  it("should handle delay notification correctly", async () => {
    // GIVEN
    const product: Product = {
      id: 1,
      leadTime: 15,
      available: 0,
      type: "NORMAL",
      name: "RJ45 Cable",
      expiryDate: null,
      seasonStartDate: null,
      seasonEndDate: null,
    };
    await databaseMock.insert(products).values(product);

    // WHEN
    await productService.notifyDelay(product.leadTime, product);

    // THEN
    expect(product.available).toBe(0);
    expect(product.leadTime).toBe(15);
    expect(notificationServiceMock.sendDelayNotification).toHaveBeenCalledWith(
      product.leadTime,
      product.name,
    );
    const result = await databaseMock.query.products.findFirst({
      where: eq(products.id, product.id),
    });
    expect(result?.leadTime).toBe(15);
  });

  it("sends out of stock and sets available to 0 when seasonal and will arrive after season", async () => {
    const d = 24 * 60 * 60 * 1000;
    const product: Product = {
      id: 2,
      leadTime: 90,
      available: 0,
      type: "SEASONAL",
      name: "Grapes",
      expiryDate: null,
      seasonStartDate: new Date(Date.now() + 180 * d),
      seasonEndDate: new Date(Date.now() + 240 * d),
    };
    await databaseMock.insert(products).values(product);

    await productService.handleSeasonalProduct(product);

    expect(
      notificationServiceMock.sendOutOfStockNotification,
    ).toHaveBeenCalledWith(product.name);
    const row = await databaseMock.query.products.findFirst({
      where: eq(products.id, product.id),
    });
    expect(row?.available).toBe(0);
  });

  it("sends delay notification when seasonal and will arrive in time", async () => {
    const d = 24 * 60 * 60 * 1000;
    const product: Product = {
      id: 3,
      leadTime: 10,
      available: 0,
      type: "SEASONAL",
      name: "Watermelon",
      expiryDate: null,
      seasonStartDate: new Date(Date.now() - 2 * d),
      seasonEndDate: new Date(Date.now() + 60 * d),
    };
    await databaseMock.insert(products).values(product);

    await productService.handleSeasonalProduct(product);

    expect(notificationServiceMock.sendDelayNotification).toHaveBeenCalledWith(
      product.leadTime,
      product.name,
    );
  });

  it("sends expiration notification and sets available to 0 for expired product", async () => {
    const expiryDate = new Date(Date.now() - 1000);
    const product: Product = {
      id: 4,
      leadTime: 0,
      available: 5,
      type: "EXPIRABLE",
      name: "Milk",
      expiryDate,
      seasonStartDate: null,
      seasonEndDate: null,
    };
    await databaseMock.insert(products).values(product);

    await productService.handleExpiredProduct(product);

    expect(
      notificationServiceMock.sendExpirationNotification,
    ).toHaveBeenCalledWith(product.name, expiryDate);
    const row = await databaseMock.query.products.findFirst({
      where: eq(products.id, product.id),
    });
    expect(row?.available).toBe(0);
  });
});
