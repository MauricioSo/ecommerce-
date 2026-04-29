export type NotificationType = "order_created" | "payment_approved" | "payment_failed" | "shipment_updated" | "return_requested";

export type Notification = {
  id: string;
  type: NotificationType;
  recipient: string;
  subject: string;
  body: string;
  status: "pending" | "sent" | "failed";
  createdAt: Date;
};

export function createNotification(input: {
  type: NotificationType;
  recipient: string;
  subject: string;
  body: string;
}): Notification {
  return {
    id: crypto.randomUUID(),
    type: input.type,
    recipient: input.recipient,
    subject: input.subject,
    body: input.body,
    status: "pending",
    createdAt: new Date(),
  };
}

export function buildNotification(type: NotificationType, data: Record<string, unknown>): Notification | null {
  const email = data.customerEmail as string;
  if (!email) return null;

  switch (type) {
    case "order_created":
      return createNotification({
        type,
        recipient: email,
        subject: `Order Confirmation - ${(data.orderId as string)?.substring(0, 8) ?? "N/A"}`,
        body: `Your order ${(data.orderId as string)?.substring(0, 8)} has been created. Total: $${(((data.totalCents as number) ?? 0) / 100).toFixed(2)}`,
      });
    case "payment_approved":
      return createNotification({
        type,
        recipient: email,
        subject: `Payment Approved - Order ${(data.orderId as string)?.substring(0, 8) ?? "N/A"}`,
        body: `Your payment for order ${(data.orderId as string)?.substring(0, 8)} has been approved.`,
      });
    case "payment_failed":
      return createNotification({
        type,
        recipient: email,
        subject: `Payment Failed - Order ${(data.orderId as string)?.substring(0, 8) ?? "N/A"}`,
        body: `Your payment for order ${(data.orderId as string)?.substring(0, 8)} could not be processed. Please try again.`,
      });
    case "shipment_updated":
      return createNotification({
        type,
        recipient: email,
        subject: `Shipment Update - Order ${(data.orderId as string)?.substring(0, 8) ?? "N/A"}`,
        body: `Your shipment for order ${(data.orderId as string)?.substring(0, 8)} has been updated to: ${(data.shipmentStatus as string) ?? "unknown"}.`,
      });
    case "return_requested":
      return createNotification({
        type,
        recipient: email,
        subject: `Return Request Received`,
        body: `Your return request for order ${(data.orderId as string)?.substring(0, 8)} has been received. We will review it shortly.`,
      });
    default:
      return null;
  }
}
