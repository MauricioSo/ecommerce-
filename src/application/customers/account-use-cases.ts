import {
  findCustomerById,
  updateCustomer,
  findAddressesByCustomerId,
  findAddressById,
  insertAddress,
  updateAddress,
  deleteAddress,
  countAddressesByCustomerId,
  setDefaultAddress,
  findWishlistByCustomerId,
  deleteWishlistItem as repoDeleteWishlistItem,
} from "../../infrastructure/customers/repository.ts";
import { getDb } from "../../shared/infrastructure/db/index.ts";
import * as s from "../../shared/infrastructure/db/schema.ts";
import { eq, desc } from "drizzle-orm";
import { TaxId, type DocumentType } from "../../shared/domain/tax-id.ts";
import { PhoneNumber } from "../../shared/domain/phone-number.ts";

type Db = ReturnType<typeof getDb>;

export async function getCustomerProfile(customerId: string) {
  const customer = await findCustomerById(customerId);
  if (!customer) throw new Error("Cliente no encontrado");
  return customer;
}

export async function updateCustomerProfile(customerId: string, data: {
  firstName?: string;
  lastName?: string;
  phone?: string;
  documentType?: string;
  documentNumber?: string;
  locale?: string;
}) {
  if (data.documentType && data.documentNumber) {
    if (!TaxId.validate(data.documentType as DocumentType, data.documentNumber)) {
      throw new Error(`Documento ${data.documentType} inválido: ${data.documentNumber}`);
    }
  }
  if (data.phone) {
    if (!PhoneNumber.isValid(data.phone)) {
      throw new Error(`Teléfono inválido: ${data.phone}`);
    }
  }
  await updateCustomer(customerId, {
    firstName: data.firstName,
    lastName: data.lastName,
    phone: data.phone,
    documentType: data.documentType,
    documentNumber: data.documentNumber,
    locale: data.locale,
  });
}

export async function addAddress(customerId: string, address: {
  line1: string;
  line2?: string;
  neighborhood?: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  phone?: string;
  reference?: string;
  isDefault?: boolean;
}) {
  const count = await countAddressesByCustomerId(customerId);
  const isFirst = count === 0;
  const isDefault = isFirst ? true : (address.isDefault ?? false);
  const id = crypto.randomUUID();
  await insertAddress({
    id,
    customerId,
    line1: address.line1,
    line2: address.line2 ?? null,
    neighborhood: address.neighborhood ?? null,
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    country: address.country ?? "CHL",
    phone: address.phone ?? null,
    reference: address.reference ?? null,
    isDefault,
    isBillingDefault: isDefault,
  });
  if (isDefault && !isFirst) {
    await setDefaultAddress(customerId, id);
  }
  return { addressId: id };
}

export async function editAddress(customerId: string, addressId: string, data: {
  line1?: string;
  line2?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  reference?: string;
}) {
  const addr = await findAddressById(addressId);
  if (!addr || addr.customerId !== customerId) throw new Error("Dirección no encontrada");
  await updateAddress(addressId, data);
}

export async function removeAddress(customerId: string, addressId: string) {
  const addr = await findAddressById(addressId);
  if (!addr || addr.customerId !== customerId) throw new Error("Dirección no encontrada");
  const count = await countAddressesByCustomerId(customerId);
  if (count <= 1) throw new Error("No puedes eliminar tu única dirección");
  const wasDefault = addr.isDefault;
  await deleteAddress(addressId);
  if (wasDefault) {
    const remaining = await findAddressesByCustomerId(customerId);
    if (remaining.length > 0) {
      await setDefaultAddress(customerId, remaining[0]!.id);
    }
  }
}

export async function getAddresses(customerId: string) {
  return findAddressesByCustomerId(customerId);
}

export async function setCustomerDefaultAddress(customerId: string, addressId: string) {
  const addr = await findAddressById(addressId);
  if (!addr || addr.customerId !== customerId) throw new Error("Dirección no encontrada");
  await setDefaultAddress(customerId, addressId);
}

export async function getOrderHistory(customerId: string, page: number = 1, perPage: number = 10, db: Db = getDb()) {
  const offset = (page - 1) * perPage;
  const [orders, countResult] = await Promise.all([
    db.select().from(s.orders)
      .where(eq(s.orders.customerId, customerId))
      .orderBy(desc(s.orders.createdAt))
      .limit(perPage)
      .offset(offset),
    db.select({ count: s.orders.id }).from(s.orders)
      .where(eq(s.orders.customerId, customerId)),
  ]);
  return { orders, total: countResult.length, page, perPage };
}

export async function getOrderDetail(customerId: string, orderId: string, db: Db = getDb()) {
  const [order, items] = await Promise.all([
    db.select().from(s.orders)
      .where(eq(s.orders.id, orderId))
      .limit(1),
    db.select().from(s.orderItems)
      .where(eq(s.orderItems.orderId, orderId)),
  ]);
  if (!order[0] || order[0].customerId !== customerId) throw new Error("Orden no encontrada");
  return { ...order[0], items };
}

export type FavoriteItem = {
  skuId: string;
  productName: string;
  productSlug: string;
  priceCents: number;
  inStock: boolean;
};

export async function getCustomerFavoritesUseCase(customerId: string): Promise<FavoriteItem[]> {
  const db = getDb();
  const wishlist = await findWishlistByCustomerId(customerId);
  if (!wishlist) return [];
  const wlItems = await db.select({
    skuId: s.wishlistItems.skuId,
    addedAt: s.wishlistItems.addedAt,
  }).from(s.wishlistItems).where(eq(s.wishlistItems.wishlistId, wishlist.id));
  const items: FavoriteItem[] = [];
  for (const wl of wlItems) {
    const [skuRow] = await db.select().from(s.skus).where(eq(s.skus.id, wl.skuId)).limit(1);
    if (!skuRow) continue;
    const [productRow] = await db.select().from(s.products).where(eq(s.products.id, skuRow.productId)).limit(1);
    const [invRow] = await db.select().from(s.inventoryItems).where(eq(s.inventoryItems.skuId, skuRow.id)).limit(1);
    items.push({
      skuId: skuRow.id,
      productName: productRow?.name ?? "",
      productSlug: productRow?.slug ?? "",
      priceCents: skuRow.priceCents,
      inStock: invRow ? invRow.physicalStock - invRow.reservedStock + invRow.adjustedStock > 0 : false,
    });
  }
  return items;
}

export async function removeFavoriteUseCase(customerId: string, skuId: string): Promise<void> {
  const wishlist = await findWishlistByCustomerId(customerId);
  if (!wishlist) return;
  await repoDeleteWishlistItem(wishlist.id, skuId);
}
