import { createStylistUseCases } from "../../application/stylist/use-cases.ts";
import { createStylistStorefrontRoutes } from "../../presentation/stylist/storefront-routes.ts";
import { ClaudeStylistAiGateway } from "../../infrastructure/stylist/claude-client.ts";
import { DeepSeekStylistAiGateway } from "../../infrastructure/stylist/deepseek-client.ts";
import { DrizzleStylistRepository } from "../../infrastructure/stylist/repository.ts";
import { getConfig } from "../../shared/infrastructure/config.ts";

const config = getConfig();
const aiGateway = config.STYLIST_AI_PROVIDER === "deepseek"
  ? new DeepSeekStylistAiGateway()
  : new ClaudeStylistAiGateway();

const stylistUseCases = createStylistUseCases({
  repository: new DrizzleStylistRepository(),
  aiGateway,
  aiEnabled: config.STYLIST_AI_ENABLED,
});

export const stylistStorefrontRoutes = createStylistStorefrontRoutes(stylistUseCases);
