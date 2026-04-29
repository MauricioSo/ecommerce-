import { type Notification } from "../domain/notifications.ts";

export interface NotificationSender {
  send(notification: Notification): Promise<boolean>;
}

export class MockNotificationSender implements NotificationSender {
  async send(notification: Notification): Promise<boolean> {
    console.log(JSON.stringify({
      level: "info",
      timestamp: new Date().toISOString(),
      message: `[NOTIFICATION] type=${notification.type} to=${notification.recipient} subject=${notification.subject}`,
    }));
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
