import { seedTaxRules } from "../src/application/pricing/tax-use-cases.ts";
import { seedShippingData } from "../src/application/pricing/shipping-use-cases.ts";

async function main() {
  console.log("Seeding tax rules...");
  await seedTaxRules();
  console.log("Seeding shipping data...");
  await seedShippingData();
  console.log("Done.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
