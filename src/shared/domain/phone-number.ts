const E164_REGEX = /^\+[1-9]\d{6,14}$/;

export class PhoneNumber {
  private constructor(public readonly value: string) {}

  static of(value: string): PhoneNumber {
    const cleaned = value.replace(/[\s\-()]/g, "");
    if (!E164_REGEX.test(cleaned)) {
      throw new Error(`Invalid phone number format (E.164 expected): ${value}`);
    }
    return new PhoneNumber(cleaned);
  }

  static isValid(value: string): boolean {
    const cleaned = value.replace(/[\s\-()]/g, "");
    return E164_REGEX.test(cleaned);
  }

  equals(other: PhoneNumber): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
