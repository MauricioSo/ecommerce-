import { DrizzleCatalogSearchReadModel } from "../../infrastructure/catalog/drizzle-search-read-model.ts";
import { setCatalogRepository } from "../../application/catalog/use-cases.ts";
import { DrizzleCatalogRepository } from "../../infrastructure/catalog/repository.ts";

export const catalogSearchReadModel = new DrizzleCatalogSearchReadModel();

setCatalogRepository(new DrizzleCatalogRepository());
