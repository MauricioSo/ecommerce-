import { describe, test, expect } from "bun:test";
import {
  createPaymentAttempt,
  processPayment,
  approvePayment,
  rejectPayment,
  failPayment,
  cancelPayment,
  addTransaction,
  isPaymentApproved,
  isPaymentTerminal,
  createRefund,
} from "../src/domain/payments/entities.ts";

function makeAttempt() {
  return createPaymentAttempt({
    orderId: "ord-1",
    provider: "mock",
    amountCents: 50000,
    currency: "CLP",
  });
}

describe("Payment Domain - PaymentAttempt", () => {
  test("crea intent con estado pending", () => {
    const attempt = makeAttempt();
    expect(attempt.status).toBe("pending");
    expect(attempt.orderId).toBe("ord-1");
    expect(attempt.transactions).toEqual([]);
    expect(attempt.amount.amount).toBe(50000);
  });

  test("requiere orderId", () => {
    expect(() => createPaymentAttempt({ orderId: "", provider: "mock", amountCents: 100 })).toThrow("order");
  });

  test("requiere provider", () => {
    expect(() => createPaymentAttempt({ orderId: "o1", provider: "", amountCents: 100 })).toThrow("provider");
  });

  test("requiere monto positivo", () => {
    expect(() => createPaymentAttempt({ orderId: "o1", provider: "mock", amountCents: 0 })).toThrow("positive");
    expect(() => createPaymentAttempt({ orderId: "o1", provider: "mock", amountCents: -1 })).toThrow("positive");
  });

  test("processPayment cambia a processing", () => {
    const processed = processPayment(makeAttempt());
    expect(processed.status).toBe("processing");
  });

  test("approvePayment cambia a approved", () => {
    const approved = approvePayment(processPayment(makeAttempt()), { providerIntentId: "pi-1" });
    expect(approved.status).toBe("approved");
  });

  test("approvePayment agrega transaccion", () => {
    const approved = approvePayment(processPayment(makeAttempt()), { providerIntentId: "pi-1" });
    expect(approved.transactions.length).toBe(1);
    expect(approved.transactions[0]!.eventType).toBe("intent_succeeded");
  });

  test("rejectPayment cambia a rejected", () => {
    const rejected = rejectPayment(processPayment(makeAttempt()), {});
    expect(rejected.status).toBe("rejected");
  });

  test("failPayment cambia a failed", () => {
    const failed = failPayment(processPayment(makeAttempt()));
    expect(failed.status).toBe("failed");
  });

  test("cancelPayment funciona desde pending", () => {
    const cancelled = cancelPayment(makeAttempt());
    expect(cancelled.status).toBe("cancelled");
  });

  test("no se puede cancelar un pago approved", () => {
    const approved = approvePayment(processPayment(makeAttempt()), { providerIntentId: "pi-1" });
    expect(() => cancelPayment(approved)).toThrow();
  });
});

describe("Payment Domain - Transacciones", () => {
  test("addTransaction agrega evento", () => {
    const withTx = addTransaction(makeAttempt(), {
      eventType: "intent_created",
      providerEventId: "evt-1",
      payload: { test: true },
    });
    expect(withTx.transactions.length).toBe(1);
    expect(withTx.transactions[0]!.eventType).toBe("intent_created");
    expect(withTx.transactions[0]!.providerEventId).toBe("evt-1");
  });

  test("addTransaction multiples eventos", () => {
    let attempt = addTransaction(makeAttempt(), { eventType: "intent_created" });
    attempt = addTransaction(attempt, { eventType: "intent_succeeded" });
    expect(attempt.transactions.length).toBe(2);
  });
});

describe("Payment Domain - Queries", () => {
  test("isPaymentApproved", () => {
    expect(isPaymentApproved(makeAttempt())).toBe(false);
    const approved = approvePayment(processPayment(makeAttempt()), { providerIntentId: "pi-1" });
    expect(isPaymentApproved(approved)).toBe(true);
  });

  test("isPaymentTerminal reconoce estados finales", () => {
    const approved = approvePayment(processPayment(makeAttempt()), { providerIntentId: "pi-1" });
    expect(isPaymentTerminal(approved)).toBe(true);

    const rejected = rejectPayment(processPayment(makeAttempt()), {});
    expect(isPaymentTerminal(rejected)).toBe(true);

    const cancelled = cancelPayment(makeAttempt());
    expect(isPaymentTerminal(cancelled)).toBe(true);

    expect(isPaymentTerminal(makeAttempt())).toBe(false);
    expect(isPaymentTerminal(processPayment(makeAttempt()))).toBe(false);
  });
});

describe("Payment Domain - Refund", () => {
  test("createRefund funciona con datos validos", () => {
    const refund = createRefund({
      orderId: "ord-1",
      paymentAttemptId: "att-1",
      amountCents: 5000,
      currency: "CLP",
      reason: "Customer request",
    });
    expect(refund.status).toBe("pending");
    expect(refund.reason).toBe("Customer request");
    expect(refund.amount.amount).toBe(5000);
  });

  test("createRefund requiere orderId", () => {
    expect(() => createRefund({
      orderId: "",
      paymentAttemptId: "att-1",
      amountCents: 5000,
    })).toThrow("order");
  });

  test("createRefund requiere monto positivo", () => {
    expect(() => createRefund({
      orderId: "ord-1",
      paymentAttemptId: "att-1",
      amountCents: 0,
    })).toThrow("positive");
  });
});
