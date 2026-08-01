# E2E Test Report — All Flows + All Scenarios

**Date:** 2026-08-01
**Result:** 114 / 114 passed (100%)

## Summary

Ran a complete from-scratch E2E suite against the backend (port 5000) covering all roles and scenarios:
authentication & security, customer flow, worker flow, shop flow, admin flow, chat & disputes,
ratings & reviews, and edge-case error handling.

| Phase | Coverage |
|-------|----------|
| Auth & Security | login (valid/invalid/role-mismatch), tokens, OTP validation, public endpoints |
| Customer | profile, addresses, job creation, shop browsing, cart, wallet, shop orders, notifications |
| Worker | profile, location, online toggle, services, available jobs, quotes, bank, suggestions, withdrawal |
| Shop | profile, products (CRUD), orders, wallet, delivery staff |
| Admin | stats, customers/workers/shops, KYC, orders, jobs, wallets, settings, reports, ledger, payouts, promotions, subscriptions, support chats, health |
| Chat & Disputes | history, send, mark read, open dispute |
| Ratings | rate completed job, invalid rating rejection |
| Edge Cases | 404 routes, malformed JSON, method not allowed, SQL injection, XSS |

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

## Notes

- Test suite script: `e2e_complete_test.js` (run from `/tmp/opencode` with
  `NODE_PATH=/workspace/backend/node_modules`).
- Backend and admin preview verified healthy after restart.
- All changes committed and pushed (`4cb3052`).
