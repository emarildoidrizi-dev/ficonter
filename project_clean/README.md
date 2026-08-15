# FICONTER

**A private financial-management and decision platform.**

FICONTER helps customers record, understand, plan and improve their financial position. It does not hold, move, lend or invest customer money.

## Release status

This repository is **FICONTER Release Candidate 1**. It consolidates the latest complete project with the accepted performance, precision and Realtime TypeScript hardening work.

## Main capabilities

- Transactions with multicurrency EUR normalization
- Bills with paid/unpaid synchronization
- Monthly Planner and Recorded Activity views
- Debt, Goals, Savings and Emergency Fund tracking
- Net Worth and Financial Independence
- Financial Health Score, Wealth Score and Smart Insights
- Financial GPS and guided financial setup
- Financial File Import
- Customer support messaging and Document Vault
- Privacy-safe administration
- Premium themes and real photographic scene wallpapers
- CSV, JSON and PDF account exports

## Technology

- Next.js 16
- React 19
- TypeScript
- Supabase Auth, PostgreSQL, Realtime and Storage
- Vercel

## Local setup

```bash
npm install
npm run dev
```

Required environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SUPABASE_SERVICE_ROLE_KEY=server-only-service-role-key
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` through a `NEXT_PUBLIC_` variable.

## Verification

```bash
npm run verify:release-candidate
npm run lint
npm run build
```

The repository contains 31 project-specific verification suites. Vercel's production build remains the authoritative dependency and framework compilation check.

## Database

No new SQL migration was created specifically for consolidation. The deployed Supabase project must already include the migrations in `supabase/`, especially:

- `phase1_qa_finalization.sql`
- `bill_paid_unpaid_reversal.sql`
- `debt_transaction_bidirectional_sync.sql`
- Phase 2 aggregate migrations
- Support and Document Vault migrations

## Deployment

See `DEPLOYMENT_STEPS.md` and `CONSOLIDATION_REPORT.md`.
