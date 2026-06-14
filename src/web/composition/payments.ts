import { MockPaymentProvider, setPaymentProvider } from "../../application/payments/provider.ts";
import { MercadoPagoProvider } from "../../infrastructure/payments/mercadopago-provider.ts";
import { WebPayProvider } from "../../infrastructure/payments/webpay-provider.ts";
import { setPaymentFinalizer } from "../../application/payments/finalize.ts";
import { setPaymentUseCaseDependencies } from "../../application/payments/use-cases.ts";
import { setPaymentReconciliationRepository } from "../../application/payments/reconciliation.ts";
import { DrizzlePaymentFinalizer } from "../../infrastructure/payments/drizzle-payment-finalizer.ts";
import { DrizzlePaymentReconciliationRepository } from "../../infrastructure/payments/drizzle-payment-reconciliation-repository.ts";
import { DrizzlePaymentRepository } from "../../infrastructure/payments/repository.ts";
import { DrizzlePaymentWorkflow } from "../../infrastructure/payments/drizzle-payment-workflow.ts";
import { getConfig } from "../../shared/infrastructure/config.ts";

const config = getConfig();
setPaymentFinalizer(new DrizzlePaymentFinalizer());
setPaymentUseCaseDependencies({
  repository: new DrizzlePaymentRepository(),
  workflow: new DrizzlePaymentWorkflow(),
});
setPaymentReconciliationRepository(new DrizzlePaymentReconciliationRepository());

switch (config.PAYMENT_PROVIDER) {
  case "mercadopago":
    if (!config.MP_ACCESS_TOKEN) throw new Error("MP_ACCESS_TOKEN is required for MercadoPago");
    setPaymentProvider(new MercadoPagoProvider(config.MP_ACCESS_TOKEN, config.MP_WEBHOOK_SECRET, config.MP_PUBLIC_KEY, config.BASE_URL));
    break;
  case "webpay":
    setPaymentProvider(new WebPayProvider(config.TBK_COMMERCE_CODE, config.TBK_API_KEY, config.TBK_ENV, config.BASE_URL));
    break;
  default:
    setPaymentProvider(new MockPaymentProvider());
}
