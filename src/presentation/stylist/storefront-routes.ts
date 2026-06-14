import { Elysia, t } from "elysia";
import type { StylistUseCases } from "../../application/stylist/use-cases.ts";
import { CustomerSession } from "../../web/middleware/customer-session.ts";
import { verifySignedCookieValue } from "../../web/helpers/signed-cookie.ts";

async function resolveIdentity(cookie: Record<string, { value: unknown }>) {
  const customer = await CustomerSession.resolve(cookie);
  const sessionId = verifySignedCookieValue(cookie.sessionId?.value) ??
    verifySignedCookieValue(cookie._cart?.value) ??
    (typeof cookie._stylist?.value === "string" ? cookie._stylist.value : undefined);
  return { customerId: customer?.customerId, sessionId };
}

export function createStylistStorefrontRoutes(useCases: StylistUseCases) {
  return new Elysia({ prefix: "/api/stylist" })
    .post(
      "/chat",
      async ({ body, cookie, set }) => {
      const { customerId, sessionId } = await resolveIdentity(cookie as Record<string, { value: unknown }>);

      if (!customerId && !sessionId) {
        set.status = 400;
        return { error: "No hay sesión activa" };
      }

      let imageBase64: string | undefined;
      let imageMediaType: string | undefined;

      if (body.image) {
        const match = body.image.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
        if (match) {
          imageMediaType = match[1];
          imageBase64 = match[2];
        }
      }

      try {
        const result = await useCases.sendStylistMessage({
          message: body.message,
          imageBase64,
          imageMediaType,
          customerId,
          sessionId,
        });
        return result;
      } catch {
        set.status = 500;
        return { error: "Error al procesar la solicitud del estilista" };
      }
    },
    {
      body: t.Object({
        message: t.String({ minLength: 1, maxLength: 1000 }),
        image: t.Optional(t.String()),
      }),
    }
  )
  .get("/history", async ({ cookie, set }) => {
    const { customerId, sessionId } = await resolveIdentity(cookie as Record<string, { value: unknown }>);
    if (!customerId && !sessionId) {
      set.status = 400;
      return { error: "No hay sesión activa" };
    }
    return useCases.getConversationHistory({ customerId, sessionId });
  })
  .delete("/reset", async ({ cookie, set }) => {
    const { customerId, sessionId } = await resolveIdentity(cookie as Record<string, { value: unknown }>);
    if (!customerId && !sessionId) {
      set.status = 400;
      return { error: "No hay sesión activa" };
    }
    await useCases.resetStylistConversation({ customerId, sessionId });
    return { ok: true };
  });
}
