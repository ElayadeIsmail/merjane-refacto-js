import { eq } from "drizzle-orm";
import { orders } from "@/db/schema.js";
import { type Database } from "@/db/type.js";

export class OrderRepository {
  private readonly db: Database;

  public constructor({ db }: { db: Database }) {
    this.db = db;
  }

  public async findByIdWithProducts(orderId: number) {
    return this.db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: {
        products: {
          columns: {},
          with: {
            product: true,
          },
        },
      },
    });
  }
}
