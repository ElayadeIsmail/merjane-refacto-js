import { eq } from "drizzle-orm";
import { products, type Product } from "@/db/schema.js";
import { type Database } from "@/db/type.js";

export class ProductRepository {
  private readonly db: Database;

  public constructor({ db }: { db: Database }) {
    this.db = db;
  }

  public async update(
    productId: Product["id"],
    updates: Partial<Product>,
  ): Promise<void> {
    await this.db
      .update(products)
      .set(updates)
      .where(eq(products.id, productId));
  }

  public async decrementStock(
    productId: Product["id"],
    currentAvailable: number,
  ): Promise<void> {
    await this.update(productId, { available: currentAvailable - 1 });
  }
}
