import Elysia from "elysia";
import { customerSessionPlugin } from "./customer-session.ts";

export const countryDetectPlugin = new Elysia({ name: "country-detect" })
  .use(customerSessionPlugin)
  .decorate("countryCode", "CHL")
  .resolve(async ({ request, cookie }) => {
    const headerCountry = request.headers.get("cf-ipcountry") ?? request.headers.get("x-country-code");
    if (headerCountry && headerCountry.length === 3) {
      return { countryCode: headerCountry.toUpperCase() };
    }
    const cookieCountry = cookie._country?.value;
    if (cookieCountry && typeof cookieCountry === "string" && cookieCountry.length === 3) {
      return { countryCode: cookieCountry.toUpperCase() };
    }
    return { countryCode: "CHL" as const };
  });
