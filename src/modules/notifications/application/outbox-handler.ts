import { type OutboxEvent } from "../../../shared/infrastructure/outbox/domain.ts";
import { buildNotification } from "../domain/notifications.ts";
import { getNotificationSender } from "../infrastructure/sender.ts";

export async function handleOutboxEvent(event: OutboxEvent): Promise<void> {
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

  const notificationType = notificationTypes[event.eventType];
  if (!notificationType) return;

  const data = { ...(event.payload ?? {}), aggregateId: event.aggregateId };
  const notification = buildNotification(notificationType as any, data);
  if (!notification) return;

  const sender = getNotificationSender();
  await sender.send(notification);
}
