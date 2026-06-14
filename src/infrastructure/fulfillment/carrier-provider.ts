import type { ShipmentStatus } from "../../domain/fulfillment/types.ts";

export type CarrierTrackingEvent = {
  status: ShipmentStatus;
  title: string;
  description?: string;
  occurredAt: Date;
  rawPayload?: unknown;
};

export type CarrierTrackingResult = {
  status: ShipmentStatus;
  estimatedDeliveryDate?: Date;
  trackingUrl?: string;
  events: CarrierTrackingEvent[];
};

export interface CarrierProvider {
  getTracking(input: { trackingCode: string; carrier?: string }): Promise<CarrierTrackingResult | null>;
  validateWebhook?(input: { rawBody: string; headers: Headers }): Promise<boolean>;
  parseWebhook?(input: { rawBody: string; headers: Headers }): Promise<CarrierTrackingEvent[]>;
}

export class MockCarrierProvider implements CarrierProvider {
  async getTracking(_input: { trackingCode: string; carrier?: string }): Promise<CarrierTrackingResult | null> {
    return null;
  }
}

export class ManualCarrierProvider implements CarrierProvider {
  async getTracking(_input: { trackingCode: string; carrier?: string }): Promise<CarrierTrackingResult | null> {
    return null;
  }
}

let carrierProvider: CarrierProvider | null = null;

export function getCarrierProvider(): CarrierProvider {
  if (!carrierProvider) {
    carrierProvider = new ManualCarrierProvider();
  }
  return carrierProvider;
}

export function setCarrierProvider(provider: CarrierProvider): void {
  carrierProvider = provider;
}
