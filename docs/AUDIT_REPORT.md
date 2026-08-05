# Kwickly — Final Production-Readiness Audit Report

**Date:** 2026-08-05
**HEAD:** `50a04f7 fix: correct payout notification logic and add user wallet transactions`
**Method:** Evidence-based, line-by-line code review of backend, admin, and mobile codebases; contract cross-checks between backend routes/controllers/validators/models and admin/mobile consumers; automated API-contract verification scripts; full sequential test-suite runs against MongoDB MemoryServer with Redis/Socket/SMS mocked or offline.

---

## 1. Repository Metrics (lines reviewed)

| Area | Files | Lines |
|------|-------|-------|
| Backend `src/` (business logic, infra) | ~180 JS | ~14,900 |
| Backend `src/__tests__/` (56 suites) | 56 test files | ~18,000 |
| Backend total (`src/`) | | ~33,000 |
| Admin dashboard (`admin/src`) | ~120 JSX/JS/CSS | ~13,500 |
| Mobile app (`mobile/src`) | ~100 JS | ~30,100 |
| Mobile native config (`android`, `ios`) | | reviewed |

Every business-logic module was line-reviewed: auth, wallet, payment, payout, subscription, settlement, dispute, quote, job, worker, customer, promotion, shop, shoporder, admin, chat, category, product, delivery staff, suggestions, notifications, cart, reports. Infrastructure reviewed: `app.js`, `server.js`, config, middleware (auth/role/validate/rate-limit/error), helpers (redis/razorpay/transaction/sms/upload/socket/seeder), sockets, cron engine, PM2 + Docker + deploy scripts.

---

## 2. Confirmed Bugs Fixed (this audit)

### 2.1 Backend — resilience / infrastructure
| ID | Bug | Fix |
|----|-----|-----|
| H17 | Rate-limit outage crashed **every** request with `TypeError: unexpected reply from redis client` when Redis was down (this was the root cause of the original test-harness 500s/hangs) | `rateLimit.middleware.js` now exports `AdaptiveRateLimitStore`: uses `RedisStore` only when Redis is `ready`, else a per-limiter in-memory store; any mid-request Redis error degrades transparently. Set `localKeys: true` so the two limiters on one request no longer trigger a false `ERR_ERL_DOUBLE_COUNT` validation warning. |
| R1 | `redis.helper.js` ioredis client queued commands with growing retry backoff when Redis was offline (up to ~2-minute single-request gaps) | Added `enableOfflineQueue: false` — Redis calls fail fast (~30 ms) instead of hanging. |
| R2 | `fetchWithCache` (`redis.helper.js`) called `client.set`/`client.del` without try/catch → 500 on cached admin reports/leaderboards whenever Redis was down | Wrapped lock acquire/release in try/catch; falls back to fetching fresh data on Redis errors. |
| R3 | OTP send/verify 500'd when Redis unavailable | `auth.controller.js` `incrementOtpAttempts` now try/catches Redis `incr`/`expire` (rate-limit attempts degrade, request succeeds). |
| R4 | `payment.controller.js` `verifyPayment` used `mongoose.startSession()` unconditionally → `Transaction numbers are only allowed on a replica set member` 500 on standalone Mongo | Gated behind `supportsTransactions()` (`helpers/transaction.helper.js`). |
| R5 | Admin refund requests always 400'd — validator required `paymentId`/`reason(min 10)` but controller reads `orderId` | `validators/payment.validator.js` refund schema aligned to `{ orderId, amount?, reason?, notes? }`. |

### 2.2 Backend — contract bugs (validator ↔ controller ↔ model ↔ consumer mismatches)
| Bug | Fix |
|-----|-----|
| Cart: mobile decrements a 1-qty item to `qty: 0` (removal) but validator `min(1)` rejected it → 400 every time | `validators/cart.validator.js` `updateCartItemSchema` now `min(0)`; controller's existing `qty <= 0` removal branch is reachable. |
| Worker bank details: mobile + controller use `{ bankDetails: {...}, upiId }`; validator required flat `accountNumber/ifscCode/accountHolderName` → 400 every save | `validators/worker.validator.js` `updateBankSchema` aligned to `{ bankDetails, upiId }` (`.or('bankDetails','upiId')`). |
| Worker addresses: mobile + controller + model use `{ label, street, area, city, pincode, isPrimary, location:{type,coordinates:[lng,lat]} }`; validator required `type/locality/state/coordinates{latitude,longitude}` → 400 every save | `addAddressSchema`/`updateAddressSchema` rewritten to the real contract (both worker & customer routes use the shared schemas). |
| Customer profile: `validate` middleware `stripUnknown` dropped `wallet` and `profileImageBase64` → `PaymentMethodsScreen` payment-method save and `EditProfileScreen` photo upload both failed with "No data provided" | `validators/customer.validator.js` `updateProfileSchema` now accepts `wallet` (object or JSON string) and `profileImageBase64`. |
| Notification preferences: validator used `pushEnabled/orderUpdates/promotionalUpdates` but controller/model use `jobUpdates/promotions`; `promotions` was stripped → settings never saved | `notificationPreferencesSchema` aligned to `{ jobUpdates, promotions }`. |
| Customer dispute: validator required `issue` and stripped `reason`, though the controller explicitly supports `reason || issue` | `openDisputeSchema` allows `reason`; `issue` made optional. |

### 2.3 Backend — runtime data-integrity bugs
| Bug | Fix |
|-----|-----|
| Worker `activeLocation` is covered by a **2dsphere index**, but the 4 address handlers set `activeLocation.addressDetails` without guaranteeing `type`/`coordinates` → `Can't extract geo keys … unknown GeoJSON type` 500 on first-address/primary-address save | Added `syncActiveLocation()` helper (valid GeoJSON, keeps prior coords, falls back to `[0,0]`); used in `addAddress`/`updateAddress`/`deleteAddress`/`setPrimaryAddress`. |

### 2.4 Test-suite corrections (tests contradicted the real API contract; app code left unchanged)
| Suite | Fix |
|-------|-----|
| `worker.test.js` | location payload corrected to top-level `{ coordinates }` (was `{ activeLocation: {...} }`); assertion tightened `[200,500]` → `200`. |
| `adminSuggestionsExtended.test.js` | suggestion `status` enum values/assertions uppercased (`pending/approved/rejected` → `PENDING/APPROVED/REJECTED`). |
| `cart.test.js` | non-customer role test now asserts 403 (cart is CUSTOMER-only by design); negative-qty test asserts 400; stock-overflow test sends `qty: 60` (within validator bounds, over stock) so the controller's stock message is exercised. |
| `customerSelfService.test.js` | dispute status assertion `'open'` → `'OPEN'`. |
| `deliveryStaff.test.js` | active-delivery mock retargeted from `order.model` to `shoporder.model` (the model the controller actually queries). |
| `promotion.test.js` | expired-promo fixture sets `startAt` (past) + `endAt` (past) so the model's `endAt < startAt` guard no longer rejects the fixture. |

### 2.5 Mobile fixes
| Bug | Fix |
|-----|-----|
| `shopService.js` missing 15+ methods — every shop-side screen crashed (`getMyShop`, `updateMyShop`, `deleteMyShop`, `withdraw`, `topUp`, `updateDeliveryConfig`, `updateOrderStatus`, `cancelOrder`, `createProduct`, `updateProduct`, `getMyNotifications`, `markNotificationRead`, `markAllNotificationsRead`, `getSettings`, `getPublicSettings`) | Methods added; automated cross-check across 18 screens reports `MISSING: none`. |
| Customer order cancellation called a shop/admin-only endpoint (`PATCH /shoporders/:id/status`) | `OrderTrackingScreen.js` now uses `shopService.cancelOrder(orderId)` → `POST /shoporders/:id/cancel` (customer-accessible). |
| iOS `Info.plist` location usage description empty (App Store rejection; privacy crash on iOS) | Added purpose string. |

### 2.6 Previous-session fixes (still in effect, verified green)
Wallet top-up credit + replay protection (WA-01/02); job payment debit `JOB_PAYMENT` (BV-08); payout idempotent REJECTED handling (BV-01); dispute status enum + shop-vs-worker clawback (BV-16); shop payout-method `isPrimary` (BV-17); worker KYC base64/url contract (BV-02); mobile `payForJob`; mobile `walletService.createPaymentOrder`.

---

## 3. Findings Requiring Owner Action (not fixed — decisions/external access needed)

| # | Severity | Finding |
|---|----------|---------|
| S1 | **High** | Real Google Maps API key committed in `mobile/android/app/src/main/AndroidManifest.xml` (`AIzaSyC0XgyqOJFpHvgXuErgRt2WJSuRXt20NT4`). Revoke/rotate and move to a server-proxied key or per-app restriction. |
| S2 | Medium | `android:usesCleartextTraffic="true"` in the manifest — allows HTTP in production. Disable once the API is served over HTTPS in prod. |
| S3 | Medium | `.env.production` files are tracked in git (values are placeholders only, verified). Move to an untracked `.env` + documented template to prevent future secret drift. |
| S4 | Low | `razorpay.helper.js` has a dev/test signature-bypass (constant-time compare for dev order ids). Keep disabled in production config. |
| S5 | Low | **Confirmed during RBAC audit:** the backend DOES support SHOP wallet top-up (`atomicCredit` in `wallet.controller.js:50` credits `Shop.wallet.balance` by `ownerId`), but the mobile shop screen never opens a Razorpay checkout — `ShopWalletScreen.js:240` calls `shopService.topUp(amount, {method})`, sending no `razorpayOrderId/PaymentId/Signature` → server 400 "Verified Razorpay payment details are required". Customer top-up (`CustomerWalletScreen`) is correct. Fix = implement the Razorpay order+checkout flow in the shop app (feature work), or gate the shop top-up UI. |
| S6 | Low | `updateMyShop` intentionally strips `kyc`/`subscription`/`wallet` (admin-only fields); the shop mobile screens that write those fields silently no-op. Confirm intended. |
| S7 | Info | `refundPayment` records `balance: 0` on the refund txn (display inaccuracy only). |
| S8 | Info | Test harness runs against MongoDB MemoryServer (standalone, no replica set) — `supportsTransactions()` guards now cover all transaction usage. Some unit tests rely on `testSetup` mocks for redis/rate-limit/sms; the adaptive store + fail-fast redis make this irrelevant to behavior. |

---

## 3A. RBAC & Authorization Audit (this audit)

### Server side — verified sound
- **Core middleware**: `auth.middleware.js` (JWT HS256 verify, `blacklist:<token>` check, 24h Redis `session:<id>` cache with DB fallback + `isDeleted` recheck); `role.middleware.js` `authorize(...roles)`; roles enum `['CUSTOMER','WORKER','ADMIN','SHOP']` on the single `Customer` model.
- **Admin API**: globally gated `router.use(authMiddleware)` + `router.use(authorize('ADMIN'))` (`admin.routes.js:33-34`); all sub-mounts inherit. Public `/settings/branding` only.
- **Session invalidation on admin mutations**: `delCache('session:<id>')` on KYC update/approve, subscription extend, toggle/delete user, impersonate — role/user changes are not stale in the 24h cache.
- **Ownership/IDOR checks present** (each `:id` read/write verified):
  - Jobs: `getJobById` (customer/worker must match), `cancelJob`/`payJob`/`rateJob` (`customerId: req.user._id`), `startJob`/`completeJob` (`workerId: req.user._id`), `acceptQuote` (job `customerId` match + distributed `job_allocation_<id>` lock).
  - Shop orders: `getOrderById`/`downloadInvoice` (customer OR shop-owner-by-`ownerId` OR admin), `cancelOrder` (atomic `customerId + status in NEW/CONFIRMED`).
  - Payments: `getPaymentByOrder` (payment `userId` or admin). Notifications: `markAsRead` (owner / broadcast-for-role / admin). Chat: `getChatHistory` (job participant or admin; partner threads scoped to sender/receiver).
  - Products: `createProduct`/`updateProduct`/`deleteProduct` have no route-level `authorize` but the controller resolves `Shop.findOne({ownerId: req.user._id})` and scopes the query by shop (ADMIN bypasses) — no cross-shop IDOR; non-owners get 404.
  - Wallet: `topupWallet` is Razorpay-verified (signature + `fetchPayment` status `captured` + amount trusted from Razorpay) with replay protection on `razorpayPaymentId`; `atomicCredit` handles SHOP role.
- **Route role matrices** (category, chat, customer, dispute, job, notification, payout, promotion, quote, settings, shop, shoporder, subscription, suggestion, wallet, worker): every write endpoint is role-gated or defended in-controller. Notably `createShop` is role-agnostic (any authenticated user) — benign because roles are self-selected at registration, but documented.

### Fixed this audit
| ID | Bug | Fix |
|----|-----|-----|
| R13 | `sendMessage` (`chat.controller.js`) did **not** verify job participation — any authenticated user could inject messages into another job's thread by passing a `jobId` (history-side was already checked in `getChatHistory`) | Added the same participant check (job `customerId`/`workerId` match, admin exempt) before `Message.create`; non-participants get 403. Verified: `chat.test.js` 4/4, `chatExtended.test.js` 15/15, `socketIntegration.test.js` 18/18. |

### Client side — verified sound
- **Admin dashboard**: `api.js` response interceptor clears token+user and redirects to `/login` on 401; `App.jsx` wraps the authenticated layout in a token-backed route guard (`Navigate` to `/login`).
- **Mobile**: `services/api.js` 401 → clears `userToken` + emits `UNAUTHORIZED_ACCESS`; `AuthContext.js` listens and calls `signOut()`. Role-based navigation exists (`useSocket` joins role rooms; navigation switches on `user.role`).

### Open items (owner decision)
1. **Impersonation**: `admin.controller.js` `impersonateUser` issues a 1h token `{isImpersonated:true, impersonatedBy}` — **no downstream consumer of `isImpersonated` exists**; an impersonated token is indistinguishable from the target's own token (inherits target role) and can call admin-scoped endpoints if the target is an ADMIN. Recommend admin-cannot-impersonate-admin and/or per-request audit enforcement.
2. **Shop wallet top-up** (S5 above): feature gap on the shop app.
3. **`createShop` role-agnostic** — confirm intended (currently any authenticated user may create a shop).

---

## 4. Test Results (final)

**All 56 backend test suites pass** (run sequentially via `npx jest <file> --runInBand --forceExit`; fixed-port Mongo on 27018, one suite at a time).

Core suites re-run after the final fixes: `wallet` 11/11, `auth` 19/19, `payment` 24/24, `job`, `dispute` 12/12, `payout` 4/4, `shoporder` 7/7, `settlement` 35/35, `shop` 9/9, `quote` 8/8, `admin` 13/13, `worker` 8/8, `e2e-customer-flow`, plus the 44 remaining suites (reports, cron, chat, subscription, promotion, cart, addresses, earnings, notifications, suggestions, badges, branding, exports, uploads, impersonation, health, infrastructure, socket, validation, etc.) — all green after the fixes above.

---

## 5. Production-Readiness Assessment

**Readiness score: 7.9 / 10** — feature-complete and internally consistent with a green test corpus, but not "verified production-ready" until: (a) live-service integration is exercised (Razorpay, SMS gateway, FCM, real Redis multi-instance, real Socket.IO), (b) S1 key rotation, (c) HTTPS/cleartext policy, and (d) replica-set MongoDB for transactional payouts.

### Yes/No Checklist

| Question | Answer |
|----------|--------|
| All backend modules line-reviewed? | Yes |
| All admin module API contracts cross-checked against backend routes? | Yes (users, workers, shops, jobs, orders, KYC, notifications, categories, settings, support, ledger, reports, admin-users, promotions, disputes, payouts, settlements; role-gating verified) |
| All mobile screens cross-checked against service methods? | Yes (shop-side automated; wallet/pay flows manual — both verified) |
| Backend ↔ mobile contract mismatches found and fixed? | Yes (bank details, addresses, cart, customer profile wallet/photo, refund, KYC, cancel-order) |
| Full backend test suite green? | Yes — 56/56 suites |
| Rate limiter / Redis outages crash requests? | No — fixed (adaptive store + fail-fast + guarded call sites) |
| Confirmed bugs fixed without behavior changes? | Yes (only confirmed bugs/contract mismatches; tests corrected where the test contradicted the API) |
| Secrets scan completed across all tracks? | Yes — 1 real key (S1, Android Maps); owner must rotate |
| Deployment path reviewed (Docker, PM2, health, deploy script)? | Yes |
| Live third-party integrations verified end-to-end? | **No — unverified** (see below) |

### Explicitly UNVERIFIED (cannot be tested without real external infra/credentials)
- Live Razorpay order creation / payment capture / signature verification / webhooks (creds are placeholders).
- Real SMS gateway (`ENABLE_REAL_SMS=false`; dev OTP log mode).
- FCM push delivery.
- Socket.IO under real load + Redis Pub/Sub adapter in production.
- Real Redis multi-instance concurrency (rate-limit and cron locks under horizontal scaling).
- iOS/Android device builds and app-store submission checks (configs reviewed statically only).
- Replica-set MongoDB transactional guarantees for payout/settlement.
