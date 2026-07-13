# Kiri x Zhengji Wellness Launch Runbook

Target launch: Kiri Bar partner referrals for Zhengji Wellness / 正脊堂.

## Required Production Environment

Set these on the production API host:

- `DATABASE_URL`
- `NODE_ENV=production`
- `SESSION_SECRET` with at least 32 unique characters
- `PASSWORD_SALT`, kept stable after first user creation
- `CORS_ORIGIN`, the final frontend HTTPS origin
- `PORT`, if the host requires it

Set this on the frontend host:

- `VITE_API_BASE_URL`, for example `https://api.example.com/api`

## Database Preparation

After migrations are applied, run:

```powershell
pnpm run prepare:kiri-zhengji-live
```

This creates or repairs:

- Zhengji Wellness / 正脊堂 brand record
- Kiri Bar x Zhengji Wellness Q3 2026 active campaign
- Super Admin, Brand Admin, Outlet Staff, Finance, and Kiri partner users
- Kiri partner referral codes: `KIRIAMY001`, `KIRIJAM002`, `KIRIMEI003`
- Brand/campaign backfill for Kiri leads, commissions, payout batches, and audit rows

Existing passwords are not reset by default. To reset launch demo passwords intentionally:

```powershell
$env:RESET_LAUNCH_PASSWORDS="true"; pnpm run prepare:kiri-zhengji-live
```

## Login Accounts

| Portal | Username | Default password | Purpose |
|---|---|---|---|
| Super Admin | `admin` | `admin123` | Global oversight |
| Brand Admin | `brand_admin` | `brand123` | Zhengji campaign, partners, leads, reports |
| Outlet Staff | `staff` | `staff123` | Lead pipeline and payment verification |
| Finance | `finance` | `finance123` | Payouts, exports, audit |
| Partner Admin | `kiri_amy` | `partner123` | Kiri partner dashboard |
| Partner Admin | `kiri_james` | `partner123` | Kiri partner dashboard |
| Partner Admin | `kiri_mei` | `partner123` | Kiri partner dashboard |

Change production passwords after first login.

## Public Links

- Customer referral page: `/ref/KIRIAMY001`
- Customer referral page: `/ref/KIRIJAM002`
- Customer referral page: `/ref/KIRIMEI003`
- Portal login: `/login`

Generate QR/NFC assets only after the final HTTPS frontend URL is confirmed. Encode the exact public referral URL, for example:

```text
https://final-domain.example/ref/KIRIAMY001
```

## Launch QA

Run the full checks before launch:

```powershell
pnpm run typecheck
pnpm run test
pnpm run build
```

Then test this live flow:

1. Open `/ref/KIRIAMY001` and submit a new customer lead.
2. Confirm duplicate mobile or Kiri membership ID is blocked.
3. Login as `staff`, move the lead through contacted, appointment booked, arrived.
4. Verify first paid treatment and confirm one pending commission is created.
5. Confirm a second commission for the same lead is blocked.
6. Approve the commission from the staff/admin commission screen.
7. Login as `finance`, pay the approved commission individually or as a partner batch.
8. Login as `kiri_amy`, confirm the paid commission appears in dashboard, commissions, and statement.
9. Login as `brand_admin`, confirm only Zhengji brand data is visible.
10. Export leads and commissions CSV for the launch day.

The same flow can be checked by script against the configured API:

```powershell
$env:API_BASE_URL="https://api.example.com/api"; pnpm run smoke:kiri-zhengji-flow
```

The script creates one timestamped smoke-test lead and pays one smoke-test commission.

## Go/No-Go

Go when all are true:

- HTTPS frontend and API are reachable.
- CORS allows the frontend origin and blocks unrelated origins.
- `prepare:kiri-zhengji-live` completed against production database.
- Staff, Finance, Brand Admin, and one Kiri partner login work.
- One test referral reaches paid commission status.
- QR/NFC target URL has been tested on at least two phones.
