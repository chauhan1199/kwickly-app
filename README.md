# 🚀 Kwickly — On-Demand Services & Hyperlocal E-Commerce Platform
### Master Architecture, System Specification, API Catalog, Platform Flows, Real-Time WebSockets & Deployment Guide

---

## 📌 1. Executive Summary

**Kwickly** is an enterprise-grade, high-concurrency hyperlocal marketplace ecosystem connecting Customers with skilled Service Professionals (Workers) and Local Neighborhood Merchants (Shops).

### Key Highlights:
- **Core Backend Engine** (`/backend`): High-throughput Node.js/Express API with MongoDB Atlas replica set, Upstash Cloud Redis caching, distributed cron engines, and real-time Socket.io bidirectional communications.
- **Admin Control Center** (`/admin`): Real-time React 18 + Vite dashboard with 22 functional modules, live WebSocket metrics, KYC management, financial settlements, subscription plan CRUD, tiered commission configurations, and live promotional banner management.
- **Cross-Platform Mobile Application** (`/mobile`): React Native & Expo mobile app for iOS and Android with unified role switching for Customers, Service Pros (Workers), and Local Shops.

---

## 🌐 2. Live Cloud Production Infrastructure

| Component | Provider / Service | Live Production URL / Connection |
| :--- | :--- | :--- |
| **REST API Server** | Render Cloud (Dockerized Container) | `https://kwickly-backend-r6zb.onrender.com` |
| **WebSocket Server** | Socket.io over SSL / WSS | `wss://kwickly-backend-r6zb.onrender.com` |
| **Admin Control Panel** | Vercel Edge SPA Network | `https://kwickly-app.vercel.app` |
| **Primary Database** | MongoDB Atlas (Replica Set Cluster) | `mongodb+srv://kwickly:Admin%4012@kwickly.bzvkcwl.mongodb.net/kwickly` |
| **Distributed Cache & Locks** | Upstash Cloud Redis Cluster | `rediss://...shining-bobcat-163376.upstash.io:6379` |
| **Media CDN Storage** | Cloudinary Image Cloud (`ap6ozddu`) | `https://res.cloudinary.com/ap6ozddu/image/upload/...` |

---

## 🏗️ 3. System Architecture & High-Level Flow

```
                                  ┌────────────────────────┐
                                  │   Kwickly Mobile App   │
                                  │  (Customer/Worker/Shop)│
                                  └───────────┬────────────┘
                                              │
                         HTTPS REST / Socket  │
                                              ▼
┌─────────────────────────┐       ┌────────────────────────┐       ┌─────────────────────────┐
│   Admin Control Panel   │◄─────►│    Kwickly Backend     │◄─────►│   Upstash Cloud Redis   │
│   (Vercel SPA Dashboard)│       │  (Node.js / Express)   │       │ (< 2ms Hot Cache/Locks) │
└─────────────────────────┘       └───────────┬────────────┘       └─────────────────────────┘
                                              │
                                  ┌───────────┴────────────┐
                                  ▼                        ▼
                      ┌──────────────────────┐  ┌──────────────────────┐
                      │ MongoDB Atlas Clust. │  │ Cloudinary Image CDN │
                      │ (Replica Set / Txns) │  │  (Media & Documents) │
                      └──────────────────────┘  └──────────────────────┘
```

---

## 🔄 4. Core Platform Scenarios & Business Workflows

### 4.1 On-Demand Service Request Flow (Customer ➔ Worker)
```
[Customer] Posts Service Request (Category, Subcategory, Location, Preferred Date/Time)
   │
   ▼
[Job Created] Status: BROADCASTING (Round 1: 15 km Radius)
   │
   ├─► [Cron Sweep (Minute 1)]: If no bid, expands to Round 2 (30 km Radius) ──► WebSocket 'NEW_JOB_ALERT'
   ├─► [Cron Sweep (Minute 2)]: If no bid, expands to Round 3 (45 km Radius)
   └─► [Cron Sweep (Timeout)]: If no pro accepts after Round 3, Auto-Cancels & Notifies Customer
   │
   ▼
[Eligible Workers] Receive live job card and submit customized Quotes (Price, ETA, Notes)
   │
   ▼
[Job Status] Transitions to QUOTES_RECEIVED
   │
   ▼
[Customer] Reviews bids, ratings, distances, and selects preferred Service Pro
   │
   ▼
[Tiered Commission Calculation]:
   • Flat ₹50 Platform Fee for orders < ₹500
   • 12% Percentage Commission for orders ≥ ₹500 + 18% GST on Commission
   │
   ▼
[Worker] Arrives at location ➔ Starts Job (IN_PROGRESS) ➔ Finishes Job (WORK_COMPLETED)
   │
   ▼
[Secure Completion]: Customer verifies work ➔ Provides 4-digit Completion OTP
   │
   ▼
[Payment & Settlement]:
   • Customer pays via Razorpay / Wallet / Cash
   • Platform Commission credited to Admin Platform Wallet
   • Net Worker Payout credited to Worker Balance (Available for instant withdrawal)
```

---

### 4.2 Hyperlocal Shop Ordering Flow (Customer ➔ Shop)
```
[Customer] Browses Nearby Verified Shops (Filtered by Delivery Radius & Active Hours)
   │
   ▼
[Product Catalog] Live stock checks from Redis cache (`products_list_${shopId}`)
   │
   ▼
[Cart & Checkout] Adds items ➔ Enforces single-shop cart rule ➔ Validates Promo Code
   │
   ▼
[Order Created] Status: NEW (Real-time WebSocket event 'NEW_ORDER' sent to Shop Dashboard)
   │
   ├─► [Cron Sweep (Minute 30)]: If shop ignores order for > 30 mins:
   │      • Auto-Cancels order (`CANCELLED`)
   │      • Atomically refunds 100% of payment back to Customer Wallet balance
   │
   ▼
[Shop Owner] Accepts Order (CONFIRMED) ➔ Prepares Items (PACKING) ➔ Dispatches (OUT_FOR_DELIVERY)
   │
   ▼
[Delivery & Handover] Customer receives items ➔ Order Completed (DELIVERED)
   │
   ▼
[Financial Settlement] Shop payout queued with platform order commission deducted
```

---

### 4.3 Worker Onboarding, KYC & Subscription Flow
1. **Registration**: Worker signs up via mobile phone number + SMS OTP verification.
2. **KYC Verification**: Worker uploads Identity Document (Aadhaar / PAN / Driving License) to Cloudinary (`kwickly/kyc`).
3. **Admin Verification**: Admin reviews KYC in `/workers` ➔ Clicks `Approve` or `Reject` (with structured reason).
4. **Subscription Activation**:
   - New workers receive an automatic **Free Trial** (configurable in platform settings, default 14 days).
   - Once expired, worker chooses a plan (`Free Tier`, `Monthly Pro`, `Annual Elite`).
   - If unpaid, background cron takes worker offline (`isOnline: false`) and sends renewal reminders.

---

### 4.4 Shop Registration & 14-Day Trial Flow
1. **Shop Registration**: Merchant creates shop profile with GPS location, business hours, and delivery radius.
2. **Automatic 14-Day Free Trial**: Shop model automatically initializes 14 days of free trial on day 1 (`subscription.status = 'TRIAL'`).
3. **Product Catalog**: Shop owner adds inventory, unit prices, stock levels, and food/item images.
4. **Admin Quick Actions**: Admin can extend trial/subscription with one click (`+30d`, `+90d`) in Admin Panel.

---

## ⏱️ 5. Background Cron Engine & Scheduled Sweeps

All cron tasks use **distributed Redis mutex locks** (`acquireLock` / `releaseLock`) to prevent race conditions across clustered server instances:

| # | Worker Name | Schedule | Redis Lock Key | Purpose & Flow |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Broadcast Expansion** | `* * * * *`<br>*(Every 1 min)* | `cron:broadcast_sweep` | Expands worker search radius (15km ➔ 30km ➔ 45km). Auto-cancels if no worker accepts after 3 rounds. |
| **2** | **Ghost Quotes Sweep** | `* * * * *`<br>*(Every 1 min)* | `cron:job_sweep` | Cleans up stale jobs in `QUOTES_RECEIVED` where the customer stayed inactive for > 2 hours. |
| **3** | **Ghost Orders & Refund** | `*/5 * * * *`<br>*(Every 5 mins)* | `cron:order_sweep` | Auto-cancels shop orders ignored for > 30 mins. **Atomically refunds 100% of payment back to Customer Wallet**. |
| **4** | **Offline Expiry Sweep** | `*/10 * * * *`<br>*(Every 10 mins)* | `cron:worker_sweep` | Forces expired workers and shops offline (`FORCED_OFFLINE`) so they cannot receive jobs without renewing. |
| **5** | **Daily Subscription Cron** | `0 0 * * *`<br>*(Daily 00:00 UTC)* | `cron:daily_sub` | Sends **3-day advance expiry warnings** to workers and takes day-0 expired workers offline with push notifications. |

---

## ⚡ 6. High-Performance Redis Caching & Invalidation Matrix

Every high-traffic API endpoint checks **Upstash Cloud Redis first (`< 2ms`)** before querying MongoDB Atlas:

| Cache Key Pattern | TTL | Source Route | Invalidation Event / Trigger |
| :--- | :--- | :--- | :--- |
| `categories_list` | 24 Hours | `GET /api/v1/categories` | Admin creates, edits, toggles, or deletes Category/Subcategory |
| `banners_public_${pos}` | 10 Mins | `GET /api/v1/promotions/banners` | Admin adds, modifies, or deletes a carousel banner |
| `public_settings` | 24 Hours | `GET /api/v1/settings/public` | Admin updates platform fees, branding, logo, or trial days |
| `app_settings` | 10 Mins | `GET /api/v1/settings` | Admin modifies platform operational settings |
| `shops_list_*` | 5 Mins | `GET /api/v1/shops` | Shop updates profile, logo, online status, or KYC verification |
| `products_list_*` | 10 Mins | `GET /api/v1/products` | Shop adds, edits, deletes, or changes price/stock of product |
| `worker_stats_${id}` | 60 Secs | `GET /api/v1/workers/stats` | Status transitions on jobs assigned to that worker |
| `admin_dashboard_stats_*` | 5 Mins | `GET /api/v1/admin/dashboard/stats` | Real-time on job completion, order, payment, refund |
| `admin_badge_counts` | 60 Secs | `GET /api/v1/admin/badges` | Real-time KYC/Payout queue updates |
| `session:${userId}` | 30 Days | Auth Token Verification | Logout, password change, account deletion, or ban |

---

## 📡 7. Real-Time WebSocket Events Catalog

The platform communicates over bidirectional WebSockets via `Socket.io`:

| Event Name | Direction | Target Room / Channel | Description & Payload |
| :--- | :--- | :--- | :--- |
| `NEW_JOB_ALERT` | Server ➔ Worker | `worker_${workerId}` | Sent when customer broadcasts a job within worker's radius |
| `JOB_RADIUS_EXPANDED` | Server ➔ Customer | `customer_${customerId}` | Notifies customer of radius expansion (Round 2 / 3) |
| `QUOTE_RECEIVED` | Server ➔ Customer | `customer_${customerId}` | Sent when a worker submits a bid/quote |
| `JOB_STATUS_CHANGED` | Server ➔ Both | `customer_${id}` / `worker_${id}` | Notifies on status transitions (`ARRIVING`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`) |
| `NEW_ORDER` | Server ➔ Shop | `shop_${shopId}` | Alerts shop dashboard when customer places an order |
| `ORDER_STATUS` | Server ➔ Customer | `customer_${customerId}` | Order updates (`CONFIRMED`, `PACKING`, `OUT_FOR_DELIVERY`, `DELIVERED`) |
| `FORCED_OFFLINE` | Server ➔ Worker/Shop | `worker_${id}` / `shop_${id}` | Forces offline on subscription/trial expiration |
| `NEW_MESSAGE` | Server ➔ User | `chat_${roomId}` | Real-time instant messaging between customer and worker/shop |
| `DASHBOARD_UPDATE` | Server ➔ Admin | `admin_room` | Triggers live metric counter refresh on Admin dashboard |
| `NEW_NOTIFICATION` | Server ➔ User | User room | In-app notification popups |

---

## 🖥️ 8. Admin Control Center Modules (22 Modules)

| Module Route | Component Path | Purpose & Capabilities |
| :--- | :--- | :--- |
| `/dashboard` | `modules/dashboard/Dashboard.jsx` | Real-time GMV, revenue, active jobs, orders, and interactive analytics charts |
| `/users` | `modules/users/Users.jsx` | Customer registry, wallet adjustments, account ban/unban, view bookings |
| `/workers` | `modules/workers/Workers.jsx` | Worker directory, service skill tags, performance ratings, verification status |
| `/shops` | `modules/shops/Shops.jsx` | Shop registry, active subscription status, +30d/+90d quick extensions |
| `/kyc` | `modules/kyc/KYC.jsx` | Worker & Shop document verification queue with approve/reject actions |
| `/categories` | `modules/categories/Categories.jsx` | 21 service categories + 90 subcategories + Cloudinary icon manager |
| `/jobs` | `modules/jobs/Jobs.jsx` | Real-time job monitor, manual allocation, emergency cancellation |
| `/orders` | `modules/orders/Orders.jsx` | Hyperlocal shop order tracking & dispatch monitor |
| `/disputes` | `modules/disputes/Disputes.jsx` | Customer/Worker dispute resolution with refund & penalty controls |
| `/payouts` | `modules/payouts/Payouts.jsx` | Worker bank/UPI withdrawal processing & approvals |
| `/promotions` | `modules/promotions/Promotions.jsx` | Live carousel banners (`HOME_TOP`, `HOME_MIDDLE`) & coupon codes |
| `/subscriptions` | `modules/subscriptions/Subscriptions.jsx` | Full CRUD subscription plans (`Free Trial`, `Monthly`, `Annual`) |
| `/admin-wallet` | `modules/admin-wallet/AdminWallet.jsx` | Platform commission revenue, GST ledger, and withdrawal tracker |
| `/settings` | `modules/settings/Settings.jsx` | Tiered platform fee configuration, branding logos, trial days |
| `/admin-users` | `modules/admin-users/AdminUsers.jsx` | Admin RBAC user management and sub-admin permissions |
| `/support` | `modules/support/SupportChats.jsx` | Real-time live customer support chat desk |
| `/notifications` | `modules/notifications/Notifications.jsx` | Global push broadcast center & audit logs |
| `/reports` | `modules/reports/Reports.jsx` | Exportable CSV/JSON business intelligence reports |
| `/settlements` | `modules/settlements/Settlements.jsx` | Shop & worker merchant settlements |
| `/wallets` | `modules/wallets/Wallets.jsx` | Customer & worker digital wallet ledger viewer |
| `/ledger` | `modules/ledger/Ledger.jsx` | Master financial transaction audit log |
| `/auth` | `modules/auth/Login.jsx` | Secure administrative JWT login & MFA access |

---

## 📚 9. REST API Catalog

### Base URL: `https://kwickly-backend-r6zb.onrender.com/api/v1`

### 9.1 Authentication (`/auth`)
- `POST /auth/send-otp` — Send OTP to mobile phone number.
- `POST /auth/verify-otp` — Verify OTP and return JWT token + user profile.
- `POST /auth/admin/login` — Email + password login for Platform Administrators.
- `POST /auth/logout` — Blacklist JWT token in Redis and clear session cache.

### 9.2 Service Categories (`/categories`)
- `GET /categories` — List all 21 categories with subcategories and Cloudinary images (Redis-cached).
- `GET /categories/:id` — Get single category with subcategory price matrix.
- `POST /categories` *(Admin)* — Create category with Cloudinary icon upload.
- `PATCH /categories/:id` *(Admin)* — Edit category name, description, color, or status.
- `DELETE /categories/:id` *(Admin)* — Remove category.
- `POST /categories/:id/subcategories` *(Admin)* — Add new subcategory.
- `PATCH /categories/:id/subcategories/:subId` *(Admin)* — Edit subcategory price/fee.
- `DELETE /categories/:id/subcategories/:subId` *(Admin)* — Delete subcategory.

### 9.3 Service Jobs (`/jobs`)
- `POST /jobs` *(Customer)* — Create on-demand or scheduled job broadcast.
- `GET /jobs/active` *(Customer)* — Get currently active booking with worker tracking.
- `GET /jobs/my-jobs` — List past and ongoing bookings.
- `GET /jobs/:id` — Detailed job overview.
- `POST /jobs/:id/quote` *(Worker)* — Submit price quote/bid.
- `POST /jobs/:id/accept-quote` *(Customer)* — Accept worker quote and lock booking.
- `PATCH /jobs/:id/status` — Transition status (`ARRIVING`, `IN_PROGRESS`, `WORK_COMPLETED`).
- `POST /jobs/:id/complete` *(Customer)* — Verify 4-digit OTP and complete job.
- `POST /jobs/:id/cancel` — Cancel job with reason.

### 9.4 Shops & Hyperlocal E-Commerce (`/shops`, `/products`, `/shoporders`)
- `GET /shops` — List nearby verified shops (Redis-cached).
- `GET /shops/:id` — Get shop details, hours, and delivery policies.
- `POST /shops` — Register merchant shop (auto 14-day free trial).
- `PATCH /shops/my` *(Shop)* — Update business profile, hours, and delivery radius.
- `GET /products?shopId=:id` — List shop inventory catalog (Redis-cached).
- `POST /products` *(Shop)* — Add product item with Cloudinary image.
- `PATCH /products/:id` *(Shop)* — Update price, stock, or status.
- `DELETE /products/:id` *(Shop)* — Delete product item.
- `POST /shoporders` *(Customer)* — Place shop order with promo code validation.
- `GET /shoporders/my` — Get order history.
- `PATCH /shoporders/:id/status` *(Shop/Admin)* — Transition order status.

### 9.5 Wallets, Commissions & Financials (`/wallet`, `/admin/wallet`, `/payouts`)
- `GET /wallet` — Get current wallet balance and transaction ledger.
- `POST /wallet/topup` — Create Razorpay order to add funds to wallet.
- `POST /wallet/verify` — Verify Razorpay signature and credit balance.
- `GET /admin/wallet/summary` *(Admin)* — Platform commission earnings and balances.
- `GET /payouts` *(Admin)* — List pending worker withdrawal requests.
- `POST /payouts/:id/process` *(Admin)* — Approve and disburse payout.

### 9.6 Promotions & Banners (`/promotions`)
- `GET /promotions/banners` — Public carousel banners filtered by position (Redis-cached).
- `GET /promotions/promotions` *(Admin)* — List promo discount codes.
- `POST /promotions/banners` *(Admin)* — Create banner with Cloudinary graphic.
- `PATCH /promotions/banners/:id` *(Admin)* — Update banner priority or link.
- `DELETE /promotions/banners/:id` *(Admin)* — Remove banner.
- `POST /promotions/validate` — Validate promo code at checkout.

### 9.7 Platform Settings (`/settings`)
- `GET /settings/public` — Mobile app global configuration & branding (Redis-cached).
- `GET /settings` *(Admin)* — Full operational platform config.
- `PATCH /settings` *(Admin)* — Update platform commission rules, fees, branding, and terms.

---

## 🗄️ 10. Database Schemas & Data Models

### 1. `Customer` (Users & Workers)
- `name`, `phone`, `email`, `role` (`CUSTOMER` | `WORKER` | `ADMIN`).
- `profileImage`, `isVerified`, `isOnline`, `activeLocation` (`Point [lng, lat]`).
- `services`: `[{ category, subcategories, isAvailable }]`.
- `kyc`: `{ status: 'PENDING'|'APPROVED'|'REJECTED', documents: [...] }`.
- `subscription`: `{ status, planId, isTrial, trialEndDate, expiryDate }`.
- `wallet`: `{ balance, isLocked, upiId, bankDetails }`.

### 2. `Shop`
- `ownerId` (ref: `Customer`), `name`, `category`, `logoUrl`, `address`, `location`.
- `businessHours`, `deliveryConfig` (`deliveryRadiusKm`, `minOrderAmount`, `freeDeliveryAbove`, `deliveryCharge`).
- `kyc`: `{ status, documents }`, `wallet: { balance }`, `isOnline`.
- `subscription`: `{ status, planId, isTrial, trialEndDate, expiryDate }`.

### 3. `Category` & Subcategories
- `name`, `description`, `color`, `imageUrl` (Cloudinary CDN URL), `active`.
- `subcategories`: `[{ name, imageUrl, minPrice, platformFee, suggestedMax, active }]`.

### 4. `Job`
- `customerId`, `workerId`, `category`, `subcategory`, `description`, `media`, `location`, `status`.
- `broadcast`: `{ round, radiusKm, lastAttemptAt }`.
- `quotes`: `[{ workerId, amount, estimatedDuration, note, createdAt }]`.
- `payment`: `{ amount, platformFee, workerPayout, paymentMode, status }`.
- `completionDetails`: `{ otp, verifiedAt, customerFeedback }`.

### 5. `ShopOrder`
- `orderNumber`, `customerId`, `shopId`, `items`: `[{ productId, name, price, qty, imageUrl }]`.
- `pricing`: `{ subtotal, deliveryCharge, discount, total }`.
- `status`: `NEW` | `CONFIRMED` | `PACKING` | `OUT_FOR_DELIVERY` | `DELIVERED` | `CANCELLED`.
- `payment`: `{ method, status, transactionId }`.

---

## 📱 11. Mobile App (iOS & Android) Guide

### Architecture:
- **Framework**: React Native + Expo.
- **State Management**: React Context API + React Query.
- **Real-Time**: `socket.io-client` with auto-reconnection.
- **Navigation**: Expo Router (File-based navigation).

### Running Mobile App Locally:
```bash
cd mobile
npm install
npm run start
```
- Press `a` for Android Emulator.
- Press `i` for iOS Simulator.
- Scan QR code with Expo Go on a physical device.

---

## 💻 12. Admin Control Panel Setup & Deployment

### Running Locally:
```bash
cd admin
npm install
npm run dev
```
Local dashboard runs at `http://localhost:5173`.

### Production Deployment:
The Admin panel is configured for **Vercel Edge Deployment** with client-side SPA routing rules in `admin/vercel.json`. Push to `main` branch auto-deploys to `https://kwickly-app.vercel.app`.

---

## 🧪 13. Testing & Verification Suite

Run the full backend test suite covering models, controllers, cron engines, caching, and financial transactions:

```bash
cd backend
npm test
```

### Key Verified Test Suites:
- `src/__tests__/settings.test.js` — Platform fee configuration & branding.
- `src/__tests__/promotion.test.js` — Banners & promo code checkout rules.
- `src/__tests__/cronEngine.test.js` — Scheduled radius expansion & auto-refunds.
- `src/__tests__/subscriptionCron.test.js` — 3-day warning & grace deactivations.
- `src/__tests__/e2e-worker-flow.test.js` — End-to-end worker assignment & completion.
- `src/__tests__/e2e-shop-flow.test.js` — End-to-end shop order placement & fulfillment.

---

## 🛡️ 14. License & Operations
**Kwickly Platform** is privately licensed and maintained for production operations. All rights reserved.