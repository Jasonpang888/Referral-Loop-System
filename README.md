# Bijak Partner Growth Platform

Production-ready referral-to-payout platform for multi-brand partner campaigns. The current demo is seeded for Zhengji Wellness, Super Star Durian, and Kiri Bar partner attribution.

## What Is Included

- Multi-role app: Super Admin, Brand Admin, Outlet Staff, Finance, Partner Admin, Partner Staff.
- Referral registration with consent, WhatsApp, membership ID, offer, appointment intent, duplicate checks, and referral attribution.
- Lead pipeline from new lead through contact, arrival, free consultation, first paid treatment, package purchase, repeat customer, invalid, and cancelled outcomes.
- Commission rules: first paid treatment creates one RM30 reward, free consultations and repeats create RM0, and package percentage commission replaces RM30.
- Partner dashboards, finance payout actions, audit log, CSV exports, analytics, WhatsApp-ready messages, and bilingual UI surfaces.

## Run Locally

```powershell
pnpm install --ignore-scripts
pnpm run typecheck
pnpm run test
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/zhengji-referral run dev
```

Required environment is documented in `.env.example`. A PostgreSQL `DATABASE_URL` is required for the API server and seed script.

## Demo Accounts

| Role | Username | Password |
|---|---|---|
| Super Admin | `admin` | `admin123` |
| Brand Admin | `brand_admin` | `brand123` |
| Outlet Staff | `staff` | `staff123` |
| Finance | `finance` | `finance123` |
| Partner Admin | `kiri_amy` | `partner123` |
| Partner Staff | `partner_staff` | `partner123` |

Referral links: `/ref/KIRIAMY001`, `/ref/KIRIJAM002`, `/ref/KIRIMEI003`.

## Validation

The automated referral-flow test covers the mandatory reward, duplicate, partner isolation, payout, audit, CSV, and language-switching rules:

```powershell
pnpm run test
pnpm run typecheck
pnpm run build
```

See `docs/testing.md` and `docs/deployment.md` for operational detail.
