# AGENTS.md

## Mandatory First Step

Every agent working in this repository must read this file before starting any task.

This project is governed by the specs in `specs/`. The specs are acceptance criteria, not background documentation. Do not claim that work is complete unless the relevant spec requirements are implemented, verified, and documented with evidence.

## Required Spec Workflow

Before coding, every agent must:

1. Read `specs/spec-auditoria-final.md` completely.
2. Read the relevant subspecs completely.
3. Pay special attention to unfinished, critical, or high-risk subspecs.
4. Treat each task, standard, and acceptance criterion as a requirement.
5. Check existing implementation before making assumptions.

The main specs are:

1. `specs/spec-auditoria-final.md`
2. `specs/spec-to-end-ecommerce.md`
3. `specs/subspec-01-auth-sessions.md`
4. `specs/subspec-02-security-middleware.md`
5. `specs/subspec-03-payments.md`
6. `specs/subspec-04-checkout.md`
7. `specs/subspec-05-catalog-search.md`
8. `specs/subspec-06-admin-panel.md`
9. `specs/subspec-07-data-protection.md`
10. `specs/subspec-08-observability.md`
11. `specs/subspec-09-testing.md`
12. `specs/subspec-10-infra-config.md`

## Definition Of Done

A task is not complete just because code was written or unit tests pass.

A task is complete only when all relevant conditions are true:

1. The implementation satisfies the relevant spec and subspec acceptance criteria.
2. Relevant unit, integration, and E2E/manual smoke tests exist or are updated.
3. Verification commands have been run after the change.
4. Test/build/deployment evidence is available.
5. Spec status tables or release checklists are updated only after evidence exists.
6. No production claim is made unless deployment checks pass.

## Verification Requirements

After each meaningful implementation area, run the relevant verification commands.

At minimum, for code changes run:

```bash
bun run typecheck
bun test
```

For integration-facing changes, also run or add integration tests that exercise real routes with `app.handle()` or the appropriate HTTP flow.

For browser-facing changes, add or run E2E tests when the flow is ready. If automated E2E is not available yet, document and execute a manual smoke checklist for the affected flow.

For production/deployment changes, verify at least:

```bash
docker compose -f docker-compose.prod.yml config
docker build -t ecommerce-readiness-check .
```

When applicable, also verify:

1. App starts successfully.
2. Worker starts successfully.
3. `/health` responds.
4. `/health/ready` responds correctly.
5. `/metrics` responds.
6. Migrations run on a clean database.
7. Seed creates usable admin and storefront data.
8. Production config fails fast with unsafe defaults.

## E2E And Smoke Testing

E2E coverage is required for production readiness.

Agents must not skip E2E validation for critical user flows once the flow is ready to test. Critical flows include:

1. Customer registration and email verification.
2. Customer login/logout.
3. Product listing and product detail page.
4. Add to cart, update cart, remove from cart.
5. Checkout address, shipping, review, and payment initiation.
6. Payment return/webhook handling for the selected provider.
7. Order status lookup.
8. Admin login.
9. Admin product, inventory, order, payment, and shipment operations.
10. Worker/outbox processing.

If automated E2E cannot be run, create or update `RELEASE-CHECKLIST.md` with a detailed manual test and record what was actually verified.

## Spec Status And Checklists

Do not mark anything as `PASS`, completed, or production-ready without evidence.

When updating spec status tables or release checklists:

1. Include the exact command or manual flow used.
2. Include the result.
3. Include any known limitation or residual risk.
4. Leave items as pending or failed if evidence is missing.

## Production Readiness Rule

Do not claim that the project is production-ready unless all relevant checks pass:

1. `bun run typecheck`
2. `bun test`
3. Integration tests for critical server flows
4. E2E or documented manual smoke tests for critical browser flows
5. Docker build
6. Production compose validation
7. App startup
8. Worker startup
9. Health and readiness checks
10. Metrics endpoint
11. Clean database migration
12. Seed validation
13. Payment provider production/sandbox validation with real signatures and idempotency
14. Release checklist completed
15. No unsafe production defaults or secrets committed

Passing unit tests alone is not production readiness.

## Operational Standards

Agents must preserve these standards while coding:

1. Make the smallest correct change.
2. Do not introduce new architecture unless required by the specs.
3. Do not bypass security requirements to make tests pass.
4. Do not use mock payment mode as proof of production payment readiness.
5. Do not ignore Docker, migrations, worker, health checks, or observability.
6. Do not update documentation to say something is complete unless it was verified.
7. Do not commit secrets or production credentials.
8. Do not revert unrelated user or agent changes without explicit permission.

## Required Final Report

At the end of a task, report:

1. What changed.
2. Which specs/subspecs were addressed.
3. Which verification commands were run.
4. Which tests passed or failed.
5. Which production/deployment checks passed or failed.
6. What remains incomplete.

If any required verification was not run, state that clearly and explain why.
