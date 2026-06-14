export type CrmCustomerStatus = "new" | "active" | "vip" | "at_risk" | "blocked";
export type CrmTaskStatus = "open" | "in_progress" | "done" | "cancelled";
export type CrmTaskPriority = "low" | "normal" | "high" | "urgent";
export type CrmTaskType = "follow_up" | "payment_issue" | "shipping_issue" | "return_issue" | "custom";
export type CrmInteractionChannel = "phone" | "email" | "whatsapp" | "internal" | "other";
export type CrmInteractionDirection = "inbound" | "outbound" | "internal";
export type CrmNoteVisibility = "internal" | "public";

export const VALID_CUSTOMER_STATUSES: CrmCustomerStatus[] = ["new", "active", "vip", "at_risk", "blocked"];
export const VALID_TASK_STATUSES: CrmTaskStatus[] = ["open", "in_progress", "done", "cancelled"];
export const VALID_TASK_PRIORITIES: CrmTaskPriority[] = ["low", "normal", "high", "urgent"];
export const VALID_TASK_TYPES: CrmTaskType[] = ["follow_up", "payment_issue", "shipping_issue", "return_issue", "custom"];
export const VALID_INTERACTION_CHANNELS: CrmInteractionChannel[] = ["phone", "email", "whatsapp", "internal", "other"];
export const VALID_INTERACTION_DIRECTIONS: CrmInteractionDirection[] = ["inbound", "outbound", "internal"];

export function isValidTaskStatus(status: string): status is CrmTaskStatus {
  return VALID_TASK_STATUSES.includes(status as CrmTaskStatus);
}

export function isValidTaskPriority(priority: string): priority is CrmTaskPriority {
  return VALID_TASK_PRIORITIES.includes(priority as CrmTaskPriority);
}

export function isValidTaskType(type: string): type is CrmTaskType {
  return VALID_TASK_TYPES.includes(type as CrmTaskType);
}

export function isValidInteractionChannel(channel: string): channel is CrmInteractionChannel {
  return VALID_INTERACTION_CHANNELS.includes(channel as CrmInteractionChannel);
}

export function isValidInteractionDirection(direction: string): direction is CrmInteractionDirection {
  return VALID_INTERACTION_DIRECTIONS.includes(direction as CrmInteractionDirection);
}
