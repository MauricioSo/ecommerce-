import type { CatalogProductForStylist, StylistConversation, StylistMessage, StylistRecommendation } from "../../../domain/stylist/types.ts";

export type StylistIdentity = {
  customerId?: string;
  sessionId?: string;
};

export interface StylistRepository {
  findOrCreateConversation(identity: StylistIdentity): Promise<StylistConversation>;
  getConversationMessages(conversationId: string): Promise<StylistMessage[]>;
  insertMessage(input: {
    conversationId: string;
    role: "user" | "assistant";
    content: string;
    imageBase64?: string | null;
    recommendations?: StylistRecommendation | null;
  }): Promise<string>;
  resetConversation(identity: StylistIdentity): Promise<void>;
  getPublishedProductsForStylist(): Promise<CatalogProductForStylist[]>;
}
