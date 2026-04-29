import { seedTaxRules } from "../src/modules/pricing/application/tax-use-cases.ts";
import { seedShippingData } from "../src/modules/pricing/application/shipping-use-cases.ts";

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
