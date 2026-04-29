export type Customer = {
  readonly id: string;
  readonly email: string;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly passwordHash: string | null;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type Address = {
  readonly id: string;
  readonly customerId: string;
  readonly label: string | null;
  readonly line1: string;
  readonly line2: string | null;
  readonly city: string;
  readonly state: string;
  readonly postalCode: string;
  readonly country: string;
  readonly isDefault: boolean;
  readonly createdAt: Date;
};

export function createCustomer(input: {
  email: string;
  firstName?: string;
  lastName?: string;
  passwordHash?: string;
}): Customer {
  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error("Customer email is required");
  if (!email.includes("@")) throw new Error("Invalid email format");
  return Object.freeze({
    id: crypto.randomUUID(),
    email,
    firstName: input.firstName?.trim() ?? null,
    lastName: input.lastName?.trim() ?? null,
    passwordHash: input.passwordHash ?? null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export function createAddress(input: {
  customerId: string;
  line1: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  label?: string;
  line2?: string;
  isDefault?: boolean;
}): Address {
  if (!input.customerId) throw new Error("Address requires a customer");
  if (!input.line1.trim()) throw new Error("Address line1 is required");
  if (!input.city.trim()) throw new Error("City is required");
  if (!input.state.trim()) throw new Error("State is required");
  if (!input.postalCode.trim()) throw new Error("Postal code is required");
  return Object.freeze({
    id: crypto.randomUUID(),
    customerId: input.customerId,
    label: input.label?.trim() ?? null,
    line1: input.line1.trim(),
    line2: input.line2?.trim() ?? null,
    city: input.city.trim(),
    state: input.state.trim(),
    postalCode: input.postalCode.trim(),
    country: input.country ?? "USA",
    isDefault: input.isDefault ?? false,
    createdAt: new Date(),
  });
}

export function getFullName(customer: Customer): string {
  return [customer.firstName, customer.lastName].filter(Boolean).join(" ") || customer.email;
}

export function isGuest(customer: Customer): boolean {
  return customer.passwordHash === null;
}
