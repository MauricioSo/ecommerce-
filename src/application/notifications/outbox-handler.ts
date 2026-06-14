import { type OutboxEvent } from "../../shared/infrastructure/outbox/domain.ts";
import { buildNotification } from "../../domain/notifications/entities.ts";
import { consumePendingToken } from "../../shared/infrastructure/pending-tokens.ts";
import type { NotificationSender } from "./ports/notification-sender.ts";

export function createOutboxEventHandler(sender: NotificationSender) {
  return async function handleOutboxEvent(event: OutboxEvent): Promise<void> {
    const notificationTypes: Record<string, string> = {
      order_created: "order_created",
      payment_approved: "payment_approved",
      payment_failed: "payment_failed",
      payment_rejected: "payment_failed",
      shipment_created: "shipment_created",
      shipment_tracking_added: "shipment_tracking_added",
      shipment_status_changed: "shipment_updated",
      return_requested: "return_requested",
    };

    if (event.eventType === "password_reset_requested") {
      const payload = event.payload ?? {};
      const email = payload.email as string;
      const tokenId = payload.resetTokenId as string;
      const rawToken = consumePendingToken(tokenId);
      if (email && rawToken) {
        await sender.send({
          id: crypto.randomUUID(),
          type: "order_created" as const,
          recipient: email,
          subject: "Recuperar contrasena",
          body: `Para restablecer tu contrasena, visita: /cuenta/reset/${rawToken}`,
          status: "pending",
          createdAt: new Date(),
        });
      }
      return;
    }

    if (event.eventType === "email_verification_requested") {
      const payload = event.payload ?? {};
      const email = payload.email as string;
      const tokenId = payload.verificationTokenId as string;
      const rawToken = consumePendingToken(tokenId);
      if (email && rawToken) {
        await sender.send({
          id: crypto.randomUUID(),
          type: "order_created" as const,
          recipient: email,
          subject: "Verifica tu email",
          body: `Para verificar tu email, visita: /cuenta/verificar?token=${rawToken}`,
          status: "pending",
          createdAt: new Date(),
        });
      }
      return;
    }

    const notificationType = notificationTypes[event.eventType];
    if (!notificationType) return;

    const data = { ...(event.payload ?? {}), aggregateId: event.aggregateId };
    const notification = buildNotification(notificationType as any, data);
    if (!notification) return;

    await sender.send(notification);
  };
}
