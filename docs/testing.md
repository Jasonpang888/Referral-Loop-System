# Test Guide

## Automated Checks

```powershell
pnpm run typecheck
pnpm run test
pnpm run build
```

`pnpm run test` executes `artifacts/api-server/src/referralRules.test.ts`, covering:

- first paid treatment creates exactly one RM30 commission
- free consultation creates no commission
- repeat customer cannot create a second RM30 reward
- package percentage replaces RM30
- duplicate mobile and membership IDs are normalized
- partner role isolation
- finance payout authorization
- audit payload completeness
- CSV export formatting
- language-label availability

## Manual Referral-To-Payout Smoke Test

1. Seed demo data after configuring `DATABASE_URL`.
2. Open `/ref/KIRIAMY001` and register a new customer with consent.
3. Log in as `staff` and move the lead through contacted, appointment booked, and arrived.
4. Verify a first paid treatment. Confirm one pending RM30 commission.
5. Try verifying the same lead again. Confirm the API returns conflict.
6. Register another lead and mark free consultation only. Confirm no commission is created.
7. Register a package purchase with an 8%-10% commission rate. Confirm no RM30 commission is created.
8. Log in as `finance`, pay an approved commission, and confirm payout reference/proof plus audit history.
9. Log in as a partner account and confirm only that partner's leads and commissions are visible.
10. Export leads and commissions CSVs from the admin export page.
