export type OutboxPort = {
  emitEvent(tx: unknown, input: {
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    payload?: Record<string, unknown>;
  }): Promise<void>;
};
