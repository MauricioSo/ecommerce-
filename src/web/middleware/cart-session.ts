import Elysia from "elysia";
import { getDb } from "../../shared/infrastructure/db/index.ts";
import * as s from "../../shared/infrastructure/db/schema.ts";
import { eq } from "drizzle-orm";
import { customerSessionPlugin } from "./customer-session.ts";
import { signCookieValue, verifySignedCookieValue } from "../helpers/signed-cookie.ts";

export type CartContext = {
  cartId: string;
};

export const cartSessionPlugin = new Elysia({ name: "cart-session" })
  .use(customerSessionPlugin)
  .derive(async ({ cookie, customer }): Promise<CartContext> => {
    const db = getDb();
    const cartCookie = cookie._cart;
    const existingCartId = verifySignedCookieValue(cartCookie?.value);

    if (customer?.customerId) {
      const existingCart = await db.select().from(s.carts)
        .where(eq(s.carts.customerId, customer.customerId))
        .limit(1);
      if (existingCart[0]) {
        if (!cartCookie || existingCartId !== existingCart[0].id) {
          cartCookie?.set({ value: signCookieValue(existingCart[0].id), httpOnly: true, path: "/", maxAge: 30 * 24 * 60 * 60 });
        }
        return { cartId: existingCart[0].id };
      }
    }

    if (existingCartId && typeof existingCartId === "string") {
      const cart = await db.select().from(s.carts)
        .where(eq(s.carts.id, existingCartId))
        .limit(1);
      if (cart[0]) {
        if (cart[0].customerId && cart[0].customerId !== customer?.customerId) {
          // Cart belongs to a different customer — do not use it
        } else {
          if (customer?.customerId && !cart[0].customerId) {
            await db.update(s.carts)
              .set({ customerId: customer.customerId, updatedAt: new Date() })
              .where(eq(s.carts.id, cart[0].id));
          }
          return { cartId: cart[0].id };
        }
      }
    }

    const newCartId = crypto.randomUUID();
    const sessionId = customer?.customerId ? null : crypto.randomUUID();
    await db.insert(s.carts).values({
      id: newCartId,
      sessionId,
      customerId: customer?.customerId ?? null,
    });
    cartCookie?.set({ value: signCookieValue(newCartId), httpOnly: true, path: "/", maxAge: 30 * 24 * 60 * 60 });
    return { cartId: newCartId };
  });
