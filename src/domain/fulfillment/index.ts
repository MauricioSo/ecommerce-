export {
  type ShipmentStatus,
  type ReturnStatus,
  ShipmentStatus as ShipmentStatusEnum,
  ReturnStatus as ReturnStatusEnum,
  SHIPMENT_TRANSITIONS,
  RETURN_TRANSITIONS,
  canTransitionTo,
  assertTransition,
} from "./types.ts";

export {
  type Shipment,
  type ReturnRequest,
  createShipment,
  pickupShipment,
  markInTransit,
  markOutForDelivery,
  deliverShipment,
  cancelShipment,
  setTrackingCode,
  createReturnRequest,
  approveReturn,
  rejectReturn,
  startReturnProcessing,
  completeReturn,
  failReturn,
} from "./entities.ts";
