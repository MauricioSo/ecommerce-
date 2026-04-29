const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class Email {
  private constructor(public readonly value: string) {}

  static of(value: string): Email {
    const normalized = value.trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalized)) {
      throw new Error(`Invalid email: ${value}`);
    }
    return new Email(normalized);
  }

  static isValid(value: string): boolean {
    return EMAIL_REGEX.test(value.trim().toLowerCase());
  }

  normalize(): string {
    return this.value;
  }

  domain(): string {
    return this.value.split("@")[1] ?? "";
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
