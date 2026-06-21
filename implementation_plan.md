# Kwickly Platform — Production Readiness Audit & Hardening Plan

## Executive Summary

After a deep review of every layer of the platform — backend controllers, models, middleware, socket handlers, Redis usage, mobile screens, and navigation — I have identified **critical security vulnerabilities**, **race conditions in financial operations**, **loopholes in authentication**, **missing admin functionality**, **Redis underutilization**, and **database schema normalization issues**.

This plan is organized in 3 priority tiers:
- **P0 – Critical (Security / Data Integrity)**: Must fix before any real users.
- **P1 – High Priority (Functional Completeness)**: Missing flows, admin blind spots.
- **P2 – Optimization (Scalability to 50k+ users)**: Redis, indexes, cleanup.

---

## P0 — CRITICAL: Security & Data Integrity

> [!CAUTION]
> These are production blockers. A real user could exploit these to steal funds, bypass authentication, or corrupt data.

### Issue 1: OTP Brute-Force / Race Condition
- **Problem**: The `sendOTP` endpoint has no rate limiting. An attacker can call it 1000 times per second, brute-force a 4-digit OTP (10,000 combinations), and take over any account.
- **Fix**: Add per-phone rate limiting via Redis. Track `otp_attempts:{phone}` counter with a 1-hour TTL. Block after 5 failed attempts.

### Issue 2: JWT Secret Hardcoded Fallback
- **Problem**: `auth.controller.js` has `process.env.JWT_SECRET || 'kwickly_secret_key'`. If `JWT_SECRET` is missing from `.env`, the fallback `'kwickly_secret_key'` is used — a completely known, public string, making ALL tokens forgeable.
- **Fix**: Remove the fallback. Throw a fatal startup error if `JWT_SECRET` is not set.

### Issue 3: Auth Middleware Hits DB on Every Request — No Token Blacklisting
- **Problem**: Every single authenticated API call does a full `Customer.findById()` database query. At 50k users, this is catastrophic. Also, there is no way to invalidate tokens (e.g., on logout or account ban).
- **Fix**: Implement a **Redis-cached session** pattern. Cache user data in Redis with TTL matching the JWT expiry. Auth middleware checks Redis first, falling back to DB only on cache miss.

### Issue 4: Financial Race Condition — No Atomic Wallet Operations
- **Problem**: In `wallet.controller.js`, wallet deductions are done with `findById` + `findByIdAndUpdate` in two separate operations. If two requests come in simultaneously (e.g., two parallel withdrawal requests), both could read the same balance, both pass the "sufficient funds" check, and both deduct — resulting in a negative balance.
- **Fix**: Use MongoDB's `$inc` operator with a conditional query (`findOneAndUpdate` with a `$gte` balance filter) to make the check-and-deduct atomic.

### Issue 5: Stock Race Condition on Shop Orders
- **Problem**: In `shoporder.controller.js`, stock is checked at `placeOrder` time but is not reserved atomically. Two customers could simultaneously order the last item — both orders are created, but stock goes to -1.
- **Fix**: Use atomic `$inc: { stock: -qty }` combined with a `stock: { $gte: qty }` condition at the time of order placement, not only at delivery.

### Issue 6: Admin Panel Exposes Internal Data via Static `connectedClients`
- **Problem**: `admin.controller.js` `getPlatformHealth` returns `Math.floor(Math.random() * 50) + 10` as the socket count. This is fake data that serves no purpose and misleads admins.
- **Fix**: Return the real Socket.io `io.engine.clientsCount`.

### Issue 7: Concurrent Quote Acceptance — No Locking
- **Problem**: If a customer double-taps "Accept" and two simultaneous requests hit `acceptQuote`, the job could end up with two workers assigned.
- **Fix**: Use `findOneAndUpdate` with a status guard (`status: { $in: ['BROADCASTING', 'QUOTES_RECEIVED'] }`) as an atomic operation.

---

## P1 — HIGH PRIORITY: Functional Completeness & Loopholes

> [!IMPORTANT]
> These are missing flows that break the platform's completeness promise.

### Issue 8: No Input Rate Limiting on Any Endpoint
- **Problem**: No `express-rate-limit` middleware. Any endpoint can be DDoS'd or brute-forced.
- **Fix**: Add global rate limiter (100 req/15 min per IP) + strict limiter (5 req/15 min) for auth endpoints.

### Issue 9: CORS is `origin: '*'` — Completely Open
- **Problem**: Both `app.js` and `socket.helper.js` use `origin: '*'`. This allows any website to make authenticated requests using stolen tokens.
- **Fix**: Restrict CORS to production domains (admin panel URL, mobile app deeplink scheme).

### Issue 10: `verifyOTP` Silently Changes User Role — Critical Loophole
- **Problem**: In `auth.controller.js`, if a user signs in as `CUSTOMER` first, then tries to sign in as `WORKER` on the same phone, the system **silently updates their role to `WORKER`**. A customer can accidentally become a shop owner by choosing the wrong role.
- **Fix**: Remove the role-change logic. Each phone can have multiple accounts of different roles (already indexed as `{phone, role}` unique pair). Create a new account if the role doesn't exist.

### Issue 11: Worker can Quote on Own Job (No Self-Quote Guard)
- **Problem**: If a worker is somehow also a customer (same phone, different role), or if the guard is not enforced, a worker could quote on a job they created.
- **Fix**: Add a check in `placeQuote` to verify `quote.workerId !== job.customerId`.

### Issue 12: Admin Cannot View Shop Orders or Shops
- **Problem**: The admin routes only cover jobs, workers, customers. There is **no admin endpoint for shop management** (view shops, approve shop KYC, view all shop orders, disable a shop).
- **Fix**: Add admin sub-routes for shop management: list all shops, update shop KYC status, view all orders per shop.

### Issue 13: Admin Ledger Uses Legacy `Transaction` Model
- **Problem**: `admin.controller.js` `getLedger` uses the old `Transaction` model. The platform has migrated to `WalletTxn`. The ledger shows empty or wrong data.
- **Fix**: Rewrite `getLedger` to use `WalletTxn` with proper population.

### Issue 14: `eligible_workers_pool` Cache Ignores Location
- **Problem**: `job.controller.js` caches all eligible workers globally for 5 minutes. But when a job is created in Chennai, workers in Delhi get alerted. This is a massive loophole — irrelevant notifications pollute every worker's dashboard.
- **Fix**: Remove the global cache. Instead, use a geospatial query (`$nearSphere`) to find workers within the job's radius. Cache the result per job, not globally.

### Issue 15: `admin_customers_list` Cached Without Pagination
- **Problem**: `admin.getCustomers` fetches ALL customers and caches them. At 50k users, this is a 50k-document query with no limit, guaranteed to OOM.
- **Fix**: Add pagination (`page`, `limit`) to all admin list endpoints and remove the blanket cache.

### Issue 16: Missing Mongoose Connection Options for Production
- **Problem**: `config/db.js` calls `mongoose.connect(uri)` with zero options. No connection pool size, no timeouts, no heartbeat.
- **Fix**: Add `maxPoolSize: 10`, `serverSelectionTimeoutMS`, `socketTimeoutMS`.

### Issue 17: Duplicate Quotes Embedded in Job Model (Denormalization Anti-Pattern)
- **Problem**: Quotes exist as a separate `Quote` model AND as an embedded array inside each `Job` document. This causes data duplication, inconsistency risks, and makes the `Job` document grow unboundedly.
- **Fix**: Remove the embedded `quotes: [...]` array from the `Job` model. All quote lookups should go through the `Quote` collection.

### Issue 18: No Refresh Token Mechanism — JWTs Last 30 Days
- **Problem**: JWT tokens last 30 days with no way to refresh. If a token is compromised, the attacker has 30 days of access. There is also no logout endpoint that invalidates the token.
- **Fix**: Implement a logout endpoint that blacklists the token in Redis (using the JWT's `exp` as the TTL). The auth middleware checks the blacklist.

### Issue 19: SMS OTP Always Returns `4729` in Development
- **Problem**: `sms.service.js` returns a hardcoded OTP `'4729'` in development. This is fine for dev, but the comment says `TODO: Integrate actual 3rd party`. There is no mechanism to switch this. If `NODE_ENV` is accidentally not set to `production` on a real server, anyone can log in with `4729`.
- **Fix**: Add an `ENABLE_REAL_SMS=true` env variable check, independent of `NODE_ENV`.

---

## P2 — OPTIMIZATION: Scalability to 50k+ Users

> [!TIP]
> These changes dramatically reduce database load and improve response times.

### Redis Caching — Currently Missing
| Data | Current | Recommended |
|---|---|---|
| Auth user session | DB query per request | Redis cache, 1h TTL |
| Categories list | DB query per request | Redis cache, 1h TTL (static data) |
| App settings/config | DB query per request | Redis cache, 10min TTL |
| Worker wallet balance | DB query per request | Redis cache, 5min TTL |
| Admin dashboard stats | ✅ Cached 5min | OK |
| Admin badge counts | ✅ Cached 2min | OK |
| Shop products list | DB query per request | Redis cache, 5min TTL |

### Database Indexes — Missing Critical Indexes
| Collection | Missing Index | Query it would optimize |
|---|---|---|
| `WalletTxn` | `{ userId: 1, type: 1 }` | Filter by user+type |
| `ShopOrder` | `{ shopId: 1, status: 1 }` | Shop dashboard filter |
| `ShopOrder` | `{ customerId: 1, createdAt: -1 }` | Customer order history |
| `Quote` | `{ jobId: 1, status: 1 }` | Quotes per job filter |
| `Job` | `{ status: 1, createdAt: -1 }` | Compound for admin filter |

### Unnecessary Files / Dead Code to Remove
- `backend/src/modules/transaction/` — Legacy `Transaction` model, superseded by `WalletTxn`. Used only in the seeder and one admin route.
- `backend/src/modules/chat/` — Chat routes exist but the chat feature has no actual persistence (messages are only sent over socket, never saved to DB). Either implement or remove.
- `backend/src/modules/suggestion/` — Low priority, can be moved to admin-specific management.
- `backend/src/modules/dispute/` — `dispute.model.js` has a basic structure but `job.controller.js` incorrectly uses cancelled jobs as "disputes". Needs proper implementation.
- `mobile/src/features/customer/BookServiceScreen.js` — Exists but appears to be a duplicate of the `SubCategoriesScreen` flow. Needs audit.

### Socket.io: No Authentication on Socket Connections
- **Problem**: Anyone can connect to the Socket.io server and join `admin_dashboard`, `customer_{anyId}`, or `worker_{anyId}` rooms without any authentication.
- **Fix**: Add Socket.io middleware that verifies the JWT before allowing connection.

---

## Proposed Changes

### Backend

#### [MODIFY] [server.js](file:///d:/kwickly/11-4-26/backend/src/server.js)
- Fatal startup check for required env vars (`JWT_SECRET`, `MONGO_URI`).

#### [MODIFY] [app.js](file:///d:/kwickly/11-4-26/backend/src/app.js)
- Add `express-rate-limit` middleware (global + strict for auth routes).
- Restrict CORS to allowed origins from env.

#### [MODIFY] [auth.middleware.js](file:///d:/kwickly/11-4-26/backend/src/middleware/auth.middleware.js)
- Cache authenticated user in Redis. Check token blacklist.

#### [MODIFY] [auth.controller.js](file:///d:/kwickly/11-4-26/backend/src/modules/auth/auth.controller.js)
- Remove JWT secret fallback. Fix `verifyOTP` role-change loophole.
- Add logout endpoint with token blacklisting.
- Add OTP attempt tracking via Redis.

#### [MODIFY] [job.controller.js](file:///d:/kwickly/11-4-26/backend/src/modules/job/job.controller.js)
- Fix `eligible_workers_pool` cache — use geospatial query instead of global cache.
- Cache categories and settings lookups.

#### [MODIFY] [quote.controller.js](file:///d:/kwickly/11-4-26/backend/src/modules/quote/quote.controller.js)
- Add self-quote guard. Atomic `acceptQuote` with status-guarded `findOneAndUpdate`.

#### [MODIFY] [wallet.controller.js](file:///d:/kwickly/11-4-26/backend/src/modules/wallet/wallet.controller.js)
- Atomic wallet deduction using `findOneAndUpdate` with balance condition.

#### [MODIFY] [shoporder.controller.js](file:///d:/kwickly/11-4-26/backend/src/modules/shoporder/shoporder.controller.js)
- Atomic stock reservation at order placement time.

#### [MODIFY] [admin.controller.js](file:///d:/kwickly/11-4-26/backend/src/modules/admin/admin.controller.js)
- Fix `getLedger` to use `WalletTxn`. Fix `getPlatformHealth` socket count.
- Add pagination to `getCustomers` / `getWorkers`.

#### [MODIFY] [admin.routes.js](file:///d:/kwickly/11-4-26/backend/src/modules/admin/admin.routes.js)
- Add shop management endpoints (list shops, update KYC, view shop orders).

#### [MODIFY] [job.model.js](file:///d:/kwickly/11-4-26/backend/src/modules/job/job.model.js)
- Remove embedded `quotes: [...]` array. Add missing compound indexes.

#### [MODIFY] [config/db.js](file:///d:/kwickly/11-4-26/backend/src/config/db.js)
- Add production connection pool options.

#### [MODIFY] [socket.helper.js / sockets/index.js](file:///d:/kwickly/11-4-26/backend/src/helpers/socket.helper.js)
- Add JWT authentication middleware for socket connections.

#### [NEW] [backend/src/middleware/rateLimit.middleware.js](file:///d:/kwickly/11-4-26/backend/src/middleware/rateLimit.middleware.js)
- Centralized rate limiting configurations.

### Database
- Add 5 missing indexes to `WalletTxn`, `ShopOrder`, `Quote`, `Job`.
- Remove embedded quotes from `Job` model.

### Mobile
- Remove all static/hardcoded data still present in screens.
- Verify `BookServiceScreen.js` is reachable from navigation and not a dead file.

---

## Verification Plan

### Automated
- `node src/server.js` — confirm startup fails without `JWT_SECRET`.
- Test OTP rate limit: call `/auth/send-otp` 6 times in 1 minute — 6th call should be blocked.
- Test race condition fix: send 2 simultaneous withdrawal requests for the full balance.

### Manual Flow Testing
1. **Customer flow**: Register → OTP → Browse shops → Add to cart → Order → Track → OTP delivery → Confirm
2. **Worker flow**: Register → KYC submission → Admin approves → Go online → Receive job alert → Quote → Accept notification → Arrive → OTP → Complete → Get paid
3. **Shop flow**: Register → Setup shop → Add products → Receive order → Process → OTP delivery → Wallet credited
4. **Admin flow**: View dashboard → KYC approval → View all orders → View all transactions → Adjust wallet → View shop list
