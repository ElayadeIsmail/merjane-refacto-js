import { describe, it, expect, beforeEach } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import { ProductOrderHandler } from "./product-order-handler.js";
import { type ProductRepository } from "@/repositories/product.repository.js";
import { type ProductService } from "./product.service.js";
import { type Product } from "@/db/schema.js";

function normalProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 1,
    name: "USB Cable",
    type: "NORMAL",
    available: 3,
    leadTime: 5,
    expiryDate: null,
    seasonStartDate: null,
    seasonEndDate: null,
    ...overrides,
  };
}

describe("ProductOrderHandler", () => {
  let productRepository: DeepMockProxy<ProductRepository>;
  let productService: DeepMockProxy<ProductService>;

  beforeEach(() => {
    productRepository = mockDeep<ProductRepository>();
    productService = mockDeep<ProductService>();
  });

  function createHandler() {
    return new ProductOrderHandler({
      productRepository,
      productService,
    });
  }

  it("decrements stock for NORMAL product when available", async () => {
    const product = normalProduct({ available: 2 });

    await createHandler().handleProduct(product);

    expect(productRepository.decrementStock).toHaveBeenCalledWith(1, 2);
    expect(productService.notifyDelay).not.toHaveBeenCalled();
  });

  it("notifies delay for NORMAL product when no stock and has lead time", async () => {
    const product = normalProduct({ available: 0, leadTime: 10 });

    await createHandler().handleProduct(product);

    expect(productService.notifyDelay).toHaveBeenCalledWith(10, product);
    expect(productRepository.decrementStock).not.toHaveBeenCalled();
  });

  it("does nothing for NORMAL product when no stock and no lead time", async () => {
    const product = normalProduct({ available: 0, leadTime: 0 });

    await createHandler().handleProduct(product);

    expect(productRepository.decrementStock).not.toHaveBeenCalled();
    expect(productService.notifyDelay).not.toHaveBeenCalled();
  });

  it("decrements stock for SEASONAL product when in season and available", async () => {
    const d = 24 * 60 * 60 * 1000;
    const product: Product = {
      id: 2,
      name: "Watermelon",
      type: "SEASONAL",
      available: 4,
      leadTime: 7,
      expiryDate: null,
      seasonStartDate: new Date(Date.now() - 2 * d),
      seasonEndDate: new Date(Date.now() + 30 * d),
    };

    await createHandler().handleProduct(product);

    expect(productRepository.decrementStock).toHaveBeenCalledWith(2, 4);
    expect(productService.handleSeasonalProduct).not.toHaveBeenCalled();
  });

  it("delegates to productService for SEASONAL product when not in season", async () => {
    const d = 24 * 60 * 60 * 1000;
    const product: Product = {
      id: 3,
      name: "Grapes",
      type: "SEASONAL",
      available: 1,
      leadTime: 5,
      expiryDate: null,
      seasonStartDate: new Date(Date.now() + 100 * d),
      seasonEndDate: new Date(Date.now() + 200 * d),
    };

    await createHandler().handleProduct(product);

    expect(productService.handleSeasonalProduct).toHaveBeenCalledWith(product);
    expect(productRepository.decrementStock).not.toHaveBeenCalled();
  });

  it("decrements stock for EXPIRABLE product when available and not expired", async () => {
    const product: Product = {
      id: 4,
      name: "Butter",
      type: "EXPIRABLE",
      available: 2,
      leadTime: 0,
      expiryDate: new Date(Date.now() + 10000),
      seasonStartDate: null,
      seasonEndDate: null,
    };

    await createHandler().handleProduct(product);

    expect(productRepository.decrementStock).toHaveBeenCalledWith(4, 2);
    expect(productService.handleExpiredProduct).not.toHaveBeenCalled();
  });

  it("delegates to productService for EXPIRABLE product when expired", async () => {
    const product: Product = {
      id: 5,
      name: "Milk",
      type: "EXPIRABLE",
      available: 1,
      leadTime: 0,
      expiryDate: new Date(Date.now() - 1000),
      seasonStartDate: null,
      seasonEndDate: null,
    };

    await createHandler().handleProduct(product);

    expect(productService.handleExpiredProduct).toHaveBeenCalledWith(product);
    expect(productRepository.decrementStock).not.toHaveBeenCalled();
  });

  it("delegates to productService for EXPIRABLE product when no stock", async () => {
    const product: Product = {
      id: 6,
      name: "Yogurt",
      type: "EXPIRABLE",
      available: 0,
      leadTime: 0,
      expiryDate: new Date(Date.now() + 10000),
      seasonStartDate: null,
      seasonEndDate: null,
    };

    await createHandler().handleProduct(product);

    expect(productService.handleExpiredProduct).toHaveBeenCalledWith(product);
    expect(productRepository.decrementStock).not.toHaveBeenCalled();
  });
});
