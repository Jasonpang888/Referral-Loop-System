---
name: Orval hook params pattern
description: How generated API hooks accept params in this workspace
---

Generated hooks from Orval take `params` as a **positional first argument**, NOT wrapped in `{ params: {...} }`.

**Rule:** `useGetLeads({ stage: "new_lead", page: 1 })` — NOT `useGetLeads({ params: { stage: "new_lead" } })`

**Special cases:** `useGetMe` and `useGetLeadWhatsappMessage` require `queryKey` in their `query` options because the underlying `UseQueryOptions` type marks it required in TanStack Query v5. Use the exported `getGet*QueryKey()` helpers:
- `useGetMe({ query: { queryKey: getGetMeQueryKey(), enabled: !!token } })`
- `useGetLeadWhatsappMessage(id, { query: { queryKey: getGetLeadWhatsappMessageQueryKey(id), enabled: !!id } })`

**Why:** Orval generates hooks where the params object IS the first argument (mapped directly to query string), not wrapped in a `params` property. The `UseQueryOptions` in v5 has `queryKey` as required in the type but the generated `getGet*QueryOptions` already provides a default — the TS compiler still errors without it being explicitly passed.

**How to apply:** Any time you add a new API hook call in the frontend, use positional params. Any time a hook's `query` option errors on missing `queryKey`, import and pass the corresponding `getGet*QueryKey()` helper.
