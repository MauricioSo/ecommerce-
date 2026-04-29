import { describe, test, expect } from "bun:test";
import { CountryCode } from "../src/shared/domain/country-code.ts";
import { PhoneNumber } from "../src/shared/domain/phone-number.ts";
import { TaxId } from "../src/shared/domain/tax-id.ts";
import { Email } from "../src/shared/domain/email.ts";
import { generateSlug } from "../src/shared/domain/slug.ts";

describe("CountryCode", () => {
  test("acepta codigo valido de 3 letras", () => {
    const cc = CountryCode.of("CHL");
    expect(cc.value).toBe("CHL");
  });

  test("normaliza a mayusculas", () => {
    const cc = CountryCode.of("chl");
    expect(cc.value).toBe("CHL");
  });

  test("rechaza codigo invalido", () => {
    expect(() => CountryCode.of("XX")).toThrow("Invalid country code");
    expect(() => CountryCode.of("")).toThrow("Invalid country code");
  });

  test("default es CHL", () => {
    expect(CountryCode.default().value).toBe("CHL");
  });

  test("equals funciona correctamente", () => {
    const a = CountryCode.of("CHL");
    const b = CountryCode.of("CHL");
    const c = CountryCode.of("ARG");
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });

  test("isoAlpha2 retorna codigo correcto", () => {
    expect(CountryCode.of("CHL").isoAlpha2()).toBe("CL");
    expect(CountryCode.of("ARG").isoAlpha2()).toBe("AR");
  });

  test("currencyDefault retorna moneda correcta", () => {
    expect(CountryCode.of("CHL").currencyDefault()).toBe("CLP");
    expect(CountryCode.of("MEX").currencyDefault()).toBe("MXN");
  });

  test("all retorna 19 paises", () => {
    expect(CountryCode.all().length).toBe(19);
  });

  test("isValid funciona", () => {
    expect(CountryCode.isValid("CHL")).toBe(true);
    expect(CountryCode.isValid("XX")).toBe(false);
  });
});

describe("PhoneNumber", () => {
  test("acepta numero chileno valido", () => {
    const phone = PhoneNumber.of("+56912345678");
    expect(phone.value).toBe("+56912345678");
  });

  test("acepta numero argentino", () => {
    const phone = PhoneNumber.of("+5491112345678");
    expect(phone.value).toBe("+5491112345678");
  });

  test("rechaza string vacio", () => {
    expect(() => PhoneNumber.of("")).toThrow("Invalid phone number");
  });

  test("rechaza numero sin codigo de pais", () => {
    expect(() => PhoneNumber.of("912345678")).toThrow("Invalid phone number");
  });

  test("isValid funciona", () => {
    expect(PhoneNumber.isValid("+56912345678")).toBe(true);
    expect(PhoneNumber.isValid("123")).toBe(false);
  });
});

describe("TaxId", () => {
  test("acepta RUT chileno valido", () => {
    const taxId = TaxId.of("rut", "12345678-5");
    expect(taxId.value).toContain("12345678");
  });

  test("rechaza RUT invalido", () => {
    expect(() => TaxId.of("rut", "12345678-0")).toThrow("Invalid rut");
  });

  test("acepta DNI valido", () => {
    const taxId = TaxId.of("dni", "12345678");
    expect(taxId.value).toBe("12345678");
  });

  test("rechaza DNI invalido", () => {
    expect(() => TaxId.of("dni", "1234")).toThrow("Invalid dni");
  });

  test("validate retorna boolean", () => {
    expect(TaxId.validate("dni", "12345678")).toBe(true);
    expect(TaxId.validate("dni", "123")).toBe(false);
  });
});

describe("Email", () => {
  test("acepta email valido", () => {
    const email = Email.of("user@example.com");
    expect(email.value).toBe("user@example.com");
  });

  test("normaliza a lowercase", () => {
    const email = Email.of("User@Example.COM");
    expect(email.value).toBe("user@example.com");
  });

  test("rechaza email invalido", () => {
    expect(() => Email.of("notanemail")).toThrow("Invalid email");
    expect(() => Email.of("")).toThrow("Invalid email");
    expect(() => Email.of("@domain.com")).toThrow("Invalid email");
  });

  test("domain retorna el dominio", () => {
    expect(Email.of("user@example.com").domain()).toBe("example.com");
  });

  test("isValid funciona", () => {
    expect(Email.isValid("user@example.com")).toBe(true);
    expect(Email.isValid("bad")).toBe(false);
  });
});

describe("generateSlug", () => {
  test("genera slug desde texto", () => {
    expect(generateSlug("Camiseta de Algodon")).toBe("camiseta-de-algodon");
  });

  test("maneja acentos", () => {
    expect(generateSlug("Café Exprés")).toBe("cafe-expres");
  });

  test("maneja ñ", () => {
    expect(generateSlug("Año Nuevo")).toBe("ano-nuevo");
  });

  test("elimina caracteres especiales", () => {
    expect(generateSlug("Producto #1!")).toBe("producto-1");
  });

  test("texto vacio retorna vacio", () => {
    expect(generateSlug("")).toBe("");
  });

  test("limita a 200 caracteres", () => {
    const long = "a".repeat(300);
    expect(generateSlug(long).length).toBe(200);
  });
});
