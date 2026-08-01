# E2E Test Report — All Flows + All Scenarios

**Date:** 2026-08-01
**Result:** All suites pass 100% on a freshly re-seeded DB

## Test Suites

| Suite | Scope | Result |
|-------|-------|--------|
| `e2e_complete_test.js` | Endpoint-level coverage for all roles + edge cases | **115 / 115** |
| `flow_test.js` | Full job lifecycle (create → quote → accept → start → complete → pay → rate) + shop order lifecycle + admin | **24 / 24** |
| `adv_flow_test.js` | Subscription, withdrawal → payout → admin approval/rejection, dispute raise → refund, settlement settle, negative job guards | **29 / 29** |

## Summary

Ran three from-scratch suites against the backend (port 5000) on a freshly re-seeded DB
(`FORCE_SEED=true`), covering complete business flows plus endpoint-level edge cases:

- **Job lifecycle:** customer creates job → worker sets services/location/goes online → job in
  `/jobs/available` → worker places quote → customer views quotes → accepts → job `ALLOCATED` →
  worker reads arrival/completion OTPs → `IN_PROGRESS` → `COMPLETED` → customer pays via wallet →
  `PAID` → rates worker → worker earnings updated.
- **Shop order lifecycle:** cart → order (wallet) → `NEW → CONFIRMED → PACKING → OUT_FOR_DELIVERY →
  DELIVERED` (delivery OTP enforced) → pending settlement created → admin settles → shop wallet
  credited → double-settle rejected.
- **Dispute flow:** raise dispute → duplicate rejected (409) → admin lists → resolve + refund →
  customer wallet credited (REFUND txn).
- **Payout flow:** worker withdraws (wallet deducted) → admin sees pending → approves
  (`TRANSFERRED`) → rejected payout refunds wallet.
- **Negative guards:** wrong arrival OTP (400), far coordinates rejected (400/403), complete without
  `IN_PROGRESS` (400), pay/rate before `COMPLETED` (400), role mismatches (403), duplicate quote
  (409), self-subscribe without Razorpay payment (400).

## Bugs Found & Fixed

1. **Address validators mismatched API contract** — `customer.validator.js` / `worker.validator.js`
   required `type`/`locality`/`state`/`coordinates{lat,lng}` while the controller and mobile app
   send `label`/`street`/`city`/`pincode`/`location{coordinates:[lng,lat]}`. Valid requests were
   rejected with 400.
2. **Worker location validator mismatched controller** — schema expected `coordinates{lat,lng}` +
   `address`; controller reads `coordinates:[lng,lat]` + `city`/`area`/`radius`. Fixed.
3. **Worker services validator mismatched model** — schema expected `categoryId`/`subcategoryId`/
   `minPrice`/`maxPrice`; model + mobile use `category`/`subcategories`/`isActive`. Workers could
   never become available for jobs.
4. **Cart validator mismatched controller/mobile** — expected `quantity`/`name`/`price`; actual
   contract is `{ shopId, productId, qty }`. Fixed to `qty`.
5. **Dispute creation failed when `reason` missing** — controller now falls back to `issue`.
6. **Chat accepted empty messages** — now rejects empty text with no media (400).
7. **Rating accepted invalid scores** — now requires an integer 1–5 (400).
8. **Seeder dispute seed broken** — invalid `status: 'open'` + missing `reason` aborted seeding;
   fixed, and added `FORCE_SEED=true` env flag to allow re-seeding without dropping the DB.
9. **Payout success notification bug** — `updatePayoutStatus` success message branch checked
   `'COMPLETED'`, which is not in the payout status enum (`PENDING/APPROVED/TRANSFERRED/REJECTED`),
   so every non-rejected payout sent the user the "was rejected / amount refunded" message. Now
   checks `'REJECTED'` for the rejection branch.
10. **Customers could not view their own wallet transactions** — `/wallet/transactions` was
    admin-only and there was no user-facing equivalent. Added `GET /wallet/my-transactions`
    (any authenticated user) alongside the admin endpoint.

## Flow Notes (test-side)

- Shop order transitions require the **order to belong to the logged-in shop user**; tests use
  `GET /shops/my` to target the shop-owner's own shop instead of assuming `shops[0]` from the
  customer-facing list (which sorts newest-first).
- Worker must have at least one **active service category** and be within geo-radius for
  `/jobs/available`; tests set services/location/online explicitly.
- Order DELIVERED requires the **delivery OTP** generated at order creation.
- Each suite should run on a freshly re-seeded DB (`MONGO_URI=...kwickly_test FORCE_SEED=true
  node src/server.js`) to avoid state accumulation (5-ongoing-jobs limit, OTP rate limiter, cart).

## Notes

- Test suite scripts: `e2e_complete_test.js`, `flow_test.js`, `adv_flow_test.js` (run from
  `/tmp/opencode` with `NODE_PATH=/workspace/backend/node_modules`).
- Backend and admin preview verified healthy after restart.
