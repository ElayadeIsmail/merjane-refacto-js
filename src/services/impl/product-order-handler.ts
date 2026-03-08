import { type Cradle } from "@fastify/awilix";
import { type Product } from "@/db/schema.js";
import { type ProductRepository } from "@/repositories/product.repository.js";
import { type ProductService } from "./product.service.js";

export class ProductOrderHandler {
  private readonly productRepository: ProductRepository;
  private readonly productService: ProductService;

  public constructor({
    productRepository,
    productService,
  }: Pick<Cradle, "productRepository" | "productService">) {
    this.productRepository = productRepository;
    this.productService = productService;
  }

  public async handleProduct(product: Product): Promise<void> {
    const now = new Date();
    switch (product.type) {
      case "NORMAL": {
        await this.handleNormalProduct(product);
        break;
      }
      case "SEASONAL": {
        await this.handleSeasonalProduct(product, now);
        break;
      }
      case "EXPIRABLE": {
        await this.handleExpirableProduct(product, now);
        break;
      }
    }
  }

  private async decrementStockWhenAvailable(product: Product): Promise<void> {
    if (product.available > 0) {
      await this.productRepository.decrementStock(
        product.id,
        product.available,
      );
    }
  }

  private async handleNormalProduct(product: Product): Promise<void> {
    await this.decrementStockWhenAvailable(product);
    if (product.available === 0 && product.leadTime > 0) {
      await this.productService.notifyDelay(product.leadTime, product);
    }
  }

  private async handleSeasonalProduct(
    product: Product,
    now: Date,
  ): Promise<void> {
    const isInSeason =
      now > product.seasonStartDate! && now < product.seasonEndDate!;

    if (isInSeason) {
      await this.decrementStockWhenAvailable(product);
    } else {
      await this.productService.handleSeasonalProduct(product);
    }
  }

  private async handleExpirableProduct(
    product: Product,
    now: Date,
  ): Promise<void> {
    const isExpired = product.expiryDate! <= now;

    if (!isExpired) {
      await this.decrementStockWhenAvailable(product);
    }
    if (product.available === 0 || isExpired) {
      await this.productService.handleExpiredProduct(product);
    }
  }
}
