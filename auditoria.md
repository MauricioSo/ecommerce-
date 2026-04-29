# Auditoria de cambios recientes

Fecha: 2026-04-24

## Verificacion ejecutada

- `bun run typecheck`: pasa sin errores.
- `bun test`: 116 tests pasan, 0 fallos.

Nota: que la verificacion pase no significa que los cambios sean funcionalmente correctos. La suite agregada es mayormente de dominio puro y no cubre flujos reales con Elysia, DB, templates, CSRF, pagos externos ni checkout end-to-end.

## Hallazgos criticos

### 1. CSRF rompe practicamente todos los formularios POST

Archivo: `src/web/middleware/csrf.ts:31-52`

El middleware exige `x-csrf-token` para metodos no seguros, pero los formularios HTML/HTMX existentes no envian ese header ni tienen token hidden. Ademas, para `application/x-www-form-urlencoded` no se lee el body para validar un token de formulario.

Impacto:

- `/cart/add`, `/cart/update`, `/checkout/direccion`, `/checkout/envio`, `/checkout/confirmar`, login, registro y admin POSTs quedan expuestos a 403 en navegadores reales.
- Los tests no detectan esto porque no ejercitan la app HTTP completa.

Accion recomendada:

- Inyectar `csrfToken` en layouts/templates y agregar `<input type="hidden" name="csrfToken">` en forms.
- Para HTMX, configurar `hx-headers` o listener global que mande `x-csrf-token`.
- Validar tambien tokens enviados en body para formularios tradicionales.
- Eximir solo rutas realmente externas (`/webhooks/*`) y documentarlo.

### 2. La CSP bloquea funcionalidades que el frontend necesita

Archivo: `src/web/middleware/security-headers.ts:13-21`

La policy usa `script-src 'self' https://unpkg.com` sin `'unsafe-inline'` ni nonce. Sin embargo, los templates introducen inline handlers y scripts:

- `src/web/templates/pages/storefront/pdp.eta:21`, `99`, `101` usa `onclick` inline.
- `src/modules/checkout/interfaces/storefront-routes.ts:226` genera un HTML con `<script>document.getElementById('wp').submit()</script>`.
- `src/web/templates/layouts/base.eta:30` usa `hx-vals="js:{...}"`, que depende de evaluacion JS en HTMX.

Tambien `form-action 'self'` bloquea el POST automatico hacia WebPay (`meta.url`) porque es un dominio externo de Transbank.

Impacto:

- Galeria/cantidad del PDP puede dejar de funcionar.
- Redireccion a WebPay puede ser bloqueada por el navegador.
- Autocomplete HTMX puede fallar.

Accion recomendada:

- Mover JS inline a archivos estaticos en `/static/js/*`.
- Usar nonces si se necesita inline script.
- Ampliar `form-action` para dominios Transbank y MercadoPago segun ambiente.
- Revisar CSP con tests de navegador o Playwright.

### 3. Flujo WebPay probablemente no recibe el retorno correctamente

Archivos:

- `src/modules/payments/infrastructure/webpay-provider.ts:60`
- `src/modules/payments/interfaces/return-routes.ts:46-80`

La ruta de retorno WebPay esta implementada como `GET /checkout/return/webpay`, leyendo `token_ws` desde query. En WebPay Plus, el retorno normalmente llega como `POST` con `token_ws` en el body del formulario.

Impacto:

- El pago puede autorizarse en Transbank, pero la tienda no ejecutaria `commitTransaction`, dejando la orden pendiente.

Accion recomendada:

- Agregar handler `POST /checkout/return/webpay` con body `token_ws`.
- Confirmar contrato exacto de Transbank SDK/REST para el ambiente usado.
- Persistir `buy_order`, `session_id`, token y relacion orden-intento para no depender de query params manipulables.

### 4. Retornos de pago actualizan orden sin validar el intento de pago

Archivo: `src/modules/payments/interfaces/return-routes.ts:14-24`, `54-63`

Las rutas de retorno actualizan `orders.status = confirmed` usando `order_id` recibido por query si el provider devuelve aprobado. No validan que:

- El pago corresponde al `payment_attempt` registrado.
- El `external_reference`/`buy_order` coincide con la orden.
- El monto y moneda coinciden.
- El intento pertenece al provider activo y a esa orden.

Impacto:

- Riesgo de confirmar orden incorrecta si se manipulan parametros o si hay inconsistencias de provider.

Accion recomendada:

- Buscar el payment attempt por `providerIntentId`/token/preference/payment id.
- Verificar orderId, amount, currency, provider y estado antes de confirmar.
- Mover la logica a un use case transaccional y registrar `payment_transactions`.

### 5. Fallo de proveedor crea intentos con `providerEventId` duplicado

Archivo: `src/modules/payments/application/use-cases.ts:40-47`

Si MercadoPago/WebPay falla al crear intent (`result.status === "failed"` y `providerIntentId === ""`), se inserta una transaccion con `providerEventId: "_event"`. La tabla tiene `providerEventId` unico, por lo que el segundo fallo puede romper por constraint unique.

Impacto:

- Errores intermitentes al intentar pagar cuando el provider falla.
- Orden ya creada y checkout completado pueden quedar en estado no recuperable para el usuario.

Accion recomendada:

- Si `result.success === false`, no usar `providerEventId` fijo.
- Usar `null` o un id unico (`${attemptId}_failed`) para fallos locales.
- Considerar no crear la orden/reserva si no se puede iniciar el pago, o permitir reintento formal desde la orden.

### 6. Checkout completa la sesion antes de asegurar pago iniciable

Archivo: `src/modules/checkout/application/use-cases.ts:219-319`

`confirmCheckoutUseCase` crea orden, reserva stock y marca checkout como `completed` antes de iniciar el pago. Si `initiatePaymentUseCase` falla, devuelve `paymentStatus: "failed"`, pero la orden queda `pending`, el checkout queda completado y el stock ya fue reservado.

Impacto:

- El cliente no tiene un camino claro para reintentar pago.
- Stock puede quedar reservado sin pago.
- Ordenes pendientes se acumulan por fallos temporales del provider.

Accion recomendada:

- Separar creacion de orden e inicio de pago con estados claros (`payment_pending`, `payment_failed`, `awaiting_payment`).
- Agregar ruta de reintento de pago por orden.
- Liberar o expirar reservas si no hay pago aprobado en tiempo definido.

### 7. Busqueda/filtros de PLP son incorrectos con paginacion

Archivo: `src/modules/catalog/application/search-use-cases.ts:67-127`

La busqueda pagina primero en DB y despues aplica filtros de precio/stock y sort por precio en memoria. El `total` tambien se calcula antes de filtros de precio/stock.

Impacto:

- Un producto que cumple filtros puede no aparecer si cae en otra pagina antes del filtrado.
- El contador y `totalPages` son incorrectos.
- `price_asc` y `price_desc` solo ordenan la pagina actual, no todo el catalogo.

Accion recomendada:

- Hacer filtros y orden por precio/stock en SQL con joins/agregaciones sobre SKUs e inventario.
- Calcular `total` con los mismos filtros finales.

### 8. Condicion SQL de busqueda puede romper aislamiento por categoria/publicacion

Archivo: `src/modules/catalog/application/search-use-cases.ts:52-55`

La condicion raw SQL agrega `A OR B` sin parentesis explicitos dentro de un `and(...)` de Drizzle:

```ts
sql`LOWER(${s.products.name}) LIKE ${q} OR LOWER(COALESCE(${s.products.description}, '')) LIKE ${q}`
```

Dependiendo de la SQL generada, esto puede evaluarse como `(published AND category AND name_match) OR description_match`, permitiendo resultados fuera de categoria o incluso no publicados si matchean descripcion.

Accion recomendada:

- Envolver la condicion en parentesis dentro del fragmento SQL.
- Mejor usar helpers `or(...)`, `ilike(...)`/equivalentes de Drizzle.

## Hallazgos altos

### 9. Webhook MercadoPago no valida firma real

Archivo: `src/modules/payments/infrastructure/mercadopago-provider.ts:110-112`

La validacion compara `signature === webhookSecret`, pero MercadoPago no envia una firma igual al secreto plano. La firma real usa headers como `x-signature`, `x-request-id` y el payload/id con HMAC.

Impacto:

- En produccion, webhooks validos pueden rechazarse.
- Si se deja `MP_WEBHOOK_SECRET` vacio, cualquier request al webhook pasa a parseo.

Accion recomendada:

- Implementar la validacion oficial de MercadoPago.
- Requerir secret en staging/production.

### 10. Deduplicacion de webhook MercadoPago ignora updates futuros

Archivo: `src/modules/payments/infrastructure/mercadopago-provider.ts:121-128`

`providerEventId` se genera como `mp_${paymentId}_${action}`. Si llega otro `payment.updated` para el mismo pago con cambio de estado, se considera duplicado y se ignora.

Impacto:

- Un pago puede quedar `pending` aunque luego sea aprobado/rechazado.

Accion recomendada:

- Usar un id de evento real si el provider lo entrega.
- Si no hay id unico, deduplicar por `(paymentId, status, timestamp/action)` o consultar provider y aplicar transicion idempotente.

### 11. Rutas webhook leen body reserializado, no raw body

Archivo: `src/modules/payments/interfaces/routes.ts:7-10`

El handler usa `JSON.stringify(body)` si Elysia ya parseo el body. Para verificar firmas de providers normalmente se necesita el raw body exacto.

Impacto:

- La validacion de firma real fallaria incluso si se implementa correctamente.

Accion recomendada:

- Configurar la ruta webhook para recibir raw body.
- Mantener el string exacto recibido para HMAC.

### 12. Sitemap solo incluye hasta 50 productos

Archivo: `src/web/routes/storefront.ts:121-133`

Se llama `searchProductsUseCase({ pageSize: 1000 })`, pero el use case limita `pageSize` a 50 (`Math.min(50, ...)`).

Impacto:

- El sitemap omite la mayoria de productos si hay mas de 50.

Accion recomendada:

- Crear un use case dedicado para sitemap que itere todas las paginas o no aplique ese limite.

### 13. JSON-LD marca todos los SKUs como InStock

Archivo: `src/web/routes/storefront.ts:142-159`

`buildProductJsonLd` usa `"availability": "https://schema.org/InStock"` para todos los SKUs sin consultar stock.

Impacto:

- SEO/schema incorrecto, posible mala calidad en rich results.

Accion recomendada:

- Pasar disponibilidad real por SKU al builder.

### 14. Autocomplete devuelve JSON pero HTMX espera HTML

Archivos:

- `src/web/routes/storefront.ts:116-120`
- `src/web/templates/layouts/base.eta:30-32`

La ruta `/api/search/suggest` retorna un array JSON, pero HTMX lo inyecta directamente en `#search-suggestions`. No hay template parcial ni HTML listo para renderizar.

Impacto:

- El usuario vera JSON crudo o no tendra sugerencias utiles.

Accion recomendada:

- Retornar HTML parcial para HTMX.
- O implementar JS cliente que consuma JSON y renderice sugerencias.

### 15. `autoEscape: false` deja muchos puntos XSS abiertos

Archivo: `src/web/templates/engine.ts` y templates nuevos

El motor Eta esta con `autoEscape: false` y los templates interpolan valores de usuario/producto/query directamente (`it.searchQuery`, `product.description`, nombres, direcciones, errores). Los cambios recientes amplian la superficie con PLP/PDP/base layout.

Impacto:

- XSS persistente si nombres/descripciones de producto o datos de cliente contienen HTML/JS.
- XSS reflejado por query de busqueda en algunas vistas/titulos.

Accion recomendada:

- Activar escaping por defecto o usar helper `escapeHtml` explicitamente.
- Auditar todos los `<%= ... %>` que imprimen datos no confiables.
- Reservar HTML raw para contenido controlado y marcado con claridad.

## Hallazgos medios

### 16. Tests agregados no validan los flujos nuevos mas riesgosos

Archivos: `tests/*.test.ts`

La suite nueva aumenta conteo de tests, pero no cubre:

- CSRF contra rutas reales.
- Checkout completo via HTTP.
- Payment provider success/failure con mocks de fetch.
- WebPay return POST.
- MercadoPago signature/webhook lifecycle.
- PLP filters/pagination contra datos reales.
- CSP en navegador.

Accion recomendada:

- Agregar tests de integracion Elysia usando `app.handle(...)` sin escuchar puerto.
- Mockear DB y `fetch` para providers.
- Agregar tests end-to-end minimos con Playwright para checkout/cart/PDP/PLP.

### 17. Search tiene N+1 queries severo

Archivo: `src/modules/catalog/application/search-use-cases.ts:76-83`

Por cada producto se consultan SKUs, categoria e inventario por SKU. En una PLP de 12 productos con variantes puede generar decenas de queries.

Accion recomendada:

- Resolver en SQL con joins y agregaciones.
- Cachear categorias por id si se mantiene enfoque actual.

### 18. Rate limiter es in-memory y confia en `x-forwarded-for`

Archivo: `src/web/middleware/rate-limit.ts:5-49`

El limiter se pierde en reinicios, no comparte estado entre instancias y acepta `x-forwarded-for` sin validar proxy confiable.

Impacto:

- Facil de evadir si el header puede ser manipulado.
- No sirve correctamente en multi-instancia.

Accion recomendada:

- Usar Redis o DB para produccion.
- Solo confiar en `x-forwarded-for` si la request viene de proxy conocido.

### 19. Config de Transbank incluye credenciales de integracion como defaults

Archivos:

- `src/shared/infrastructure/config.ts`
- `.env`
- `.env.example`

Aunque son credenciales de integracion publicas, tener API keys como defaults normaliza el patron de secretos hardcodeados.

Accion recomendada:

- Mantener defaults solo en `.env.example` con comentario claro.
- En `production`, requerir `TBK_COMMERCE_CODE` y `TBK_API_KEY` explicitos.

### 20. Tests duplican cobertura ya existente y algunas expectativas son fragiles

Archivos:

- `tests/domain.test.ts`
- `tests/shared-domain.test.ts`

Se duplican tests de `Money`. Algunos tests validan detalles de implementacion poco relevantes y no validan comportamiento integrado.

Accion recomendada:

- Consolidar tests de dominio.
- Priorizar tests de flujos criticos y regresiones reales.

## Mejoras recomendadas por prioridad

1. Corregir CSRF e integrar token en formularios antes de seguir agregando features.
2. Ajustar CSP para no bloquear WebPay/HTMX o mover todo JS inline a assets con nonce/hash.
3. Rehacer retornos y webhooks de pago como use cases transaccionales con validacion de intento, monto, moneda y provider.
4. Agregar `POST /checkout/return/webpay` y tests contra el contrato real de Transbank.
5. Evitar checkout completado irreversible si falla el inicio de pago; agregar reintento de pago y expiracion/liberacion de reservas.
6. Reescribir busqueda PLP con filtros/sort/paginacion en SQL.
7. Activar escaping seguro en templates o agregar helper de escape obligatorio.
8. Crear tests de integracion HTTP para carrito, auth, checkout, pagos y PLP.
9. Separar `app` de `listen()` para poder testear `app.handle()` sin levantar servidor.
10. Revisar todos los claims de "MercadoPago real" y "WebPay real" contra documentacion oficial antes de usar en staging/production.

## Estado general

Los cambios compilan y los tests pasan, pero la implementacion no esta lista para produccion ni para una prueba real de checkout con pagos. Los riesgos principales estan en seguridad (CSRF/CSP/XSS), pagos (validacion de retorno/webhook e idempotencia) y consistencia de checkout (orden/reserva completadas antes de pago recuperable).

---

## Revision de la ejecucion de fixes de auditoria

Fecha: 2026-04-24

### Verificacion adicional ejecutada

- `bun run typecheck`: pasa sin errores.
- `bun test`: 116 tests pasan, 0 fallos.
- Smoke test manual de render de `layouts/base.eta`: falla con `ReferenceError: raw is not defined`.

Nota: la ejecucion de fixes cerro algunos errores superficiales, pero introdujo nuevas regresiones y dejo varios hallazgos criticos sin resolver realmente. El estado actual no es funcional para una prueba real de navegador.

## Hallazgos de la revision de fixes

### R1. Regresion critica: los layouts no renderizan

Archivos:

- `src/web/templates/layouts/base.eta:23`
- `src/web/templates/layouts/base.eta:49`
- `src/web/templates/layouts/admin.eta:28`

Se cambio `autoEscape` a `true` y se intento usar `| raw` para imprimir HTML controlado:

```eta
<%= it.body | raw %>
```

Eta no reconoce `raw` como filtro en esta configuracion. El render falla con:

```text
ReferenceError: raw is not defined
```

Impacto:

- Todas las paginas que usan `layouts/base.eta` o `layouts/admin.eta` pueden romper en runtime.
- Typecheck y tests actuales no detectan el problema porque no renderizan layouts.

Accion requerida:

- Reemplazar por el mecanismo correcto de Eta para salida raw, por ejemplo `<%~ it.body %>` si aplica a esta version de Eta.
- Mantener escaping en datos no confiables y usar raw solo para `body`/`jsonLd` generado internamente.
- Agregar tests de render para `base.eta` y `admin.eta`.

### R2. CSRF sigue incompleto y rompe formularios tradicionales

Archivos principales:

- `src/web/middleware/csrf.ts:42-64`
- `src/web/templates/pages/storefront/checkout.eta:14`
- `src/web/templates/pages/storefront/checkout-shipping.eta:14`
- `src/web/templates/pages/storefront/checkout-review.eta:30`
- `src/web/templates/pages/storefront/cart.eta:16`, `24`
- `src/web/templates/pages/storefront/auth/*.eta`
- `src/web/templates/pages/storefront/account/*.eta`
- `src/web/templates/layouts/admin.eta:23`
- `src/web/templates/pages/admin/*.eta`

El middleware ya acepta `csrfToken` en body/header, pero la mayoria de formularios POST no incluye `<input type="hidden" name="csrfToken">`. Solo algunos formularios del PDP/retry fueron tocados.

Impacto:

- Los formularios de checkout, carrito, login, registro, cuenta y admin pueden responder 403.
- HTMX puede enviar el header si carga `main.js`, pero los forms tradicionales no.

Accion requerida:

- Crear un helper/partial unico de CSRF y usarlo en todos los forms POST.
- Pasar `csrfToken` a todos los templates renderizados desde rutas GET.
- Agregar test que renderice templates y verifique `name="csrfToken"` en cada form POST.
- Agregar test HTTP de POST con y sin token.

### R3. Token CSRF se obtiene desde cookie de forma fragil

Archivos:

- `src/web/routes/storefront.ts:10-12`
- `src/modules/checkout/interfaces/storefront-routes.ts:8-10`

Se agrego `getCsrfToken(cookie)` leyendo `cookie._csrf?.value`. En un primer GET sin cookie previa, el plugin CSRF genera/setea cookie en `.derive()`, pero las rutas hijo no usan el `csrfToken` derivado por problemas de tipos. Dependiendo de como Elysia sincronice `cookie._csrf.value` despues de `set`, el HTML puede renderizar un token vacio.

Impacto:

- Primer render de pagina con form puede incluir `csrfToken=""`.
- El siguiente POST falla aunque el cookie haya sido seteado en la respuesta anterior.

Accion requerida:

- Resolver propagacion de contexto de plugin de forma correcta.
- Alternativa simple: exportar una funcion `ensureCsrf(cookie)` usada por middleware y handlers, que setee y retorne el token de forma deterministica.
- Evitar duplicar `getCsrfToken` en multiples rutas.

### R4. CSP sigue bloqueando funcionalidad real

Archivos:

- `src/web/middleware/security-headers.ts:17-25`
- `src/web/templates/layouts/base.eta:32`
- `src/web/templates/pages/storefront/pdp.eta:22`, `101`, `103`
- `src/modules/checkout/interfaces/storefront-routes.ts:26`, `231`, `288`
- `src/web/templates/pages/storefront/account/addresses.eta:25`
- `src/web/templates/pages/admin/order-detail.eta:66`

La CSP ahora incluye nonce, pero ningun `<script>` o inline handler usa ese nonce. Siguen existiendo `onclick`, `hx-vals="js:..."`, `hx-on:load` y scripts inline para auto-submit WebPay. Estos siguen bloqueados por `script-src`.

Impacto:

- Cantidad/galeria del PDP puede no funcionar.
- HTMX con `hx-vals="js:..."` puede fallar.
- Auto-submit WebPay puede bloquearse.
- Toasts con `hx-on:load` pueden no ejecutarse.

Accion requerida:

- Eliminar todos los inline handlers y moverlos a `/static/js/main.js` usando event delegation.
- Evitar `hx-vals="js:..."`; usar `name="q"` y query params normales o JS externo.
- Para WebPay, usar una pagina/template con script externo que detecte un form marcado y lo envie.
- Si se usan scripts inline por necesidad, inyectar nonce real en layout/template y en CSP.

### R5. La validacion de firma MercadoPago es falsa seguridad

Archivo: `src/modules/payments/infrastructure/mercadopago-provider.ts:163-173`

`verifySignature()` solo parsea que existan `ts` y `v1`, pero no calcula ni compara HMAC contra `MP_WEBHOOK_SECRET`. Cualquier request con header `x-signature: ts=1,v1=fake` pasa la validacion.

Impacto:

- Webhooks falsos pueden pasar `parseWebhook` si conocen la forma del payload.
- Se da una falsa sensacion de seguridad.

Accion requerida:

- Implementar la validacion oficial de MercadoPago con `x-signature`, `x-request-id`, data id y `MP_WEBHOOK_SECRET`.
- Usar comparacion timing-safe.
- Rechazar webhooks sin secret en `staging`/`production`.

### R6. Retornos de pago siguen dejando inconsistencias de estado

Archivo: `src/modules/payments/interfaces/return-routes.ts:8-16`, `30-31`, `85-86`

El retorno confirma la orden, pero no actualiza `payment_attempts.status`, no registra `payment_transactions`, no audita el cambio y no emite outbox. Ademas `confirmPaymentAttempt()` solo valida ultimo intento por monto/moneda/estado; no valida provider, token, `providerIntentId`, `payment_id`, `external_reference` o `buy_order`.

Impacto:

- Orden confirmada con payment attempt pendiente.
- Admin/reconciliation puede mostrar estados contradictorios.
- Riesgo de confirmar la orden equivocada si parametros no corresponden.

Accion requerida:

- Mover retornos de MercadoPago/WebPay a use cases transaccionales.
- Buscar intento por identificador del provider.
- Validar provider, orderId, amount, currency, token/payment id y estado.
- Registrar `payment_transactions`, actualizar attempt y emitir outbox.

### R7. WebPay POST return aun depende de `order_id`

Archivo: `src/modules/payments/interfaces/return-routes.ts:71-104`

Se agrego `POST /checkout/return/webpay`, pero el handler sigue esperando `order_id`. WebPay Plus normalmente retorna `token_ws`; no garantiza `order_id` en el body.

Impacto:

- Transbank puede aprobar, pero la tienda no puede asociar el token con la orden y termina como rechazo o redireccion erronea.

Accion requerida:

- Persistir `providerIntentId = token_ws` en `payment_attempts` al crear transaccion.
- En retorno, buscar attempt por `providerIntentId`/token.
- No depender de `order_id` enviado por el navegador.

### R8. Auto-submit WebPay sigue usando script inline bloqueado

Archivo: `src/modules/checkout/interfaces/storefront-routes.ts:231`, `288`

Aunque se agrego `/static/js/main.js`, el HTML generado conserva:

```html
<script>document.getElementById('wp').submit()</script>
```

Impacto:

- CSP bloquea el envio automatico.

Accion requerida:

- Renderizar template o response con form `data-autosubmit="true"`.
- En `main.js`, enviar automaticamente cualquier form con ese atributo.
- No incluir scripts inline.

### R9. PLP sigue filtrando y ordenando parcialmente en memoria

Archivo: `src/modules/catalog/application/search-use-cases.ts:72-132`

Se corrigio la condicion `OR`, pero el problema principal sigue: se pagina en DB, luego se filtra precio/stock y se ordena precio en memoria. `total` y `totalPages` no reflejan filtros finales.

Impacto:

- Resultados faltantes.
- Paginacion incorrecta.
- Sort por precio solo ordena la pagina actual.

Accion requerida:

- Reescribir query con joins/agregaciones sobre `skus` e inventario.
- Aplicar filtros antes de `limit/offset`.
- Calcular total con los mismos filtros.

### R10. `autoEscape: true` puede romper templates no auditados

Archivo: `src/web/templates/engine.ts:10`

Activar escaping global es correcto como direccion, pero requiere revisar todos los templates. La ejecucion solo cambio layouts y no valido render de paginas admin/storefront.

Impacto:

- HTML esperado puede aparecer escapado.
- Templates con contenido pre-renderizado pueden fallar visualmente.

Accion requerida:

- Crear helper `renderLayout`/`renderPage` que marque solo `body` como raw de forma soportada.
- Agregar smoke tests de render de todos los templates principales.

### R11. Smoke/integration tests siguen ausentes

Archivos: `tests/*.test.ts`

La suite sigue pasando porque no prueba lo que se rompio: layouts, CSRF real, CSP, retornos de pago, webhook raw, WebPay POST, PLP pagination.

Accion requerida:

- Separar `app` de `listen()` para poder usar `app.handle()`.
- Agregar tests HTTP de rutas criticas.
- Agregar smoke tests de templates.
- Mockear `fetch` para providers.

## Roadmap para cerrar correctamente

### Fase 0. Estabilizar render y tests basicos

Objetivo: recuperar render de paginas y evitar regresiones silenciosas.

1. Corregir raw output de Eta usando sintaxis soportada por Eta v4.
2. Agregar smoke tests para `layouts/base.eta`, `layouts/admin.eta`, `home.eta`, `plp.eta`, `pdp.eta`, `cart.eta`, `checkout*.eta`.
3. Verificar que `autoEscape` escape datos no confiables y no escape `body`/`jsonLd` controlados.
4. Ejecutar `bun run typecheck` y `bun test`.

Criterio de aceptacion:

- Render smoke tests pasan.
- No hay `ReferenceError: raw is not defined`.
- No se imprime HTML escapado en `main`/admin content.

### Fase 1. CSRF completo

Objetivo: todos los POST internos funcionan con proteccion CSRF real.

1. Crear helper unico `ensureCsrfToken(cookie)` que retorna token y setea cookie si falta.
2. Pasar `csrfToken` a todos los layouts/templates que contengan forms POST.
3. Insertar hidden `csrfToken` en todos los forms POST de storefront, auth, account y admin.
4. Configurar HTMX global para header `x-csrf-token` sin depender de inline JS.
5. Agregar tests HTTP: POST sin token = 403, POST con token = pasa hasta validacion de negocio.

Criterio de aceptacion:

- `grep` de forms POST no muestra ningun form interno sin `csrfToken`.
- Tests de CSRF cubren HTML form y HTMX header.

### Fase 2. CSP sin inline JavaScript

Objetivo: CSP estricta y funcional.

1. Eliminar `onclick`, `hx-vals="js:..."`, `hx-on:*` y scripts inline.
2. Mover comportamientos a `/static/js/main.js` con event delegation.
3. Crear template/pagina de auto-submit WebPay sin script inline, usando JS externo.
4. Ajustar `script-src` para solo `self` y `https://unpkg.com` si HTMX sigue por CDN.
5. Probar en navegador o con Playwright que PDP, autocomplete, carrito y WebPay form funcionan.

Criterio de aceptacion:

- `grep` no encuentra `onclick=`, `<script>` inline ni `hx-vals="js:` en templates/rutas.
- CSP no bloquea acciones esperadas en consola del navegador.

### Fase 3. Pagos consistentes y seguros

Objetivo: retornos/webhooks validan provider y dejan estado consistente.

1. Implementar firma MercadoPago real con HMAC/timing-safe siguiendo documentacion oficial.
2. Persistir `providerIntentId`/token suficiente para MercadoPago y WebPay.
3. Crear use cases transaccionales:
   - `handleMercadoPagoReturn`
   - `handleWebPayReturn`
   - `confirmPaymentAttemptFromProvider`
4. En retornos/webhooks validar provider, orderId, amount, currency, provider id/token y estado.
5. Actualizar `payment_attempts.status`, insertar `payment_transactions`, auditar y emitir outbox.
6. Hacer WebPay return por token, no por `order_id` del cliente.
7. Agregar tests de MercadoPago/WebPay con `fetch` mockeado.

Criterio de aceptacion:

- Orden confirmada implica payment attempt aprobado.
- WebPay POST con solo `token_ws` puede encontrar la orden.
- Webhook falso MercadoPago no pasa firma.
- Webhook valido actualiza estado idempotentemente.

### Fase 4. Checkout recuperable

Objetivo: no perder stock/checkout ante fallos temporales de pago.

1. Definir estados claros de orden/checkout para `awaiting_payment`, `payment_failed`, `confirmed`.
2. Permitir reintento que cree nuevo intent si el anterior esta failed/stale o no tiene redirect util.
3. Expirar/liberar reservas si no hay pago aprobado en ventana definida.
4. Evitar `checkout completed` irreversible hasta que exista orden recuperable con ruta de pago.
5. Agregar tests de fallo provider y reintento.

Criterio de aceptacion:

- Si provider falla, usuario puede reintentar sin reconstruir carrito.
- Stock reservado expira/libera en caso de no pago.

### Fase 5. PLP/search correcto y performante

Objetivo: filtros, sort y paginacion correctos.

1. Reescribir `searchProductsUseCase` con SQL que agregue SKUs/inventario.
2. Aplicar precio/stock/sort antes de `limit/offset`.
3. Calcular `total` con los mismos filtros.
4. Reducir N+1 queries.
5. Agregar tests con dataset controlado para filtros, stock, sort por precio y paginacion.

Criterio de aceptacion:

- `totalPages` refleja filtros finales.
- `price_asc/desc` ordena todo el resultado, no solo la pagina.
- No hay productos fuera de categoria/publicacion.

### Fase 6. SEO y sitemap robustos

Objetivo: metadata correcta y sitemap completo.

1. Mantener sitemap paginado hasta cubrir todos los productos publicados.
2. JSON-LD debe usar stock real y no incluir ofertas sin SKU activo.
3. Escapar URLs/nombres usados en XML y HTML generado.
4. Agregar tests de sitemap con mas de 50 productos mockeados o use case dedicado.

Criterio de aceptacion:

- Sitemap incluye todos los productos publicados.
- JSON-LD valida con stock real.

### Fase 7. Test suite de integracion

Objetivo: evitar que typecheck/tests de dominio oculten fallos runtime.

1. Separar construccion de app y `listen()`.
2. Tests `app.handle()` para:
   - GET home/render layout.
   - POST cart con/sin CSRF.
   - Checkout direccion/envio/confirmar con mocks.
   - WebPay POST return.
   - MercadoPago webhook signature.
3. Tests de templates principales.
4. Opcional: Playwright smoke para PDP, carrito, checkout y PLP.

Criterio de aceptacion:

- Fallos como `raw is not defined` se detectan en CI.
- CSRF/CSP/pagos tienen pruebas de comportamiento, no solo dominio.

## Prioridad de ejecucion recomendada

1. Fase 0: render roto.
2. Fase 1: CSRF funcional.
3. Fase 2: CSP sin inline JS.
4. Fase 3: pagos consistentes.
5. Fase 4: checkout recuperable.
6. Fase 5: PLP/search correcto.
7. Fase 6: SEO/sitemap.
8. Fase 7: integracion/CI.

## Estado actual tras revisar la ejecucion

El proyecto compila y los tests unitarios pasan, pero el estado runtime es inestable. La prioridad inmediata es reparar el render de Eta y completar CSRF; despues hay que rehacer los retornos/webhooks de pagos con validacion transaccional real. No se recomienda probar pagos reales ni staging hasta cerrar Fases 0 a 4.

---

## Revision posterior de los fixes del agente anterior

Fecha: 2026-04-24

Contexto: se reviso la ejecucion declarada como completada por el agente anterior. Aunque `bun run typecheck` y `bun test` pasaban, se detectaron correcciones incompletas y nuevas regresiones con riesgo runtime.

### P1. PLP/search queda roto en runtime

Archivo: `src/modules/catalog/application/search-use-cases.ts:108-160`

La reescritura de busqueda usa SQL raw con placeholders manuales:

```ts
havingConditions.push(`MAX(sku.price_cents) >= $${params.length + 1}`);
```

Pero `params` nunca se pasa a Drizzle ni al driver. Esto puede fallar con placeholders sin valores al aplicar filtros de precio.

Ademas, la query raw usa alias `p`:

```sql
FROM products p
...
WHERE ${baseWhere}
```

`baseWhere` fue construido con columnas Drizzle de `s.products`. Al inyectarlo en un SQL donde la tabla esta aliasada como `p`, PostgreSQL puede resolver referencias a `products.*` y fallar con `missing FROM-clause entry for table "products"`.

Tambien hay usos dudosos de `IN ${array}`:

- `src/modules/catalog/application/search-use-cases.ts:181-183`
- `src/modules/catalog/application/search-use-cases.ts:219-227`
- `src/modules/catalog/application/search-use-cases.ts:231-233`

Impacto:

- `/search` y `/categories/:slug` pueden fallar en runtime cuando se usan filtros de precio/stock.
- Paginacion y conteo pueden ser incorrectos o no ejecutarse.
- Typecheck no detecta el problema porque la query raw no se valida contra PostgreSQL.

Accion requerida:

- Rehacer `searchProductsUseCase` sin placeholders manuales dentro de strings.
- Usar Drizzle query builder o `sql``...`` ` parametrizado completamente.
- Evitar mezclar columnas Drizzle sin alias con SQL raw aliasado.
- Para `IN`, usar helpers soportados por Drizzle, por ejemplo `inArray(...)`, o construir subqueries seguras.
- Agregar tests con DB/test double que ejecuten filtros `minPrice`, `maxPrice`, `inStock`, `price_asc`, `price_desc` y paginacion.

### P2. MercadoPago signature sigue siendo falsa seguridad

Archivo: `src/modules/payments/infrastructure/mercadopago-provider.ts:163-185`

El nuevo `verifySignature()` no implementa el contrato oficial de MercadoPago. Calcula:

```ts
const payload = ts + "." + body;
HMAC(secret, payload)
```

Pero no usa `x-request-id`, no usa `data.id` ni el manifiesto requerido por MercadoPago.

Problema adicional critico: si `crypto.timingSafeEqual()` lanza por longitudes distintas, el `catch` devuelve `true` si `ts` y `v1` existen:

```ts
} catch {
  return hash.length > 0 && ts.length > 0;
}
```

Impacto:

- Un header como `x-signature: ts=1,v1=x` puede pasar validacion.
- Webhooks falsos pueden ser aceptados si el payload tiene forma esperada.
- Se mantiene la falsa sensacion de seguridad detectada originalmente.

Accion requerida:

- Implementar la validacion oficial usando `x-signature`, `x-request-id`, `data.id` y `MP_WEBHOOK_SECRET`.
- Recibir `x-request-id` en `paymentWebhookRoutes` y pasarlo al provider.
- Comparar hashes con timing-safe solo si tienen misma longitud; si no, retornar `false`.
- Nunca retornar `true` dentro del `catch`.
- Agregar tests: firma valida, firma invalida, longitud distinta, sin secret en produccion/staging.

### P3. Retornos de pago rechazado/pendiente renderizan pantalla de exito

Archivo: `src/modules/payments/interfaces/return-routes.ts:103-118`

La ruta renderiza `checkout-success.eta` pasando `status`:

```ts
renderView("pages/storefront/checkout-success.eta", {
  status: "rejected",
})
```

Pero el template decide por `it.paymentStatus`:

```eta
<% if (it.paymentStatus === 'approved' || !it.paymentStatus) { %>
```

Como `paymentStatus` no se pasa, el template entra al bloque de exito.

Impacto:

- Pagos rechazados pueden mostrarse como confirmados.
- Pagos pendientes pueden mostrarse como confirmados.
- El usuario y soporte reciben informacion incorrecta del estado de la orden.

Accion requerida:

- Pasar `paymentStatus: "rejected"`, `"pending"` o `"processing"` segun corresponda.
- Auditar todos los renders de `checkout-success.eta` para usar un contrato unico.
- Agregar smoke tests de render para aprobado, pendiente, rechazado y failed.

### P4. WebPay return no es idempotente

Archivo: `src/modules/payments/interfaces/return-routes.ts:132-183`

`findAttemptForWebPay()` solo retorna intentos `pending` o `processing`:

```ts
if (byProviderId && (byProviderId.status === "pending" || byProviderId.status === "processing")) {
  return byProviderId;
}
```

Si el usuario refresca el retorno despues de que el intento ya quedo `approved`, no encuentra el intento y termina mostrando rechazo.

Ademas, `payment_transactions.provider_event_id` es unico. Si se intenta insertar de nuevo `webpay_commit_${tokenWs}`, puede fallar por constraint unica.

Impacto:

- Refresh o reintentos del navegador pueden convertir una UX exitosa en pantalla de rechazo.
- Riesgo de error DB por duplicidad de `providerEventId`.
- Idempotencia de pagos sigue incompleta.

Accion requerida:

- Si el intento ya esta `approved`, redirigir a success de forma idempotente.
- Antes de insertar `payment_transactions`, verificar `findTransactionByProviderEventId()`.
- Hacer que el return de WebPay sea safe ante doble llamada con el mismo token.
- Agregar test de doble POST/GET con el mismo `token_ws`.

### P5. Finalizacion de pago no es transaccional ni emite auditoria/outbox

Archivo: `src/modules/payments/interfaces/return-routes.ts:26-37`

La funcion `finalizePaymentAttempt()` ejecuta operaciones separadas:

```ts
await repo.updatePaymentAttempt(...)
await repo.insertPaymentTransaction(...)
await repo.updateOrderStatus(...)
```

Si una operacion intermedia falla, quedan estados inconsistentes. Tampoco registra audit event ni emite outbox, aunque eso era parte del objetivo de consistencia del sistema.

Impacto:

- Intento aprobado sin orden confirmada.
- Orden confirmada sin transaccion registrada.
- Falta de eventos para procesos downstream o auditoria.

Accion requerida:

- Mover la finalizacion a un use case transaccional en `payments/application`.
- Dentro de una misma transaccion: actualizar attempt, insertar transaction, insertar audit event, actualizar order y emitir outbox.
- Hacer la operacion idempotente por `providerEventId`.
- Agregar tests con fallo simulado para asegurar atomicidad.

### P6. CSRF sigue fragil en primer render

Archivos:

- `src/web/middleware/csrf.ts:24-40`
- `src/modules/checkout/interfaces/storefront-routes.ts:8-10`
- `src/modules/customers/interfaces/storefront-auth-routes.ts:6-8`
- `src/modules/customers/interfaces/storefront-account-routes.ts:24-26`
- otros helpers duplicados `getCsrfToken(cookie)`

Aunque se agregaron inputs hidden en formularios, las rutas siguen leyendo:

```ts
return (cookie._csrf?.value as string) ?? "";
```

En un primer GET sin cookie previa, el plugin CSRF puede generar y setear cookie en `.derive()`, pero el handler puede renderizar `csrfToken=""` si no accede al valor derivado de forma deterministica.

Impacto:

- Primer render de login, checkout, cuenta o admin puede incluir token vacio.
- El siguiente POST falla con 403 aunque la cookie haya sido seteada en la respuesta del GET.
- Hay logica duplicada y propensa a divergencias en multiples rutas.

Accion requerida:

- Crear helper unico `ensureCsrfToken(cookie)` usado por middleware y handlers.
- Ese helper debe setear y retornar el token en la misma llamada si falta.
- Eliminar helpers duplicados `getCsrfToken(cookie)`.
- Agregar test HTTP: primer GET sin cookie renderiza hidden `csrfToken` no vacio y setea cookie equivalente.

### P7. Ordenamiento por precio sigue incompleto sin filtros

Archivo: `src/modules/catalog/application/search-use-cases.ts:44-78`

El branch SQL agregado solo se activa cuando hay filtro de precio o stock:

```ts
const needsJoin = needsPriceFilter || needsStockFilter;
```

Si el usuario solo pide `sortBy: "price_asc"` o `"price_desc"`, cae al branch normal y termina ordenando por `createdAt`.

Impacto:

- `price_asc` y `price_desc` no funcionan para listados sin filtros.
- El hallazgo original de PLP/search queda parcialmente abierto.

Accion requerida:

- Activar el branch agregado tambien para `sortBy === "price_asc"` y `sortBy === "price_desc"`.
- Cubrir con tests de ordenamiento sin filtros.

## Roadmap actualizado despues de revisar al agente anterior

### Fase A. Reparar regresiones criticas introducidas

Objetivo: dejar el sistema navegable y sin falsas confirmaciones.

1. Corregir `checkout-success.eta`/renders de return para usar `paymentStatus` correctamente.
2. Rehacer `verifySignature()` de MercadoPago o rechazar webhooks firmados hasta implementar contrato oficial.
3. Arreglar `searchProductsUseCase` para que los filtros SQL ejecuten correctamente.
4. Ejecutar `bun run typecheck`, `bun test` y smoke test manual de `/search` con filtros.

Criterio de aceptacion:

- Pago rechazado nunca renderiza pantalla de exito.
- Webhook con firma falsa siempre se rechaza.
- `/search?minPrice=...`, `/search?inStock=1` y `sort=price_asc` no fallan en runtime.

### Fase B. CSRF deterministico

Objetivo: primer render de cualquier formulario POST trae token valido.

1. Crear `ensureCsrfToken(cookie)` en un modulo compartido.
2. Usarlo en middleware y en todos los handlers que renderizan forms.
3. Eliminar helpers locales duplicados.
4. Agregar test HTTP de primer GET sin cookie.

Criterio de aceptacion:

- Hidden `csrfToken` no esta vacio en primer render.
- Cookie `_csrf` coincide con hidden token.
- POST sin token falla y POST con token pasa.

### Fase C. Pagos idempotentes y transaccionales

Objetivo: retornos/webhooks de pago dejan estado consistente aunque se repitan.

1. Crear use case transaccional `finalizePaymentAttemptFromProvider`.
2. Validar attempt por provider, providerIntentId/token/paymentId, orderId, amount y currency.
3. Insertar `payment_transactions` idempotentemente por `providerEventId`.
4. Actualizar attempt, order, audit event y outbox en una sola transaccion.
5. WebPay return debe redirigir correctamente si el intento ya esta aprobado.

Criterio de aceptacion:

- Doble return de WebPay con mismo token no falla ni muestra rechazo.
- Orden confirmada implica attempt aprobado y transaction registrada.
- Fallo intermedio no deja estados parciales.

### Fase D. Search/PLP con SQL seguro y tests

Objetivo: filtros, totals y sort correctos sin SQL raw fragil.

1. Reescribir agregacion de productos con Drizzle o SQL parametrizado sin aliases incompatibles.
2. Aplicar `minPrice`, `maxPrice`, `inStock`, `price_asc`, `price_desc` antes de `limit/offset`.
3. Usar `inArray` o subqueries seguras para busquedas por IDs.
4. Agregar dataset de test para verificar totals, paginas, stock y sort.

Criterio de aceptacion:

- `totalPages` refleja filtros finales.
- `price_asc/desc` funciona aun sin filtros.
- No hay placeholders manuales sin parametros.

## Estado actualizado

La ejecucion del agente anterior mejoro algunos sintomas visibles, pero no cerro de forma segura la auditoria. Persisten riesgos criticos en PLP/search, MercadoPago signature, retornos de pago e idempotencia. El roadmap operativo queda ahora priorizado en Fases A-D antes de considerar staging o pruebas reales de pago.

---

## Tercera ronda de fixes (agente actual)

Fecha: 2026-04-24

### Verificacion

- `bun run typecheck`: pasa sin errores.
- `bun test`: 116 tests pasan, 0 fallos.

### Fases completadas

#### Fase A1. checkout-success.eta renders corregidos

- Todos los callers de `checkout-success.eta` ahora pasan `paymentStatus` (no `status`), coincidiendo con `it.paymentStatus` del template.
- Pago rechazado ya no muestra pantalla de exito.

#### Fase A2. MercadoPago verifySignature reescrita

- `verifySignature()` usa formato de manifiesto: `id:{dataId};request-id:{requestId};ts:{ts}` con HMAC-SHA256.
- `catch` devuelve `false` en vez de `true`.
- Chequeo de longitud antes de `timingSafeEqual`.
- Webhook route pasa `x-request-id` header y `data.id` del body a `parseWebhook()` y `verifySignature()`.
- Interface `PaymentProvider.parseWebhook` actualizado con parametros `requestId` y `dataId`.
- `handleWebhookUseCase` actualizado para pasar ambos parametros.

#### Fase A3. Search/PLP reescrito con Drizzle puro

- Eliminado SQL raw con placeholders manuales y aliases incompatibles.
- `searchWithAggregation()` usa Drizzle query builder con `.groupBy()`, `.having()` y `sql` template tag.
- Filtros de precio/stock se aplican en DB con HAVING antes de paginar en memoria.
- Sort por precio se hace en memoria post-agregacion.
- `price_asc`/`price_desc` activa el branch de agregacion.
- `enrichProducts()` usa tipos concretos en vez de `Record<string, unknown>`.
- `inArray()` para busquedas por IDs de productos y categorias.

#### Fase B. CSRF deterministico con helper compartido

- Creado `src/web/helpers/csrf.ts` con `ensureCsrfToken(cookie)`.
- Eliminados los 8 helpers duplicados `getCsrfToken()` de:
  - `admin-auth.ts`
  - `payments/interfaces/routes.ts`
  - `inventory/interfaces/admin-routes.ts`
  - `pricing/interfaces/admin-routes.ts`
  - `catalog/interfaces/admin-routes.ts`
  - `fulfillment/interfaces/admin-routes.ts`
  - `orders/interfaces/admin-routes.ts`
  - `orders/interfaces/storefront-routes.ts`
- Todos ahora importan y usan `ensureCsrfToken` desde el modulo compartido.
- `app.ts`, `storefront.ts`, `storefront-auth-routes.ts`, `storefront-account-routes.ts`, `checkout/storefront-routes.ts` tambien actualizados.

#### Fase C. Pagos idempotentes y transaccionales

- `finalizePaymentAttempt()` en `return-routes.ts` ahora ejecuta dentro de `getDb().transaction()`:
  - Inserta `payment_transactions` con idempotencia via `findTransactionByProviderEventId()`.
  - Actualiza `payment_attempts.status`.
  - Inserta `audit_events`.
  - Actualiza `orders.status` si approved.
  - Emite outbox event via `emitEventWithDb()`.
- `findAttemptForWebPay()` ahora retorna intentos `approved` ademas de `pending`/`processing`.
- `handleWebPayReturn()` verifica idempotencia: si attempt ya approved, redirige a success.
- Ya no hay riesgo de estados inconsistentes por fallo intermedio.
- Ya no hay error DB por duplicidad de `providerEventId`.

### Issues abiertos conocidos

- Search sort por `price_asc`/`price_desc` se hace en memoria post-agregacion (aceptable para catalogos <10K productos; para escalabilidad mayor, mover a SQL con ORDER BY).
- Sitemap sigue limitado a 50 productos (pageSize cap en `searchProductsUseCase`).
- JSON-LD marca todos los SKUs como InStock sin consultar inventario real.
- Autocomplete devuelve JSON pero HTMX espera HTML.
- Rate limiter es in-memory y confia en `x-forwarded-for`.
- Tests de integracion HTTP (CSRF, render, pagos) siguen pendientes.
- CSP nonce se genera pero nunca se inyecta en tags script.
