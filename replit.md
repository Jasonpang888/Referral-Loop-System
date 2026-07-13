# Zhengji Wellness × Kiri Bar Referral Management

Production-ready bilingual (Chinese/English) referral management platform for Zhengji Wellness and Kiri Bar members. Partners share referral links, referred customers sign up, and Zhengji staff tracks the full lead-to-commission lifecycle.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080 → proxied via :80/api)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm run typecheck:libs` — rebuild composite lib declarations (run this after modifying lib/db schema)
- Required env: `DATABASE_URL`, `SESSION_SECRET`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (port 8080, path prefix /api)
- DB: PostgreSQL + Drizzle ORM
- Frontend: React + Vite + TailwindCSS v4 + shadcn/ui (port 21718, preview path /)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Charts: Recharts
- Build: esbuild (CJS bundle)

## Where things live

- `lib/db/src/schema/` — DB schema (users, partners, campaigns, leads, commissions, auditLog)
- `lib/api-spec/openapi.yaml` — API contract (source of truth)
- `lib/api-client-react/src/generated/api.ts` — generated hooks (do not edit manually)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/lib/auth.ts` — token auth, password hashing, audit log helper
- `artifacts/zhengji-referral/src/` — React frontend
- `artifacts/zhengji-referral/src/pages/` — admin/, staff/, partner/, ref/ pages
- `artifacts/zhengji-referral/src/components/Layout.tsx` — role-based sidebar nav

## Architecture decisions

- **Token-based auth** (custom SHA256 signed tokens in localStorage) — simple, no session complexity
- **One-time commission per lead** — `commissionId` on lead acts as the unique guard (check before insert)
- **Flat RM30 XOR Package %** — commission type is mutually exclusive, enforced at payment-verify endpoint
- **Generated API hooks** — all frontend data fetching uses Orval-generated hooks from OpenAPI spec; never call fetch directly
- **`typecheck:libs` before `typecheck`** — after editing `lib/db`, always run `pnpm run typecheck:libs` first so stale `.d.ts` declarations are rebuilt

## Product

- **Public referral landing** (`/ref/:CODE`) — bilingual signup form for referred customers
- **7-stage lead pipeline** — new_lead → appointment_booked → arrived → free_consultation_only → first_paid_treatment → package_purchased → invalid_cancelled
- **Commission workflow** — Pending → Approved → Paid → Disputed (staff approves, admin pays)
- **Role-based portals** — admin (analytics, campaigns, partners, payouts, exports), zhengji_staff (pipeline, commission approval, audit), kiri_partner (overview, leads, commissions, monthly statement)
- **Immutable audit log** — every stage change, commission action, and partner creation is logged
- **CSV exports** — leads and commissions with filters

## Demo Credentials

| Role | Username | Password |
|---|---|---|
| Admin | `admin` | `admin123` |
| Zhengji Staff | `staff` | `staff123` |
| Kiri Partner (Amy) | `kiri_amy` | `partner123` |
| Kiri Partner (James) | `kiri_james` | `partner123` |
| Kiri Partner (Mei) | `kiri_mei` | `partner123` |

Demo referral links: `/ref/KIRIAMY001` · `/ref/KIRIJAM002` · `/ref/KIRIMEI003`

## Gotchas

- After modifying `lib/db` schema files, always run `pnpm run typecheck:libs` before checking api-server or frontend types
- Generated hooks (Orval) take `params` as a **positional first argument** — NOT `{ params: {...} }`. Example: `useGetLeads({ stage: "new_lead" })` not `useGetLeads({ params: { stage: "new_lead" } })`
- `useGetMe` and `useGetLeadWhatsappMessage` require `queryKey` in their `query` options — use the exported `getGet*QueryKey()` helpers
- Seed script lives in `scripts/src/seed.ts` but must be run via api-server (has @workspace/db dep): copy to `artifacts/api-server/src/` and run `pnpm --filter @workspace/api-server exec tsx ./src/seed.ts`
- Do NOT run `pnpm dev` at workspace root — use `restart_workflow` instead

## User preferences

_Populate as preferences are established._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
