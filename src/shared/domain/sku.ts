export class SKU {
  private constructor(public readonly value: string) {
    if (!value || value.trim().length < 1) throw new Error("SKU cannot be empty");
    if (value.length > 64) throw new Error("SKU cannot exceed 64 characters");
  }

  static of(value: string): SKU {
    return new SKU(value.trim().toUpperCase());
  }

  equals(other: SKU): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
