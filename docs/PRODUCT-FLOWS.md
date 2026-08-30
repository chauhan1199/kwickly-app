# Kwickly — Complete Product Flow Cycles

> Single source of truth for every lifecycle in the platform: Customer, Worker, Shop, Job, Shop Order, Payments, plus the infrastructure (Cron, Redis, Socket.IO) that keeps the cycles running. Verified against the codebase on 2026-08-30.

---

## 1. CUSTOMER CYCLE (identity → service job OR shop order)

```
Signup (phone + OTP) → Role: CUSTOMER → Home
   ├─ Service path:  Describe Job → Quotes → Accept → Track → Pay → Review
   └─ Commerce path: Browse Shops → Cart → Checkout → Track Order → Review
Wallet: Topup (UPI, zero-trust pending) → used for job payments & orders
```

1. **Onboarding**: `POST /auth/send-otp` → OTP stored in Redis (`otp:{phone}`, 10 min, 5 attempts, 60 s resend cooldown) → `POST /auth/verify-otp` → JWT session cached (`session:{userId}`)
2. **Home** (`HomeScreen.js`): categories, nearby shops, top pros (Redis cache `top_pros_list`), saved addresses
3. **Wallet topup** (`WalletTopupScreen.js`): customer pays via UPI intent → submits 12-digit UTR → txn `PENDING_VERIFICATION` (zero-trust: no credit until admin verifies against bank statement) → admin approves → wallet credited + `WALLET_TOPUP_APPROVED` socket + notification
4. **Profile extras**: EditProfile, SavedAddresses, ReferEarn, HelpSupport, Notifications (`NotificationsScreen.js`)

---

## 2. SERVICE JOB CYCLE (Customer ↔ Worker)

### 2.1 Status machine (job.model.js)
`BROADCASTING → QUOTES_RECEIVED → ALLOCATED → ARRIVING → IN_PROGRESS → COMPLETED → PAID → CLOSED`
Side exits: `CANCELLED` (customer cancel / no workers found / quote timeout) · `DISPUTED` (either party)

### 2.2 Flow, step by step

| # | Step | Screen (mobile) | What happens server-side |
|---|------|-----------------|--------------------------|
| 1 | Describe job (category, location, time slot, budget) | `DescribeJobScreen.js` | Job created `BROADCASTING`, `broadcast.round=1`, radius = settings.maxKm (default 25) |
| 2 | Job broadcast | — (automatic) | Eligible workers found (`job:{id}:eligible_workers` cached) → `NEW_JOB_ALERT` emitted to each `worker_{id}` room + push notification |
| 3 | Workers submit quotes | `WorkerMyQuotesScreen.js` | Quote created `PENDING`; job → `QUOTES_RECEIVED`; customer gets `NEW_QUOTE` |
| 4 | Customer compares & accepts | `LiveBidsScreen.js` / `QuotesScreen.js` | Quote → `ACCEPTED` (all others `REJECTED`/`WITHDRAWN`); job → `ALLOCATED`; Redis lock `job:{id}:assigned_worker` = workerId |
| 5 | Worker travels to customer | `WorkerNavigateJobScreen.js` | Worker streams `WORKER_LOCATION_UPDATE` → server verifies assignment against Redis (anti-spoof) → emits `WORKER_LOCATION` to `customer_{id}` → `LiveTrackingScreen.js` renders live marker |
| 6 | Arrival verification | `WorkerArrivalOTPScreen.js` | Customer shows OTP; worker submits; server compares with `timingSafeEqual` → job → `ARRIVING`/`IN_PROGRESS` (start requires OTP match) |
| 7 | Work execution | `WorkerActiveJobScreen.js` | Status updates `IN_PROGRESS`; in-app chat via `job_{id}` room (`SEND_MESSAGE` → `NEW_MESSAGE`, sanitized, 2000 char cap) |
| 8 | Completion | `WorkerJobCompleteScreen.js` / `WorkCompletedScreen.js` | Job → `COMPLETED`. Escrow `LOCKED` if prepaid |
| 9 | **Payment** (UPI-only, zero-trust) | customer payment screen | Customer pays UPI intent → submits 12-digit UTR (dummy-pattern blacklist rejected) → `payment.status=PENDING_VERIFICATION` → admin bank-statement verify → `PAID` |
| 10 | **Settlement** | — automatic | On transition to PAID: `settleJobCompletion()` — 100% to worker wallet, 10% commission to platform treasury, GST to tax ledger; idempotent via `settle_job_{id}` key in PlatformLedger (unique sparse index); atomic status claim prevents double settlement |
| 11 | Mutual reviews | `RateExperienceScreen.js` / `WorkerRateCustomerScreen.js` | Ratings on both sides; job → `CLOSED` |
| 12 | Dispute (optional) | via support | Job → `DISPUTED`; admin resolution: `DEDUCT_FROM_WORKER` / `WAIVE_FEE` / `REFUND_CUSTOMER` / `CLOSE` |

### 2.3 Job escrow/payment enums
- `payment.status`: `PENDING → PAID → REFUNDED`
- `escrowStatus`: `UNLOCKED → LOCKED → SETTLED | REFUNDED`
- Quote: `PENDING → ACCEPTED | REJECTED | WITHDRAWN`

---

## 3. WORKER CYCLE

```
Signup → KYC (admin review) → Subscription (UPI, verified) → Go Online
→ Receive NEW_JOB_ALERT → Quote → Execute → Earn → Withdraw
```

1. **Signup**: phone/OTP → role WORKER → profile + services (`WorkerManageServicesScreen.js`) + KYC documents uploaded (Cloudinary)
2. **KYC review**: admin union KYC queue (`GET /admin/pending-kyc`, workers + shops merged, paginated) → APPROVE/REJECT → notification + `WORKER` status update
3. **Subscription** (mandatory to receive jobs): plans MONTHLY/QUARTERLY/HALF_YEARLY/YEARLY or FREE_TRIAL → pay via UPI + UTR → admin verifies → active till `expiryDate`. `WorkerSubscription` model with unique UTR index (cross-flow replay protection)
4. **Online gate**: `WorkerDashboard.js` toggles `isOnline`; eligibility = online + active subscription + wallet ≥ `settings.wallet.minimumBalance` (default ₹100)
5. **Job feed**: `NEW_JOB_ALERT` per broadcast round; accept/quote flow as §2
6. **Earnings**: job settlements credit worker wallet (`WALLET_CREDIT` + `JOB_CREDIT` events); `WorkerEarningsScreen.js`
7. **Payout withdrawal**: request → Payout `PENDING` → admin approves with verified UTR/bank (`APPROVED` → `TRANSFERRED` or `REJECTED`) → `PAYOUT_STATUS_UPDATE` event
8. **Force-offline protections**: `FORCED_OFFLINE` emitted when subscription expires (cron) or balance below minimum

Payout statuses: `PENDING → APPROVED → TRANSFERRED | REJECTED`; methods `UPI | BANK`.

---

## 4. SHOP CYCLE (Shop Owner)

```
Signup → Create Shop → KYC → Subscription → Products → Receive Orders
→ Confirm → Pack → Deliver (own staff) → Settle → Withdraw
```

1. **Signup**: role SHOP → `CreateShopScreen.js` (name, category, address, geo-point, logo upload)
2. **KYC**: `POST /shops/my/kyc/documents` per-document upload OR resubmit via `PATCH /shops/my` (documents sanitized, **status always forced to PENDING** — owner can never self-approve); admin reviews via `PATCH /shops/:id/kyc`
3. **Subscription**: same as worker; `ShopSubscription` model; expiry cron forces shop offline
4. **Catalog**: `ShopProductsScreen.js` — products with stock; placing an order **reserves stock** (`$inc: -qty`)
5. **Shop config**: `ShopDeliveryConfigScreen.js` (radius, min order, free-delivery threshold, discounts, slots), `ShopSettingsScreen.js` (online toggle, business hours), delivery staff CRUD (each with `activeOrderId` guard — cannot delete staff mid-delivery)
6. **Order management**: `ShopOrdersScreen.js` → `ShopOrderDetailScreen.js`; live orders arrive via `shop_{shopId}` socket room (`ORDER_STATUS` / `ORDER_PLACED`)
7. **Shop wallet & payouts**: same escrow/settlement as workers; `ShopWalletScreen.js`

---

## 5. SHOP ORDER CYCLE (Customer ↔ Shop)

### 5.1 Status machine (shoporder.model.js)
`NEW → CONFIRMED → PACKING → OUT_FOR_DELIVERY → DELIVERED`
Side exit: `CANCELLED` (with stock restore + refund if paid). Every transition appended to `statusHistory`.

### 5.2 Flow

1. **Browse & cart**: `ShopScreen.js` → `ShopDetailScreen.js` → `CartScreen.js` (client total, platform fee, GST kept in sync with backend)
2. **Checkout**: place order → `NEW`; stock reserved atomically; payment method `WALLET | UPI | CASH | COD`
   - WALLET: instant debit, `payment.status=PAID`
   - UPI: 12-digit UTR → `PENDING_VERIFICATION` → admin verify → `PAID` (fake/dummy UTR ⇒ order cancelled + stock restored)
   - COD/CASH: settle on delivery
3. **Shop confirms**: `NEW → CONFIRMED` (30-min ghost window, §6.3) → customer `ORDER_STATUS`
4. **Pack**: `PACKING`; assign delivery staff (`activeOrderId` set)
5. **Out for delivery**: `OUT_FOR_DELIVERY`; customer tracks via `OrderTrackingScreen.js` / `CustomerShopOrdersScreen.js`
6. **Delivered**: `DELIVERED` — **atomic claim** (`findOneAndUpdate` from OUT_FOR_DELIVERY) so exactly one request settles; `settleShopOrderDelivery()`: shop credited, platform fee to treasury, GST to tax ledger, idempotency key in PlatformLedger
7. **Cancel path**: customer/shop cancel while allowed → stock restored (`bulkWrite $inc`), wallet refund txn `REFUND` + notification; if already delivered/settled, settlement is reversed
8. **Review**: rate shop after delivery

Payment enums: `PENDING → PENDING_VERIFICATION → PAID → FAILED | REFUNDED`; escrow `UNLOCKED → LOCKED → SETTLED | REFUNDED`.

---

## 6. CRON JOBS (backend/src/workers/cronEngine.js + src/cron/subscription.cron.js)

All crons are **multi-node safe**: each run acquires a Redis lock first; the loser node skips.

| # | Schedule | Lock key | Job | What it does |
|---|----------|----------|-----|--------------|
| 1 | every minute | `cron:broadcast_sweep` | **Broadcast radius expansion** | Jobs stuck in `BROADCASTING` > 1 min: expand radius (round × maxKm). After **3 rounds (75 km)** with no workers → auto-`CANCELLED` + notify customer (`JOB_STATUS_CHANGED`, `JOB_RADIUS_EXPANDED` per round) |
| 2 | every minute | `cron:job_sweep` | **Ghost quote sweeper** | Jobs in `QUOTES_RECEIVED` > **2 h** without acceptance → `CANCELLED` (skips future-scheduled jobs until preferredDate passes) |
| 3 | every 5 min | `cron:order_sweep` | **Ghost order sweeper** | Orders `NEW` > **30 min** unconfirmed → `CANCELLED` + stock restored (transactional) + wallet refund if `PAID` + notify both sides |
| 4 | every 10 min | `cron:worker_sweep` | **Expired-subscription sweeper** | Workers/shops online with expired subscription → `isOnline=false` + `FORCED_OFFLINE` |
| 5 | daily 00:00 | (no lock) | **Subscription reminder cron** | Expiring in 3 days → warn notification; expired today → force offline + notify |

---

## 7. REDIS (Upstash; in-memory fallback in dev/tests)

| Key pattern | Purpose | TTL/notes |
|-------------|---------|-----------|
| `otp:{phone}` / `reset_otp:{phone}` | Login/reset OTP | 10 min, max 5 attempts (`otp_attempts:{phone}`), 60 s resend cooldown |
| `session:{userId}` | User session cache | invalidated on profile/role/wallet-affecting changes |
| `blacklist:{token}` | JWT logout blacklist | TTL = token remaining life |
| `job:{id}:assigned_worker` | Assignment lock | **anti-spoof** for WORKER_LOCATION_UPDATE; source of truth for who may stream location |
| `job:{id}:eligible_workers` | Broadcast recipients cache | per broadcast round |
| `cron:*` (4 keys) | Cron leader locks | 50–590 s |
| `app_settings`, `app_branding`, `public_settings` | Settings cache | admin edits invalidate |
| `top_pros_list` | Top workers cache | home screen |
| Rate-limit counters | AdaptiveRateLimitStore | global/auth/OTP limiters; falls back to in-memory store if Redis down |

Cross-cutting: `acquireLock/releaseLock` used by crons **and** by the settlement engine claim pattern.

---

## 8. SOCKET.IO (src/sockets/index.js + helpers/socket.helper.js)

**Rooms** (auto-joined on connect from JWT — no client-driven joins except job rooms):
`customer_{userId}` · `worker_{userId}` · `shop_{shopId}` · `job_{jobId}` (guarded: only assigned customer/worker/ADMIN may join) · `admin_dashboard` (ADMIN only)

**Client → server events:**
| Event | Guard | Action |
|-------|-------|--------|
| `JOIN_JOB_ROOM` | must be job's customer/worker/ADMIN | join `job_{id}` |
| `WORKER_LOCATION_UPDATE` | WORKER + Redis assignment check (spoofing blocked) | relay `WORKER_LOCATION` to customer room |
| `SEND_MESSAGE` | authenticated, senderId must match socket user | sanitize (strip HTML, 2000 chars) → `NEW_MESSAGE` to job room |

**Server → client events (complete list):**
- Job: `NEW_JOB_ALERT`, `NEW_JOB`, `JOB_CREATED`, `JOB_UPDATED`, `JOB_STATUS_CHANGED`, `JOB_TAKEN`, `JOB_STARTED`, `JOB_COMPLETED`, `JOB_PAID`, `JOB_PAYMENT`, `JOB_CANCELLED`, `JOB_DISPUTED`, `JOB_RADIUS_EXPANDED`, `NEW_QUOTE`, `QUOTE_ACCEPTED`, `QUOTE_RECEIVED`, `WORKER_REASSIGNED`
- Order: `ORDER_PLACED`, `ORDER_STATUS`, `ORDER_STATUS_CHANGED`, `ORDER_UPDATED`, `ORDER_PAYMENT`, `ORDER_PAYMENT_CONFIRMED`, `ORDER_DELIVERED`, `ORDER_CANCELLED`
- Wallet/payout: `WALLET_UPDATE`, `WALLET_TOPUP`, `WALLET_TOPUP_APPROVED`, `WALLET_TOPUP_REJECTED`, `WALLET_REJECTED`, `WALLET_CREDIT`, `WALLET_DEBIT`, `JOB_CREDIT`, `JOB_DEBIT`, `ORDER_CREDIT`, `ORDER_DEBIT`, `PAYOUT_STATUS_UPDATE`, `PAYOUT_DEBIT`
- Worker: `WORKER_LOCATION`, `WORKER_LOCATION_UPDATE`, `FORCED_OFFLINE`, `WORKER_SUBSCRIPTION`, `WORKER_WALLET`, `WORKER_PAYOUT`
- Chat/support: `NEW_MESSAGE`, `NEW_NOTIFICATION`, `DASHBOARD_UPDATE`, `ADMIN_MESSAGE_SENT`, `SUPPORT_MESSAGE_RECEIVED`
- Error: `ERROR`

**Client subscriptions:**
- Mobile (`hooks/useSocket.js` + screens): `NEW_JOB_BROADCAST`/`NEW_JOB_ALERT` (WorkerDashboard), `NEW_QUOTE` + `JOB_STATUS_CHANGED` + `JOB_RADIUS_EXPANDED` (LiveBidsScreen), `NEW_MESSAGE` (ChatScreen), `WORKER_LOCATION` (LiveTracking), `FORCED_OFFLINE`, `NEW_NOTIFICATION`
- Admin: `DASHBOARD_UPDATE`, `NEW_NOTIFICATION`, `SUPPORT_MESSAGE_RECEIVED`, `ADMIN_MESSAGE_SENT`

---

## 9. MONEY MOVEMENT & SETTLEMENT (settlementEngine.helper.js)

- **Trigger A — Job**: transition to `PAID` (admin-verified UTR) → `settleJobCompletion()`
- **Trigger B — Order**: transition to `DELIVERED` → `settleShopOrderDelivery()`
- Both: worker/shop credited 100% of their share, **platform commission (10% jobs / platform fee + GST on orders)** split into treasury + tax ledger entries in **PlatformLedger** with unique sparse `idempotencyKey` index (`settle_job_{id}` / `settle_order_{id}`) — replay-safe
- **Atomic claim**: `findOneAndUpdate({_id, status: from}, {status: to})` guarantees exactly one settlement even under concurrent duplicate requests
- **Dispute reversal**: admin resolution can deduct from worker / refund customer; settlements reversible on post-delivery cancel
- **All UPI inflows are zero-trust**: `PENDING_VERIFICATION` until admin bank-statement check; dummy UTR patterns rejected at every layer (mobile, admin UI, backend)

---

## 10. ADMIN PANEL CYCLE (control plane)

- Auth: ADMIN-only sessions enforced at login and route level; ErrorBoundary wraps the app
- **KYC union queue**: workers + shops merged, server-paginated (max 50), search, filter, stats
- **Financial control**: wallets (topup verify), payouts (UTR-validated approve/transfer), ledger, subscriptions, escrow/settlement reports, admin wallet
- **Operations**: jobs, orders, users, workers, shops, disputes, support chats (live via sockets), notifications broadcast, promotions, settings (app settings → Redis cache), dashboard (live `DASHBOARD_UPDATE`)
- Live feeds via `admin_dashboard` room; every admin action writes admin-activity log entries

---

## 11. QUICK REFERENCE — END-TO-END TIMELINES

| Scenario | Automatic timeouts |
|----------|--------------------|
| Job posted, no workers | 3 broadcast rounds × 1 min apart → up to 75 km → auto-cancel |
| Quotes received, customer silent | 2 h → auto-cancel (scheduled jobs wait for preferredDate) |
| Order placed, shop silent | 30 min → auto-cancel + stock restore + refund |
| Subscription expired | ≤ 10 min (sweep) → forced offline; daily 00:00 reminder cron for 3-day warnings |
| OTP | 10 min validity, 5 attempts, 60 s resend cooldown |
