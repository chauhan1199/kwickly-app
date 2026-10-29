# 🚀 Kwickly — Complete Master System Specification & Architecture Manual

> **Single Source of Truth** for the entire Kwickly ecosystem: Backend API Engine, Admin Control Center, and Cross-Platform Mobile Application.  
> Architecture: **Zero-Trust Financials**, **Zero Business Logic Breakage**, **0% Partner Commission**, **Sub-2ms Redis Hot-Path**, and **Real-Time WebSocket Synchronization**.

---

## 📌 1. System Overview & Technology Stack

Kwickly is an enterprise-grade, high-concurrency hyperlocal marketplace ecosystem connecting:
1. **Customers**: Request on-demand home & commercial services or buy grocery, electronics, and essentials from nearby stores.
2. **Service Professionals (Workers)**: On-demand gig and skilled service providers (electricians, plumbers, carpenters, mechanics, cleaners, etc.) who bid on jobs and earn **100% of their quote with 0% platform commission**.
3. **Neighborhood Merchants (Shops)**: Local brick-and-mortar stores managing digital catalogs, inventory, delivery staff, and orders with instant settlement.
4. **Platform Administrators (Admin)**: Operational oversight, zero-trust UPI bank reconciliation, KYC verification queue, disputes arbitration, real-time live metrics, and platform settings.

### 1.1 Architecture Diagram

```
                                  ┌─────────────────────────────────────────┐
                                  │      Kwickly Mobile App (React Native)  │
                                  │  [Customer]   [Worker]   [Shop Owner]   │
                                  └────────────────────┬────────────────────┘
                                                       │
                                   HTTPS REST API /    │  WebSocket (WSS)
                                   Zero-Trust UPI      │  Bidirectional Sync
                                                       ▼
┌─────────────────────────────────┐       ┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│       Admin Control Center      │◄─────►│       Kwickly Backend API       │◄─────►│       Upstash Cloud Redis       │
│      (React 18 + Vite SPA)      │       │     (Node.js / Express 5)       │       │    (< 2ms Hot-Cache & Mutex)    │
└─────────────────────────────────┘       └────────────┬────────┬───────────┘       └─────────────────────────────────┘
                                                       │        │
                                        Mongoose / ACID│        │Cloudinary CDN
                                        Transactions   │        │(Media & Docs)
                                                       ▼        ▼
                                          ┌────────────────────────┐
                                          │  MongoDB Atlas Cluster │
                                          │ (Replica Set / Txns)   │
                                          └────────────────────────┘
```

### 1.2 Technology Matrix

| Layer | Technology | Primary Role / Characteristics |
| :--- | :--- | :--- |
| **Backend API** | Node.js (v20+ / v24), Express 5 | Modular route architecture across 24 core domains, rate limiting, request tracing, helmet security. |
| **Admin Panel** | React 18, Vite 5, Lucide Icons, Recharts | Single Page Application (SPA), code-split into hashed dynamic chunks, zero third-party script vulnerabilities. |
| **Mobile App** | React Native (v0.85), Expo, React Navigation | Unified role switching (`CUSTOMER`, `WORKER`, `SHOP`), dark/light themes, offline resilience, native UPI intent launcher. |
| **Primary Database** | MongoDB Atlas Replica Set Cluster | GeoJSON 2dsphere spatial indexes, ACID transactions where supported, Mongoose validation. |
| **Cache & Locks** | Upstash Cloud Redis (ioredis) | Sub-2ms hot cache for sessions, OTPs, app settings, and distributed mutex locks for crons and settlements. |
| **Real-Time Mesh** | Socket.io (WSS) | Server-enforced role authentication, private user and job rooms, GPS location streaming, instant order alerts. |
| **Media CDN** | Cloudinary Cloud | Secure KYC identity document storage, product photos, category icons, banner graphics. |
| **Payments** | Pure Direct UPI (NPCI Protocol) + Wallet | Direct bank-to-bank UPI Intent (`upi://pay`), 12-digit UTR verification with entropy checks, double-entry `PlatformLedger`. |

---

## 🌐 2. Cloud Production Environments

| Subsystem | Host / Cloud Provider | Live Production URL | Source Directory |
| :--- | :--- | :--- | :--- |
| **REST API Server** | Render Cloud (Dockerized Linux Container) | `https://kwickly-backend-r6zb.onrender.com` | `/backend` |
| **WebSocket Engine** | Socket.io over SSL / WSS | `wss://kwickly-backend-r6zb.onrender.com` | `/backend/src/sockets` |
| **Admin Web Panel** | Vercel Edge SPA Network | `https://kwickly-app.vercel.app` | `/admin` |
| **Primary Database** | MongoDB Atlas (Replica Set) | `mongodb+srv://kwickly:***@kwickly.bzvkcwl.mongodb.net/kwickly` | Managed Atlas |
| **Distributed Cache** | Upstash Cloud Redis Cluster | `rediss://default:***@shining-bobcat-163376.upstash.io:6379` | Managed Upstash |
| **Android APK** | Universal Release APK | Checked into root / built via `./gradlew assembleRelease` | `/mobile` |

---

## 🛡️ 3. Core Architectural Invariants (Ponytail Mindset)

1. **Zero Business Logic Breakage**: All four lifecycles (`CUSTOMER`, `WORKER`, `SHOP`, `ADMIN`) must strictly execute their state transitions without arbitrary state jumps or mutations.
2. **0% Partner Commission Model**:
   - **Service Workers**: Receive **100% of their accepted quote**. Platform fee (flat ₹50 or dynamic fee based on category) + 18% GST are paid by the customer, or deducted from the worker's wallet in case of cash jobs.
   - **Shops**: Receive **100% of Net Product Sales + Delivery Fee**. Platform fee + GST are paid by the customer, or deducted in case of cash/COD orders.
3. **Zero-Trust Financial Inflows**:
   - Platform never auto-credits an account on raw client assertions.
   - All UPI topups and payments submit a 12-digit UTR, enter `PENDING_VERIFICATION`, and are credited only after automated bank SMS webhook verification or platform admin bank-statement confirmation.
4. **Timing-Safe OTP Verification**:
   - 4-digit arrival and completion OTPs are strictly checked using `crypto.timingSafeEqual` in Node.js to eliminate side-channel timing attacks.
5. **Idempotent Settlements**:
   - Disbursal of funds generates double-entry records in `PlatformLedger` under unique sparse keys (`settle_job_{id}`, `settle_order_{id}`). Concurrent attempts or replays are cleanly intercepted and ignored.
6. **Anti-Spoof GPS Streaming**:
   - Workers streaming real-time location (`WORKER_LOCATION_UPDATE`) must be validated against the active Redis lock `job:{id}:assigned_worker` or database assignment before relaying location to the customer room.

---

## 👥 4. Role-Wise Comprehensive Deep Dive

---

### 4.1 Role 1: Customer (`CUSTOMER`)

```
Onboarding (Phone + OTP) ➔ MPIN Setup ➔ Customer Home
   ├── Service Job Path: Describe Job ➔ Radius Broadcast ➔ Receive Quotes ➔ Accept ➔ Live Track ➔ Arrival OTP ➔ Completion OTP ➔ Payment ➔ Mutual Review
   └── Shop Order Path:  Nearby Shops ➔ Product Catalog ➔ Cart (Single-Shop) ➔ Checkout (Wallet/UPI/Cash) ➔ Live Track ➔ Delivery Handover OTP ➔ Review
Digital Wallet: Direct UPI Intent ➔ Submit 12-Digit UTR ➔ Zero-Trust Verification ➔ PDF Invoices & Receipts
```

#### Detailed Journey:
1. **Authentication & Session**:
   - Customer enters mobile number (`POST /api/v1/auth/send-otp`).
   - Redis stores OTP in `otp:{phone}` (10-minute TTL, max 5 attempts, 60s resend cooldown).
   - Verifies OTP (`POST /api/v1/auth/verify-otp`) ➔ returns JWT session token, cached in Redis `session:{userId}`.
   - Optional 4-digit MPIN creation (`POST /api/v1/auth/set-mpin`) for fast subsequent unlocks.
2. **On-Demand Service Booking**:
   - **Post Request** (`DescribeJobScreen.js` ➔ `POST /api/v1/jobs`): Selects category, subcategory, GPS pin, address, preferred schedule, and description.
   - **State Machine Entry**: Job created with `status: 'BROADCASTING'`, `broadcast.round = 1` (dynamic base radius configured in Admin Settings: `radius.maxKm`, fallback default 25 km).
   - **Radar Feed**: Background cron searches eligible workers; as bids arrive, job enters `QUOTES_RECEIVED`.
   - **Bid Comparison** (`LiveBidsScreen.js` / `QuotesScreen.js`): Customer reviews worker profile, distance, ratings, and quoted price.
   - **Accept Bid** (`POST /api/v1/jobs/:id/accept-quote`): Job transitions to `ALLOCATED`. Redis key `job:{id}:assigned_worker` is set. Other submitted quotes become `REJECTED`/`WITHDRAWN`.
   - **Transit Tracking** (`LiveTrackingScreen.js`): Socket listens to `WORKER_LOCATION` relayed directly from the assigned worker.
   - **Arrival Verification** (`WorkerArrivalOTPScreen.js`): Customer presents arrival OTP; worker submits via timing-safe check; job moves to `ARRIVING` / `IN_PROGRESS`.
   - **Completion & Settlement**: Worker marks finished; customer provides 4-digit completion OTP; payment is finalized via wallet or direct UPI; settlement engine fires.
   - **Mutual Review** (`RateExperienceScreen.js` ➔ `POST /api/v1/jobs/:id/review`): Ratings (1–5 stars) and feedback recorded; job marked `CLOSED`.
3. **Hyperlocal Shop Orders**:
   - **Browse & Discovery** (`ShopScreen.js` ➔ `GET /api/v1/shops`): Filtered by distance, open hours, and active subscription.
   - **Catalog & Inventory** (`ShopDetailScreen.js` ➔ `GET /api/v1/products?shopId=...`): Real-time stock display.
   - **Single-Shop Cart** (`CartScreen.js`): Enforces items from a single merchant; calculates subtotal, delivery charges, platform fee, and GST.
   - **Checkout & Reservation** (`POST /api/v1/shoporders`): Stock is decremented atomically (`$inc: { stock: -qty }`).
   - **Live Dispatch**: Order transitions `NEW` ➔ `CONFIRMED` ➔ `PACKING` ➔ `OUT_FOR_DELIVERY`.
   - **Delivery Handover OTP**: Handover OTP generated upon dispatch; merchant/rider enters OTP to confirm delivery and trigger atomic settlement.
4. **Customer Digital Wallet**:
   - Inspect balance, credit/debit transaction history (`CustomerWalletScreen.js`).
   - Top-up via Direct UPI intent (`WalletTopupScreen.js` ➔ `POST /api/v1/wallet/topup-upi`).
   - Download transaction invoices and receipts as formatted PDFs.

---

### 4.2 Role 2: Service Professional (`WORKER`)

```
Signup ➔ Manage Skills & Categories ➔ Upload KYC (Aadhaar/PAN/DL) ➔ Admin Approval
   ➔ Subscribe / Dynamic Free Trial (Admin Configured) ➔ 3-Part Duty Gate (Go ONLINE) ➔ Receive NEW_JOB_ALERT
   ➔ Submit Price Quote ➔ Bid Accepted ➔ Navigate to Job (GPS Streaming) ➔ Verify Arrival OTP
   ➔ Execute Job (In-App Chat) ➔ Submit Completion ➔ Escrow Settlement (100% Payout) ➔ Payout Withdrawal
```

#### Detailed Journey:
1. **Profile & Skill Matrix**:
   - Worker configures service offerings (`WorkerManageServicesScreen.js` ➔ `PATCH /api/v1/workers/services`).
   - Uploads KYC identity documents to Cloudinary (`WorkerProfileScreen.js` ➔ `POST /api/v1/workers/kyc`).
2. **Three-Part Operational Duty Gate**:
   - Toggling duty online (`WorkerDashboard.js` ➔ `PATCH /api/v1/workers/toggle-online`) strictly enforces:
     1. `isOnline: true` (Worker voluntary toggle).
     2. `subscription.expiryDate > now` OR active trial (Mandatory active tier).
     3. `wallet.balance >= settings.wallet.minimumBalance` (Default ₹100 safety reserve).
3. **Real-Time Job Alerts & Quoting**:
   - Connected worker receives `NEW_JOB_ALERT` via private room `worker_{workerId}`.
   - Submits competitive bid (`WorkerMyQuotesScreen.js` ➔ `POST /api/v1/quotes`): Sets quoted amount, estimated arrival time, and notes.
4. **Transit & GPS Anti-Spoofing**:
   - Once bid is accepted (`QUOTE_ACCEPTED`), worker navigates to job location (`WorkerNavigateJobScreen.js`).
   - Emits GPS coordinates over socket via `WORKER_LOCATION_UPDATE`.
   - Server verifies worker ID against Redis `job:{id}:assigned_worker` before routing coordinates to customer.
5. **Work Execution & In-App Chat**:
   - Worker submits arrival OTP (`WorkerArrivalOTPScreen.js` ➔ `POST /api/v1/jobs/:id/verify-arrival-otp`). Job transitions to `IN_PROGRESS`.
   - In-app communication via socket room `job_{jobId}` (`SEND_MESSAGE` ➔ `NEW_MESSAGE`, sanitized, max 2000 chars).
6. **100% Net Earnings & Instant Payout**:
   - Customer supplies completion OTP ➔ Job marked `COMPLETED` and `PAID`.
   - Idempotent settlement engine credits worker wallet with **100% of quote** (`JOB_CREDIT`).
   - Worker requests payout (`WorkerEarningsScreen.js` ➔ `POST /api/v1/payouts`): Options for Direct UPI or IMPS bank transfer. Admin verifies and confirms transfer.

---

### 4.3 Role 3: Hyperlocal Merchant (`SHOP`)

```
Merchant Signup ➔ Store Profile Setup ➔ Upload KYC (Status Forced PENDING)
   ➔ Dynamic Free Trial / Subscription ➔ Product Catalog & Stock Management
   ➔ Delivery Config & Staff Setup ➔ Store Accepting Orders (Online)
   ➔ Real-Time Order Arrives (NEW) ➔ Confirm ➔ Pack & Assign Rider ➔ Dispatch (OUT_FOR_DELIVERY)
   ➔ Customer Handover OTP ➔ Delivered & Settled (100% Net Sales + Delivery Fee) ➔ Withdraw
```

#### Detailed Journey:
1. **Store Creation & KYC Security**:
   - Merchant creates store (`CreateShopScreen.js` ➔ `POST /api/v1/shops`): Sets business name, GPS point, logo, and categories.
   - Stores receive an automatic **Dynamic Free Trial** on signup (configured in Admin Settings `subscription.freeTrialDays`, default 14 days).
   - KYC submission/edits (`PATCH /api/v1/shops/my`) are **always forced to PENDING** on the server. The owner can never self-approve.
2. **Catalog & Inventory Architecture**:
   - Add/manage items (`ShopProductsScreen.js` ➔ `POST /api/v1/products`): Unit price, discount price, stock quantity, and images.
   - When orders are placed, the database reserves stock atomically (`$inc: { stock: -qty }`).
   - If an order is cancelled or times out, stock is automatically restored via `bulkWrite $inc: +qty`.
3. **Delivery Logistics & Staff Guard**:
   - Set operational radius, minimum order value, free delivery threshold, and custom delivery charge (`ShopDeliveryConfigScreen.js`).
   - Manage dedicated delivery riders (`deliveryStaff` module) with `activeOrderId` guard: riders cannot be deleted while assigned to an active delivery.
4. **Order Fulfillment Lifecycle**:
   - Live order alert arrives on socket room `shop_{shopId}` (`NEW_ORDER` / `ORDER_PLACED`).
   - Merchant moves order: `NEW` ➔ `CONFIRMED` ➔ `PACKING` (assigns rider) ➔ `OUT_FOR_DELIVERY`.
   - Upon dispatch, a 4-digit Delivery Handover OTP is generated.
   - Merchant or delivery rider inputs OTP upon handover (`PATCH /api/v1/shoporders/:id/status` with `otp`).
   - Server validates OTP, marks `DELIVERED`, and invokes `settleShopOrderDelivery()`:
     - 100% of Net Product Sales + Delivery Fee credited to Shop In-App Wallet (`ORDER_CREDIT`).
     - Customer Platform Fee credited to Admin Treasury.
     - GST liability recorded in `AdminWallet`.
     - Immutable double-entry audit record generated in `PlatformLedger`.

---

### 4.4 Role 4: Platform Administrator (`ADMIN`)

The Admin Control Center is a high-performance React 18 + Vite Single Page Application mounted on Vercel (`https://kwickly-app.vercel.app`), interfacing with `/api/v1/admin/*` and the real-time `admin_dashboard` socket room.

#### Complete Catalog of 22 Admin Modules:

| # | Module Route | Primary File | Capabilities & Business Functions |
| :-: | :--- | :--- | :--- |
| **1** | `/dashboard` | `modules/dashboard/Dashboard.jsx` | Live GMV, platform revenue, active jobs/orders counters, interactive Recharts graphs, real-time `DASHBOARD_UPDATE` sync. |
| **2** | `/users` | `modules/users/Users.jsx` | Complete customer registry, booking history, wallet adjustments, and instant ban/unban toggles. |
| **3** | `/workers` | `modules/workers/Workers.jsx` | Worker directory, service categories, earnings inspection, live duty status, and suspension controls. |
| **4** | `/shops` | `modules/shops/Shops.jsx` | Merchant registry, verified status, active products count, delivery config review, and `+30d`/`+90d` quick subscription extensions. |
| **5** | `/kyc` | `modules/kyc/KYC.jsx` | **Unified KYC Queue**: Merges workers and shops in a single paginated list (`GET /api/v1/admin/pending-kyc`). View document images, approve, or reject with structured reasons. |
| **6** | `/categories` | `modules/categories/Categories.jsx` | 21 top-level categories + 90+ subcategories. Cloudinary icon upload, base pricing rules, and platform fee overrides. |
| **7** | `/jobs` | `modules/jobs/Jobs.jsx` | Real-time monitoring of all on-demand service jobs. Filter by status, inspect quotes, assign workers manually, or cancel with refund. |
| **8** | `/orders` | `modules/orders/Orders.jsx` | Hyperlocal shop order tracking across all stages (`NEW` to `DELIVERED`). Inspect items, delivery address, and delivery rider status. |
| **9** | `/disputes` | `modules/disputes/Disputes.jsx` | Dispute arbitration desk. Actions: `DEDUCT_FROM_WORKER`, `REFUND_CUSTOMER`, `WAIVE_FEE`, or `CLOSE`. |
| **10** | `/payouts` | `modules/payouts/Payouts.jsx` | Worker and shop withdrawal requests. Displays bank details and UPI VPAs. Actions: `APPROVE`, `MARK_TRANSFERRED` (requires 12-digit bank UTR), or `REJECT`. |
| **11** | `/promotions` | `modules/promotions/Promotions.jsx` | Carousel banner manager (`HOME_TOP`, `HOME_MIDDLE`), image upload, target action link, and discount coupon code CRUD. |
| **12** | `/subscriptions`| `modules/subscriptions/Subscriptions.jsx`| Full CRUD for Pro tier plans (`MONTHLY`, `QUARTERLY`, `YEARLY`, `FREE_TRIAL`). Price, duration, feature badges, and active subscriber metrics. |
| **13** | `/admin-wallet` | `modules/admin-wallet/AdminWallet.jsx` | Kwickly platform treasury. Real-time platform fee revenues, GST tax liabilities, and treasury transfers. |
| **14** | `/settings` | `modules/settings/Settings.jsx` | Platform configuration: dynamic broadcast radius & expansion wait interval, minimum wallet balance, trial duration, UPI ID (`PLATFORM_UPI_ID`), and branding. |
| **15** | `/admin-users` | `modules/admin-users/AdminUsers.jsx` | RBAC management for super-admins and operations staff with granular permissions. |
| **16** | `/support` | `modules/support/SupportChats.jsx` | Multi-agent live support chat desk. Real-time WebSocket messaging with customers, workers, and merchants. |
| **17** | `/notifications`| `modules/notifications/Notifications.jsx`| Global push notification center. Target specific roles (`CUSTOMER`, `WORKER`, `SHOP`, `ALL`) with custom deep links. |
| **18** | `/reports` | `modules/reports/Reports.jsx` | Financial and operational analytics. Export CSV/JSON reports for tax compliance, GMV, and volume. |
| **19** | `/settlements` | `modules/settlements/Settlements.jsx` | Audit queue for completed job and order settlements with transaction breakdown. |
| **20** | `/wallets` | `modules/wallets/Wallets.jsx` | Digital wallet administration. **Zero-Trust UPI Verification Desk**: Review submitted 12-digit UTRs, verify against bank statements, and approve or reject topups. |
| **21** | `/ledger` | `modules/ledger/Ledger.jsx` | Immutable double-entry `PlatformLedger` viewer. Source of truth for every rupee moving through the system. |
| **22** | `/auth` | `modules/auth/Login.jsx` | Secure JWT administrative login with rate limiting and brute-force defenses. |

---

## 🔄 5. State Machines & Operational Flows

### 5.1 Service Job Lifecycle

```
[Customer Posts Job]
        │
        ▼
   BROADCASTING ──────────(Timeout / 3 Rounds)──────────► CANCELLED
        │
        ▼ (Worker Submits Quote)
 QUOTES_RECEIVED ─────────(2 Hour Inactivity)────────────► CANCELLED
        │
        ▼ (Customer Accepts Quote)
    ALLOCATED ◄───────────(Worker Location GPS Stream)
        │
        ▼ (Worker Arrives & Submits Arrival OTP)
     ARRIVING / IN_PROGRESS
        │
        ▼ (Work Completed)
    COMPLETED
        │
        ▼ (Customer Provides 4-Digit Completion OTP + Payment Confirmed)
       PAID ─────────────► [Idempotent Settlement Engine Fires: 100% Payout]
        │
        ▼ (Mutual Ratings Submitted)
      CLOSED
        ▲
        └─────────────────(Dispute Raised at Any Stage)──► DISPUTED
```

### 5.2 Hyperlocal Shop Order Lifecycle

```
[Customer Checks Out Cart] ──► (Stock Reserved: $inc: { stock: -qty })
        │
        ▼
       NEW ───────────────(30 Min Inactivity Sweeper)────► CANCELLED (Stock Restored + Refund)
        │
        ▼ (Shop Confirms)
    CONFIRMED
        │
        ▼ (Shop Packs & Assigns Staff)
     PACKING
        │
        ▼ (Staff Dispatched + Handover OTP Generated)
 OUT_FOR_DELIVERY ────────(Customer Rejection)───────────► CANCELLED (Stock Restored)
        │
        ▼ (Delivery Staff Submits Customer Handover OTP)
    DELIVERED ───────────► [Idempotent Settlement Engine: Shop Credited 100%]
```

---

## ⏱️ 6. Background Multi-Node Cron Engine

All background cron jobs are executed via `node-cron` with **Redis distributed mutex locks** (`acquireLock` / `releaseLock`). In a multi-instance or clustered environment, only the node that acquires the key executes the task; other nodes safely skip without double-processing.

| # | Worker Task | Schedule | Mutex Lock Key | Lock TTL | Operational Responsibilities |
| :-: | :--- | :--- | :--- | :--- | :--- |
| **1** | **Broadcast Expansion** | `* * * * *`<br>*(Every 1 min)* | `cron:broadcast_sweep` | 120s | Scans jobs in `BROADCASTING` where wait time exceeds dynamic interval (`radius.expansionIntervalMinutes`, default 1 min). Expands radius dynamically based on Admin Settings: Round 1 (`1 × maxRadius`) ➔ Round 2 (`2 × maxRadius`) ➔ Round 3 (`3 × maxRadius`). Emits `JOB_RADIUS_EXPANDED` and alerts newly eligible workers. If round > 3 and search window (30 mins) expires, auto-cancels job with dynamic distance reason and notifies customer. |
| **2** | **Ghost Quote Sweeper** | `* * * * *`<br>*(Every 1 min)* | `cron:job_sweep` | 50s | Scans jobs in `QUOTES_RECEIVED` older than **2 hours** where the customer took no action (skipping scheduled future jobs). Auto-cancels job, expires all pending quotes (`status: 'EXPIRED'`), and notifies quoting workers. |
| **3** | **Ghost Order Sweeper** | `*/5 * * * *`<br>*(Every 5 mins)* | `cron:order_sweep` | 290s | Scans shop orders in `NEW` older than **30 minutes** unconfirmed by merchant. **Atomically restores inventory stock** (`bulkWrite $inc: { stock: +qty }`), issues instant refund to customer wallet if paid, and cancels order. |
| **4** | **Expired Subscription Sweeper** | `*/10 * * * *`<br>*(Every 10 mins)* | `cron:worker_sweep` | 590s | Scans online workers and shops whose paid plan or free trial has expired (`expiryDate < now`). Sets `isOnline: false` and emits `FORCED_OFFLINE` to their private socket rooms. |
| **5** | **Daily Subscription Warning** | `0 0 * * *`<br>*(Daily Midnight)* | `cron:subscription_sweep` | 3600s | Scans subscriptions expiring in exactly 3 days and sends push notifications. Disables accounts that expired on day 0. |
| **6** | **Automated UPI Reconciliation** | `*/3 * * * *`<br>*(Every 3 mins)* | `cron:upi_reconcile_sweep` | 170s | Reconciles pending automated UPI payments between 2 minutes and 24 hours old against provider webhooks. |

---

## ⚡ 7. High-Performance Redis Hot-Path & Invalidation Matrix

Redis serves as the **<2ms latency tier** for high-frequency reads, session validations, and concurrency control:

| Key Pattern | Data Stored | TTL | Invalidation Trigger / Event |
| :--- | :--- | :--- | :--- |
| `otp:{phone}` | 4-Digit One-Time Password | 10 Mins | Successful verification or expiration |
| `otp_attempts:{phone}` | Failed attempt counter (max 5) | 10 Mins | Expiration |
| `session:{userId}` | Cached User Profile & Role | 30 Days | Profile update, role change, ban, or logout |
| `blacklist:{token}` | Blacklisted JWT Tokens | Token TTL | Token expiry |
| `job:{id}:assigned_worker` | Assigned Worker ID (Anti-Spoof) | 2 Hours | Job completion, cancellation, or dispute |
| `job:{id}:eligible_workers` | Cached worker IDs for broadcast round | Round TTL | Broadcast round transition |
| `categories_list` | Hierarchical Categories & Subcategories | 24 Hours | Admin creates, edits, or deletes a category |
| `banners_public_{pos}` | Public carousel banners by position | 10 Mins | Admin creates, edits, or deletes banner |
| `public_settings` | Platform fee rules, trial days, branding | 24 Hours | Admin updates platform settings |
| `app_settings` | Operational platform settings | 10 Mins | Admin updates operational settings |
| `top_pros_list` | Top-rated service professionals | 1 Hour | Rating transitions or worker status changes |
| `admin_dashboard_stats_*` | Aggregated revenue and order metrics | 5 Mins | Auto-invalidated on job/order completions |
| `lock:{lockKey}` | Distributed Mutex Lock (holderId) | 10s–3600s | Released upon task completion or TTL expiry |

*Note: In local development or during transient network interruptions, the Redis helper automatically falls back to a high-speed in-memory LRU cache and memory lock mechanism, guaranteeing zero crash downtime.*

---

## 📡 8. Real-Time WebSockets Engine (`Socket.io`)

### 8.1 Room Architecture (Auto-Joined via JWT Authentication)

- `customer_{userId}`: Dedicated customer channel for quote alerts, order status updates, and notifications.
- `worker_{userId}`: Dedicated worker channel for `NEW_JOB_ALERT`, wallet credits, and forced offline alerts.
- `shop_{shopId}`: Dedicated store channel for incoming customer orders (`ORDER_PLACED`) and cancellations.
- `job_{jobId}`: Secure room for participants of a specific booking. Only the assigned customer, assigned worker, and platform admins may join.
- `admin_dashboard`: Channel for platform administrators receiving live metric deltas.

### 8.2 Client ➔ Server Events

| Event | Security Guards | Action & Behavior |
| :--- | :--- | :--- |
| `JOIN_JOB_ROOM` | Authenticated; Socket user must be job's customer, worker, or ADMIN. | Joins socket to `job_{jobId}` for chat and tracking. |
| `WORKER_LOCATION_UPDATE` | Authenticated; Role must be `WORKER`. Verified against Redis `job:{id}:assigned_worker`. | Relays `WORKER_LOCATION` to the customer's private room. Anti-spoofing drops unauthorized attempts. |
| `SEND_MESSAGE` | Authenticated; Sender ID must match socket. Must be in room `job_{jobId}`. | Sanitizes message (strips HTML, caps at 2000 chars) and broadcasts `NEW_MESSAGE` to `job_{jobId}`. |

### 8.3 Server ➔ Client Events

- **Service Jobs**: `NEW_JOB_ALERT`, `JOB_RADIUS_EXPANDED`, `NEW_QUOTE`, `QUOTE_ACCEPTED`, `JOB_STATUS_CHANGED`, `WORKER_LOCATION`.
- **Shop Orders**: `ORDER_PLACED`, `ORDER_STATUS`, `ORDER_STATUS_CHANGED`, `ORDER_CANCELLED`.
- **Financial & Wallet**: `WALLET_CREDITED`, `WALLET_DEBITED`, `WALLET_TOPUP_APPROVED`, `WALLET_TOPUP_REJECTED`, `PAYOUT_STATUS_UPDATE`.
- **Duty & Subscription**: `FORCED_OFFLINE`, `NEW_NOTIFICATION`.
- **Admin Control**: `DASHBOARD_UPDATE`.

---

## 💰 9. Financial Architecture & Zero-Trust Direct UPI

### 9.1 Pure Direct UPI (NPCI Protocol)

The platform avoids intermediary payment gateway transaction cuts by implementing **Pure Direct UPI**:
1. **URI Construction**:
   ```
   upi://pay?pa={PLATFORM_UPI_ID}&pn={PAYEE_NAME}&am={AMOUNT}&cu=INR&tn={NOTE}&tr={TXN_ID}
   ```
2. **Intent Flow**: The mobile app opens installed UPI apps (Google Pay, PhonePe, Paytm, BHIM, Cred) via native Android intent.
3. **Receipt Handover**: Customer completes payment in their banking app and enters the genuine 12-digit UPI Reference Number (UTR / RRN).

### 9.2 Strict 12-Digit UTR Validation & Blacklist Defense

The function `isValidUtr()` (`backend/src/helpers/upi.helper.js`) prevents fraud:
- **Length & Digits**: Must be exactly 12 numeric digits (`/^\d{12}$/`).
- **Identical Digits**: Rejects all identical digits (e.g., `111111111111`, `000000000000`).
- **Entropy Invariant**: Requires at least **4 unique digits** across the 12 characters.
- **Repetitive Chunks**: Rejects repeated chunks (`121212121212`, `123123123123`, `123412341234`).
- **Sequential Patterns**: Rejects ascending and descending runs (e.g., `123456789012`, `987654321098`).
- **Cross-Flow Anti-Replay (`findUtrUsage`)**: Searches across `WalletTxn`, `Payment`, `WorkerSubscription`, `ShopSubscription`, and `Job` to ensure a single bank UTR can never be redeemed twice.

### 9.3 Double-Entry Platform Ledger (`PlatformLedger`)

Every rupee settled is recorded in the immutable `PlatformLedger`:
- Unique sparse index on `idempotencyKey` (e.g., `settle_job_{id}`, `settle_order_{id}`).
- Records: `grossAmount`, `partnerAmount` (100% of quote / net product sales), `platformFee`, `gstAmount`, `fromAccount`, `toAccount`, and `configSnapshot`.
- **Atomic Settlement**: Uses `findOneAndUpdate` or atomic transactions so that concurrent requests execute exactly once.
- **Reversals**: If an already delivered order is cancelled or disputed, `reverseShopOrderDelivery()` claws back the payout from the shop wallet, reverses the platform fee and GST liabilities in the treasury, refunds the customer, and appends a `REVERSED` ledger record.

---

## 📱 10. Mobile Application Screen & Feature Mapping

The mobile app (`/mobile`) uses React Native 0.85 and Expo with dynamic role-based navigation:

### 10.1 Authentication & Shared Flow (`/src/features/auth`)
- `AppSplashScreen.js`: Resolves stored JWT and redirects based on role.
- `WelcomeScreen.js`: Introduction and brand carousel.
- `RoleSelection.js`: Multi-profile selection (`CUSTOMER`, `WORKER`, `SHOP`).
- `LoginScreen.js`: Phone number entry with auto-formatting.
- `OTPVerifyScreen.js`: 4-digit OTP input with automatic verification.
- `SetMpinScreen.js` / `ForgotPasswordScreen.js`: Quick security PIN management.

### 10.2 Customer Screens (`/src/features/customer`)
- `HomeScreen.js`: Top categories, service search, nearby shops carousel, top pros list.
- `DescribeJobScreen.js`: Service request form with location pinning and time selection.
- `LiveBidsScreen.js` / `QuotesScreen.js`: Real-time radar showing worker bids.
- `LiveTrackingScreen.js`: Real-time map displaying worker travel progress.
- `WorkCompletedScreen.js`: Review completion details and 4-digit OTP handover.
- `CustomerWalletScreen.js` & `WalletTopupScreen.js`: Balance, UPI topup, PDF receipts.
- `ShopScreen.js` & `ShopDetailScreen.js`: Local merchant discovery and catalog.
- `CartScreen.js` & `OrderTrackingScreen.js`: Checkout and live order status.
- `RateExperienceScreen.js`: Mutual reviews.

### 10.3 Worker Screens (`/src/features/worker`)
- `WorkerDashboard.js`: Live duty toggle (`ONLINE`/`OFFLINE`), incoming job alert cards.
- `WorkerJobDetailsScreen.js`: Inspect customer job requests and submit quotes.
- `WorkerNavigateJobScreen.js`: Navigation map with GPS location streaming.
- `WorkerArrivalOTPScreen.js`: Enter customer arrival OTP.
- `WorkerActiveJobScreen.js`: Live task management and chat.
- `WorkerJobCompleteScreen.js`: Job completion request.
- `WorkerEarningsScreen.js`: Net earnings balance, 0% commission statement, payout withdrawal.
- `WorkerManageServicesScreen.js`: Category and skill configuration.
- `WorkerProfileScreen.js`: Document KYC management.

### 10.4 Shop Screens (`/src/features/shop`)
- `ShopDashboardScreen.js`: Store open/closed toggle, today's order metrics, quick actions.
- `ShopOrdersScreen.js` & `ShopOrderDetailScreen.js`: Orders pipeline (`NEW`, `PACKING`, `OUT`, `DELIVERED`).
- `ShopProductsScreen.js`: Inventory management, prices, stock quantities.
- `ShopDeliveryConfigScreen.js`: Radius, delivery fees, and staff assignment.
- `ShopWalletScreen.js`: Instant balance inspection, order credits, payout requests.
- `ShopSettingsScreen.js`: Operating hours, business details, KYC status.

---

## 🗄️ 11. Complete REST API Catalog

Base URL: `https://kwickly-backend-r6zb.onrender.com/api/v1`

### 11.1 Authentication (`/auth`)
- `POST /auth/send-otp`: Request phone OTP (Redis rate-limited).
- `POST /auth/verify-otp`: Validate OTP, issue JWT, cache session.
- `POST /auth/set-mpin`: Configure 4-digit fast-login MPIN.
- `POST /auth/verify-mpin`: Login via MPIN.
- `POST /auth/admin/login`: Administrator email & password authentication.
- `POST /auth/logout`: Blacklist JWT token in Redis.

### 11.2 Customer Services (`/customers`)
- `GET /customers/profile`: Retrieve customer profile and active addresses.
- `PATCH /customers/profile`: Update name, email, avatar, and notification preferences.
- `POST /customers/addresses`: Add new delivery or service address.
- `DELETE /customers/addresses/:id`: Remove saved address.
- `POST /customers/category-suggestions`: Propose a new category or subcategory.

### 11.3 Service Jobs (`/jobs`)
- `POST /jobs`: Create service booking (initiates `BROADCASTING`).
- `GET /jobs/my-jobs`: List user's past and active jobs.
- `GET /jobs/:id`: Job details with populated quotes and worker info.
- `POST /jobs/:id/quote`: Worker submits a price quote.
- `POST /jobs/:id/accept-quote`: Customer accepts quote (sets `ALLOCATED`).
- `PATCH /jobs/:id/status`: Transition job status (`ARRIVING`, `IN_PROGRESS`, `COMPLETED`).
- `POST /jobs/:id/verify-arrival-otp`: Timing-safe arrival OTP verification.
- `POST /jobs/:id/verify-completion-otp`: Timing-safe completion OTP verification & settlement.
- `POST /jobs/:id/cancel`: Cancel job with reason.
- `POST /jobs/:id/review`: Submit star rating and feedback.

### 11.4 Shops, Products & Orders (`/shops`, `/products`, `/shoporders`)
- `GET /shops`: Discover nearby verified stores with spatial query.
- `GET /shops/:id`: Detailed store overview and delivery config.
- `POST /shops`: Register new shop (initiates 14-day free trial).
- `PATCH /shops/my`: Update shop profile (KYC edits forced to PENDING).
- `GET /products?shopId=:id`: Retrieve store catalog.
- `POST /products`: Add product with image and stock.
- `PATCH /products/:id`: Update price, stock, or active state.
- `DELETE /products/:id`: Remove catalog item.
- `POST /shoporders`: Place order (atomically reserves stock).
- `GET /shoporders/my`: Customer or shop order history.
- `PATCH /shoporders/:id/status`: Transition order status (`CONFIRMED`, `PACKING`, `OUT_FOR_DELIVERY`, `DELIVERED` with OTP).
- `POST /shoporders/:id/cancel`: Cancel order (restores reserved stock).

### 11.5 Digital Wallets & Zero-Trust UPI (`/wallet`, `/payments`, `/ledger`)
- `GET /wallet`: Inspect balance and transaction ledger.
- `POST /wallet/topup-upi`: Generate NPCI UPI intent URI.
- `POST /wallet/submit-utr`: Submit 12-digit UTR for zero-trust verification (`PENDING_VERIFICATION`).
- `GET /wallet/receipt/:txnId`: Generate downloadable PDF invoice/receipt.
- `POST /wallet/transfer`: Peer-to-peer wallet transfer.
- `GET /ledger`: Administrative query for immutable double-entry ledger records.

### 11.6 Admin Control Center (`/admin`)
- `GET /admin/dashboard/stats`: Real-time GMV, revenue, and active volume.
- `GET /admin/pending-kyc`: Unified worker and shop KYC verification queue.
- `PATCH /admin/kyc/:type/:id`: Approve or reject KYC documents.
- `GET /admin/wallets/pending-topups`: Pending UPI UTRs awaiting bank verification.
- `POST /admin/wallets/verify-topup`: Approve or reject UPI topup.
- `GET /admin/payouts`: Pending worker and shop withdrawal requests.
- `POST /admin/payouts/:id/process`: Disburse payout with bank UTR validation.
- `GET /admin/settings` & `PATCH /admin/settings`: Operational platform settings.

---

## 🚀 12. Deployment, Monitoring & Verification

### 12.1 Production Deployment

- **Backend (Render)**:
  - Docker container based on `backend/Dockerfile` or `npm ci` + `node src/server.js`.
  - Health check path: `/health` (returns 200 OK when MongoDB Atlas is connected; 503 when disconnected).
  - Background keep-alive helper pinging `/health` every 12 minutes to prevent cloud idle sleeping.
- **Admin Panel (Vercel)**:
  - Build command: `npm run build` (Vite 5).
  - Output directory: `dist`.
  - Configured with SPA rewrite rules in `admin/vercel.json`.
- **Mobile App (Android)**:
  - Universal release APK built via `cd mobile/android && ./gradlew assembleRelease`.
  - Release APK output: `mobile/android/app/build/outputs/apk/release/app-release.apk`.

### 12.2 Verification Checklist & Health Commands

```bash
# 1. API Health Check
curl -s https://kwickly-backend-r6zb.onrender.com/health

# 2. CORS Preflight Verification (Vercel Admin Origin)
curl -si -X OPTIONS https://kwickly-backend-r6zb.onrender.com/api/v1/auth/admin/login \
  -H "Origin: https://kwickly-app.vercel.app" \
  -H "Access-Control-Request-Method: POST" | grep -i access-control

# 3. Admin Production Bundle Verification
curl -s https://kwickly-app.vercel.app/ | grep assets/
```

---

## 🛡️ 13. System Maintenance & Operational Standard

- **Strict No-Breakage Rule**: No controller or helper shall be refactored without verifying role-wise flows against this master document.
- **Zero Third-Party Gateway Bloat**: The platform relies solely on native NPCI Direct UPI and double-entry accounting. Never reintroduce external payment SDKs.
- **Documentation Currency**: All architectural modifications must immediately update this master specification.

