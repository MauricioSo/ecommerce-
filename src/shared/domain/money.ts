export class Money {
  private constructor(
    public readonly amount: number,
    public readonly currency: string,
  ) {
    if (!Number.isInteger(amount)) throw new Error("Money amount must be an integer (cents)");
    if (amount < 0) throw new Error("Money amount cannot be negative");
    if (!currency || currency.length !== 3) throw new Error("Currency must be a valid 3-letter code");
  }

  static fromCents(amount: number, currency: string = "USD"): Money {
    return new Money(amount, currency);
  }

  static fromDecimal(amount: number, currency: string = "USD"): Money {
    return new Money(Math.round(amount * 100), currency);
  }

  get decimal(): number {
    return this.amount / 100;
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount + other.amount, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount - other.amount, this.currency);
  }

  multiply(factor: number): Money {
    return new Money(Math.round(this.amount * factor), this.currency);
  }

  isZero(): boolean {
    return this.amount === 0;
  }

  isGreaterThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amount > other.amount;
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error(`Currency mismatch: ${this.currency} vs ${other.currency}`);
    }
  }

  toJSON(): { amount: number; currency: string } {
    return { amount: this.amount, currency: this.currency };
  }
}
