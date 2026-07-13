# Deployment Guide

## Required Services

- PostgreSQL database, preferably Supabase Postgres.
- Object storage buckets for payment receipts and payout proofs.
- A hosting target for the API server and Vite frontend, such as Vercel or Cloudflare Pages plus a Node API host.

## Environment

Copy `.env.example` and fill:

- `DATABASE_URL`
- `SESSION_SECRET`
- `PORT`
- `VITE_API_BASE_URL`
- Supabase values if using Supabase storage or managed Postgres.

## Database

Apply Drizzle schema changes with:

```powershell
pnpm --filter @workspace/db run push
```

For Supabase-first environments, review and apply `supabase/migrations/0001_bpgp_core.sql` in the Supabase SQL editor or migration pipeline. It includes the expected uniqueness constraints and RLS posture.

## Build

```powershell
pnpm install --ignore-scripts
pnpm run typecheck
pnpm run test
pnpm run build
```

## External Account Requirements

Supabase Auth and Storage credentials are not committed. Production deployments must configure secrets in the hosting provider and create storage buckets for receipts and payout proofs.
