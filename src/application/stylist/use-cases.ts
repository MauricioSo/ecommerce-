import type { StylistAiGateway } from "./ports/stylist-ai-gateway.ts";
import type { StylistRepository, StylistIdentity } from "./ports/stylist-repository.ts";

export type SendStylistMessageInput = StylistIdentity & {
  message: string;
  imageBase64?: string;
  imageMediaType?: string;
  };

export type StylistUseCases = ReturnType<typeof createStylistUseCases>;

export function createStylistUseCases(deps: {
  repository: StylistRepository;
  aiGateway: StylistAiGateway;
  aiEnabled: boolean;
}) {
  const { repository, aiGateway, aiEnabled } = deps;

  return {
    async sendStylistMessage(opts: SendStylistMessageInput) {
      if (!aiEnabled) {
        throw new Error("Stylist AI is disabled");
      }

      const conversation = await repository.findOrCreateConversation({
        customerId: opts.customerId,
        sessionId: opts.sessionId,
      });

      const history = await repository.getConversationMessages(conversation.id);
      const historyForAI = history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

      await repository.insertMessage({
        conversationId: conversation.id,
        role: "user",
        content: opts.message,
        imageBase64: opts.imageBase64 ?? null,
      });

      const catalog = await repository.getPublishedProductsForStylist();

      const recommendation = await aiGateway.recommend({
        userMessage: opts.message,
        imageBase64: opts.imageBase64,
        imageMediaType: opts.imageMediaType,
        history: historyForAI,
        catalog,
      });

      const assistantContent = recommendation.generalAdvice || "Aquí tienes mis recomendaciones:";

      await repository.insertMessage({
        conversationId: conversation.id,
        role: "assistant",
        content: assistantContent,
        imageBase64: null,
        recommendations: recommendation,
      });

      return {
        conversationId: conversation.id,
        recommendation,
        provider: aiGateway.providerName,
      };
    },

    async getConversationHistory(opts: StylistIdentity) {
      const conversation = await repository.findOrCreateConversation(opts);
      const messages = await repository.getConversationMessages(conversation.id);
      return { conversationId: conversation.id, messages };
    },

    async resetStylistConversation(opts: StylistIdentity) {
      await repository.resetConversation(opts);
    },
  };
}
