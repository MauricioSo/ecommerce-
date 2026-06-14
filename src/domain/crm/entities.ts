import type {
  CrmCustomerStatus,
  CrmTaskStatus,
  CrmTaskPriority,
  CrmTaskType,
  CrmInteractionChannel,
  CrmNoteVisibility,
} from "./types.ts";

export type CustomerNote = {
  readonly id: string;
  readonly customerId: string;
  readonly authorAdminId: string | null;
  readonly body: string;
  readonly visibility: CrmNoteVisibility;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type CrmTag = {
  readonly id: string;
  readonly name: string;
  readonly color: string | null;
  readonly description: string | null;
  readonly createdAt: Date;
};

export type CustomerTag = {
  readonly customerId: string;
  readonly tagId: string;
  readonly tag: CrmTag;
  readonly assignedBy: string | null;
  readonly assignedAt: Date;
};

export type CrmTask = {
  readonly id: string;
  readonly customerId: string | null;
  readonly orderId: string | null;
  readonly assignedTo: string | null;
  readonly createdBy: string | null;
  readonly type: CrmTaskType;
  readonly status: CrmTaskStatus;
  readonly priority: CrmTaskPriority;
  readonly title: string;
  readonly description: string | null;
  readonly dueAt: Date | null;
  readonly completedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type CrmInteraction = {
  readonly id: string;
  readonly customerId: string;
  readonly orderId: string | null;
  readonly adminId: string | null;
  readonly channel: CrmInteractionChannel;
  readonly direction: "inbound" | "outbound" | "internal";
  readonly summary: string;
  readonly createdAt: Date;
};

export type CrmCustomerProfile = {
  readonly id: string;
  readonly customerId: string;
  readonly status: CrmCustomerStatus;
  readonly lastContactedAt: Date | null;
  readonly nextFollowUpAt: Date | null;
  readonly internalSummary: string | null;
  readonly updatedAt: Date;
  readonly createdAt: Date;
};

export type CustomerCockpit = {
  readonly profile: CrmCustomerProfile | null;
  readonly customer: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    countryCode: string | null;
    createdAt: Date;
  };
  readonly addresses: Array<{
    id: string;
    label: string | null;
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone: string | null;
    isDefault: boolean;
  }>;
  readonly summary: {
    totalOrders: number;
    totalSpentCents: number;
    averageOrderValueCents: number;
    lastOrderDate: Date | null;
  };
  readonly recentOrders: Array<{
    id: string;
    status: string;
    totalCents: number;
    createdAt: Date;
  }>;
  readonly recentPayments: Array<{
    id: string;
    status: string;
    amountCents: number;
    createdAt: Date;
  }>;
  readonly activeShipments: Array<{
    id: string;
    status: string;
    carrier: string | null;
    trackingCode: string | null;
  }>;
  readonly activeReturns: Array<{
    id: string;
    status: string;
    reason: string | null;
    createdAt: Date;
  }>;
  readonly notes: CustomerNote[];
  readonly tags: CustomerTag[];
  readonly openTasks: CrmTask[];
  readonly interactions: CrmInteraction[];
  readonly timeline: Array<{
    type: string;
    date: Date;
    data: Record<string, unknown>;
  }>;
};

export type CrmCustomerListItem = {
  readonly id: string;
  readonly email: string;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly phone: string | null;
  readonly countryCode: string | null;
  readonly crmStatus: CrmCustomerStatus;
  readonly totalOrders: number;
  readonly totalSpentCents: number;
  readonly lastOrderDate: Date | null;
  readonly tags: Array<{ id: string; name: string; color: string | null }>;
  readonly openTasksCount: number;
};
