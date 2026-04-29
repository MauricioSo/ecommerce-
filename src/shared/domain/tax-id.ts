export type DocumentType = "rut" | "dni" | "cedula" | "cpf" | "rfc" | "passport" | "cuit" | "nit";

export class TaxId {
  private constructor(
    public readonly type: DocumentType,
    public readonly value: string,
  ) {}

  static validate(type: DocumentType, value: string): boolean {
    const cleaned = value.replace(/[\.\-\s\/]/g, "");
    switch (type) {
      case "rut":
        return validateRUT(cleaned);
      case "cpf":
        return validateCPF(cleaned);
      case "cuit":
        return validateCUIT(cleaned);
      case "dni":
        return /^\d{8}$/.test(cleaned);
      case "cedula":
        return /^\d{6,12}$/.test(cleaned);
      case "nit":
        return validateNIT(cleaned);
      case "rfc":
        return /^([A-ZÑ&]{3,4})\d{6}[A-Z0-9]{3}$/.test(cleaned.toUpperCase());
      case "passport":
        return /^[A-Z0-9]{5,20}$/i.test(cleaned);
      default:
        return false;
    }
  }

  static of(type: DocumentType, value: string): TaxId {
    const cleaned = value.replace(/[\.\-\s\/]/g, "");
    if (!TaxId.validate(type, cleaned)) {
      throw new Error(`Invalid ${type}: ${value}`);
    }
    return new TaxId(type, cleaned.toUpperCase());
  }

  equals(other: TaxId): boolean {
    return this.type === other.type && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

function validateRUT(rut: string): boolean {
  if (!/^\d{7,8}[0-9K]$/i.test(rut)) return false;
  const body = rut.slice(0, -1);
  const dv = rut.slice(-1)!.toUpperCase();
  let sum = 0;
  let multiplier = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    const ch = body[i];
    if (!ch) continue;
    sum += parseInt(ch) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const expected = 11 - (sum % 11);
  const computedDv = expected === 11 ? "0" : expected === 10 ? "K" : expected.toString();
  return dv === computedDv;
}

function validateCPF(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf)) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    const ch = cpf[i];
    if (!ch) return false;
    sum += parseInt(ch) * (10 - i);
  }
  let rem = (sum * 10) % 11;
  if (rem === 10) rem = 0;
  const ch9 = cpf[9];
  if (!ch9 || rem !== parseInt(ch9)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) {
    const ch = cpf[i];
    if (!ch) return false;
    sum += parseInt(ch) * (11 - i);
  }
  rem = (sum * 10) % 11;
  if (rem === 10) rem = 0;
  const ch10 = cpf[10];
  return ch10 != null && rem === parseInt(ch10);
}

function validateCUIT(cuit: string): boolean {
  if (!/^\d{11}$/.test(cuit)) return false;
  const mults = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const ch = cuit[i];
    if (!ch) return false;
    sum += parseInt(ch) * mults[i]!;
  }
  const rem = sum % 11;
  const expected = rem === 0 ? 0 : rem === 1 ? 9 : 11 - rem;
  const last = cuit[10];
  return last != null && expected === parseInt(last);
}

function validateNIT(nit: string): boolean {
  if (!/^\d{8,15}$/.test(nit)) return false;
  const mults = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
  let sum = 0;
  const body = nit.slice(0, -1);
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (!ch) return false;
    sum += parseInt(ch) * mults[mults.length - body.length + i]!;
  }
  const rem = sum % 11;
  const last = nit[nit.length - 1];
  if (last == null) return false;
  if (rem < 2) return rem === parseInt(last);
  return 11 - rem === parseInt(last);
}
