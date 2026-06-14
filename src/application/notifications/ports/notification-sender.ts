import type { Notification } from "../../../domain/notifications/entities.ts";

export interface NotificationSender {
  send(notification: Notification): Promise<boolean>;
}
