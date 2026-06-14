import * as inventoryRepo from "../inventory/repository.ts";
import type { InventoryReservationPort } from "../../application/checkout/ports/inventory-reservation-port.ts";

export class InventoryReservationAdapter implements InventoryReservationPort {
  async ensureInventoryItem(skuId: string, tx: unknown) {
    return inventoryRepo.ensureInventoryItem(skuId, inventoryRepo.asDb(tx));
  }

  async saveInventoryItem(item: Parameters<InventoryReservationPort["saveInventoryItem"]>[0], tx: unknown) {
    return inventoryRepo.saveInventoryItem(item, inventoryRepo.asDb(tx));
  }

  async saveLedgerEntry(entry: Parameters<InventoryReservationPort["saveLedgerEntry"]>[0], tx: unknown) {
    return inventoryRepo.saveLedgerEntry(entry, inventoryRepo.asDb(tx));
  }

  async saveReservation(reservation: Parameters<InventoryReservationPort["saveReservation"]>[0], tx: unknown) {
    return inventoryRepo.saveReservation(reservation, inventoryRepo.asDb(tx));
  }
}
