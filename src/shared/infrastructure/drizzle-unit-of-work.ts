import type { UnitOfWork } from "../application/ports/unit-of-work.ts";
import { getDb } from "./db/index.ts";

export class DrizzleUnitOfWork implements UnitOfWork {
  async runInTransaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
    const db = getDb();
    return db.transaction(async (tx: unknown) => {
      return fn(tx);
    });
  }
}
