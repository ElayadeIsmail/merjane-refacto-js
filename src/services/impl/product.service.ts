import { type Cradle } from "@fastify/awilix";
import { type INotificationService } from "../notifications.port.js";
import { type Product } from "@/db/schema.js";
import { type ProductRepository } from "@/repositories/product.repository.js";

export class ProductService {
  private readonly notificationService: INotificationService;
  private readonly productRepository: ProductRepository;
  private readonly MS_PER_DAY = 1000 * 60 * 60 * 24;

  public constructor({
    notificationService,
    productRepository,
  }: Pick<Cradle, "notificationService" | "productRepository">) {
    this.notificationService = notificationService;
    this.productRepository = productRepository;
  }

  public async notifyDelay(leadTime: number, product: Product): Promise<void> {
    await this.productRepository.update(product.id, { leadTime });
    this.notificationService.sendDelayNotification(leadTime, product.name);
  }

  public async handleSeasonalProduct(product: Product): Promise<void> {
    const now = new Date();
    const estimatedArrival = this.addDays(now, product.leadTime);
    const isBeforeSeason = product.seasonStartDate! > now;
    const willArriveAfterSeason = estimatedArrival > product.seasonEndDate!;

    if (willArriveAfterSeason || isBeforeSeason) {
      this.notificationService.sendOutOfStockNotification(product.name);
      await this.productRepository.update(product.id, { available: 0 });
    } else {
      await this.notifyDelay(product.leadTime, product);
    }
  }

  public async handleExpiredProduct(product: Product): Promise<void> {
    this.notificationService.sendExpirationNotification(
      product.name,
      product.expiryDate!,
    );
    await this.productRepository.update(product.id, { available: 0 });
  }

  private addDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * this.MS_PER_DAY);
  }
}
