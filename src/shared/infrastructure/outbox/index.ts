export {
  type OutboxEvent,
  type OutboxEventStatus,
  OutboxEventStatus as OutboxEventStatusEnum,
  createOutboxEvent,
  markProcessing,
  markCompleted,
  markFailed,
  isRetryable,
} from "./domain.ts";
