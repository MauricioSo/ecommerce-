const LATAM_COUNTRIES: Record<string, { name: string; alpha2: string; currency: string }> = {
  CHL: { name: "Chile", alpha2: "CL", currency: "CLP" },
  ARG: { name: "Argentina", alpha2: "AR", currency: "ARS" },
  PER: { name: "Perú", alpha2: "PE", currency: "PEN" },
  COL: { name: "Colombia", alpha2: "CO", currency: "COP" },
  MEX: { name: "México", alpha2: "MX", currency: "MXN" },
  BRA: { name: "Brasil", alpha2: "BR", currency: "BRL" },
  URY: { name: "Uruguay", alpha2: "UY", currency: "UYU" },
  ECU: { name: "Ecuador", alpha2: "EC", currency: "USD" },
  BOL: { name: "Bolivia", alpha2: "BO", currency: "BOB" },
  PRY: { name: "Paraguay", alpha2: "PY", currency: "PYG" },
  VEN: { name: "Venezuela", alpha2: "VE", currency: "VES" },
  CRI: { name: "Costa Rica", alpha2: "CR", currency: "CRC" },
  GTM: { name: "Guatemala", alpha2: "GT", currency: "GTQ" },
  HND: { name: "Honduras", alpha2: "HN", currency: "HNL" },
  SLV: { name: "El Salvador", alpha2: "SV", currency: "USD" },
  NIC: { name: "Nicaragua", alpha2: "NI", currency: "NIO" },
  PAN: { name: "Panamá", alpha2: "PA", currency: "USD" },
  DOM: { name: "República Dominicana", alpha2: "DO", currency: "DOP" },
  CUB: { name: "Cuba", alpha2: "CU", currency: "CUP" },
};

export type CountryCodeType = keyof typeof LATAM_COUNTRIES;

export class CountryCode {
  private constructor(public readonly value: CountryCodeType) {}

  static of(value: string): CountryCode {
    const upper = value.toUpperCase();
    if (!LATAM_COUNTRIES[upper as CountryCodeType]) {
      throw new Error(`Invalid country code: ${value}`);
    }
    return new CountryCode(upper as CountryCodeType);
  }

  static default(): CountryCode {
    return new CountryCode("CHL");
  }

  static isValid(value: string): boolean {
    return value.toUpperCase() in LATAM_COUNTRIES;
  }

  static all(): CountryCode[] {
    return Object.keys(LATAM_COUNTRIES).map((c) => new CountryCode(c as CountryCodeType));
  }

  isoAlpha2(): string {
    return LATAM_COUNTRIES[this.value]!.alpha2;
  }

  currencyDefault(): string {
    return LATAM_COUNTRIES[this.value]!.currency;
  }

  name(): string {
    return LATAM_COUNTRIES[this.value]!.name;
  }

  equals(other: CountryCode): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
