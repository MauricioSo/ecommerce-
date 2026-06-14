import type { InventoryItem, InventoryLedgerEntry, InventoryReservation } from "../../../domain/inventory/entities.ts";

export type InventoryReservationPort = {
  ensureInventoryItem(skuId: string, tx: unknown): Promise<InventoryItem>;
  saveInventoryItem(item: InventoryItem, tx: unknown): Promise<void>;
  saveLedgerEntry(entry: InventoryLedgerEntry, tx: unknown): Promise<void>;
  saveReservation(reservation: InventoryReservation, tx: unknown): Promise<void>;
};
