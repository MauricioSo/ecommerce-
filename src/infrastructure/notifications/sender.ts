import type { Notification } from "../../domain/notifications/entities.ts";
import type { NotificationSender } from "../../application/notifications/ports/notification-sender.ts";
import { createLogger } from "../../shared/infrastructure/logger/index.ts";

const notifLogger = createLogger();

export class MockNotificationSender implements NotificationSender {
  async send(notification: Notification): Promise<boolean> {
    notifLogger.info(`[NOTIFICATION] type=${notification.type} to=${notification.recipient} subject=${notification.subject}`, {
      notificationType: notification.type,
      recipient: notification.recipient,
    });
    return true;
  }
}

let sender: NotificationSender | null = null;

export function getNotificationSender(): NotificationSender {
  if (!sender) {
    sender = new MockNotificationSender();
  }
  return sender;
}

export function setNotificationSender(s: NotificationSender): void {
  sender = s;
}
