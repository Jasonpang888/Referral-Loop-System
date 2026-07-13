---
name: DB lib rebuild rule
description: When and how to rebuild lib/db declarations after schema changes
---

**Rule:** After editing any file in `lib/db/src/`, always run `pnpm run typecheck:libs` before running typecheck on `api-server` or `zhengji-referral`.

**Why:** `lib/db` is a composite TypeScript library that emits `.d.ts` declarations. Leaf packages (`api-server`, `zhengji-referral`) import from the built declarations, not from source. Stale declarations cause "Module has no exported member" errors (TS2305) that look like import bugs but are actually a stale build artifact issue.

**How to apply:** The workflow is always: `pnpm run typecheck:libs` → then `pnpm run typecheck`. Never skip the libs rebuild step when schema has changed.
