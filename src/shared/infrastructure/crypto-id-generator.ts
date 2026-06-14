import type { IdGenerator } from "../application/ports/id-generator.ts";

export class CryptoIdGenerator implements IdGenerator {
  generate(): string {
    return crypto.randomUUID();
  }
}
