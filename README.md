# Ecommerce MVP

E-commerce platform built with Bun, Elysia, Eta templates, and PostgreSQL.

## Tech Stack

- **Runtime**: Bun
- **Framework**: Elysia
- **Templates**: Eta
- **ORM**: Drizzle
- **Database**: PostgreSQL
- **Architecture**: Monolito modular con Clean Architecture

## Requirements

- Bun 1.x
- PostgreSQL 17+ (or Docker)

## Setup

### 1. Install dependencies

```bash
bun install
```

### 2. Configure environment

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Key variables:
- `DATABASE_URL`: PostgreSQL connection string
- `PAYMENT_PROVIDER`: `mock`, `mercadopago`, or `webpay`
- For WebPay (Chile): Set `TBK_COMMERCE_CODE` and `TBK_API_KEY`
- For MercadoPago: Set `MP_ACCESS_TOKEN` and `MP_WEBHOOK_SECRET`

### 3. Start PostgreSQL

Using Docker:
```bash
docker-compose up -d
```

### 4. Run migrations

```bash
bun run db:generate
bun run db:migrate
```

### 5. Seed database (optional)

```bash
bun run scripts/seed.ts
```

### 6. Start the application

```bash
# Development
bun run dev

# Production
bun run start
```

### 7. Start the worker (separate terminal)

```bash
bun run worker
```

## Payment Providers

### Mock (default for development)
Set `PAYMENT_PROVIDER=mock` - payments are automatically approved.

### WebPay (Chile)
Set `PAYMENT_PROVIDER=webpay` and configure:
- `TBK_COMMERCE_CODE`: Commerce code from Transbank
- `TBK_API_KEY`: API key from Transbank
- `TBK_ENV`: `integration` or `production`

### MercadoPago
Set `PAYMENT_PROVIDER=mercadopago` and configure:
- `MP_ACCESS_TOKEN`: Access token from MercadoPago
- `MP_WEBHOOK_SECRET`: Webhook verification secret

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start development server with watch |
| `bun run start` | Start production server |
| `bun run worker` | Start background worker |
| `bun run db:generate` | Generate migrations |
| `bun run db:migrate` | Run migrations |
| `bun run db:studio` | Open Drizzle Studio |
| `bun run typecheck` | Run TypeScript type check |
| `bun test` | Run tests |

## Admin Access

After seeding, admin credentials are:
- Email: `admin@example.com`
- Password: `admin123`

**Change these in production!**

## API Routes

### Storefront
- `/` - Home page
- `/categories/:slug` - Category listing
- `/products/:slug` - Product detail
- `/search` - Search products
- `/cart` - Shopping cart
- `/checkout` - Checkout flow
- `/checkout/return/webpay` - WebPay return
- `/checkout/return/mercadopago` - MercadoPago return
- `/orders/:id/status` - Public order status

### Admin
- `/admin` - Dashboard
- `/admin/orders` - Order management
- `/admin/products` - Product catalog
- `/admin/categories` - Category management
- `/admin/inventory` - Stock management
- `/admin/promotions` - Promotions and coupons
- `/admin/payments` - Payment reconciliation
- `/admin/fulfillment/shipments` - Shipment management
- `/admin/fulfillment/returns` - Return requests