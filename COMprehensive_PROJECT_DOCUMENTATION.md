# Kwickly Platform — Complete Technical Documentation

> **Version**: 1.0 | **Date**: 2026-07-18 | **Stack**: Node.js/Express + MongoDB + React Admin + React Native

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [Architecture](#2-architecture)
3. [Backend — Complete API Reference](#3-backend-complete-api-reference)
4. [Customer Flow — Complete Lifecycle](#4-customer-flow-complete-lifecycle)
5. [Worker Flow — Complete Lifecycle](#5-worker-flow-complete-lifecycle)
6. [Shop Flow — Complete Lifecycle](#6-shop-flow-complete-lifecycle)
7. [Admin Flow — Complete Management](#7-admin-flow-complete-management)
8. [Real-Time Infrastructure](#8-real-time-infrastructure)
9. [Redis & Caching Strategy](#9-redis--caching-strategy)
10. [Cron Jobs & Background Processing](#10-cron-jobs--background-processing)
11. [Payment & Wallet System](#11-payment--wallet-system)
12. [Validation & Error Handling](#12-validation--error-handling)
13. [Security Architecture](#13-security-architecture)
14. [Database Schema Reference](#14-database-schema-reference)
15. [Frontend — Admin Panel](#15-frontend-admin-panel)
16. [Frontend — Mobile App](#16-frontend-mobile-app)
17. [Integration Points](#17-integration-points)
18. [Suggestions for Improvement](#18-suggestions-for-improvement)

---

## 1. Platform Overview

**Kwickly** is a multi-sided service marketplace connecting **Customers** (who need services), **Workers** (who provide services), and **Shops** (who sell products), managed by an **Admin** panel.

### User Roles
| Role | Purpose | Key Capabilities |
|------|---------|-----------------|
| **CUSTOMER** | End users seeking services/products | Book jobs, shop, wallet, rate workers |
| **WORKER** | Service providers | Accept jobs, quote, track earnings, manage KYC |
| **SHOP** | Product sellers | Manage inventory, fulfill orders, delivery |
| **ADMIN** | Platform operator | Full management, disputes, payouts, settings |

### Core Flows
1. **Service Marketplace**: Customer posts job → Workers bid → Customer selects → Job executed → Payment → Rating
2. **Shop Marketplace**: Customer browses shop → Adds to cart → Places order → Shop fulfills → Delivery with OTP
3. **Wallet System**: Top-up via Razorpay → Pay for services → Workers earn → Withdraw to bank
4. **Subscription System**: Workers/Shops subscribe for visibility → Free trial period → Paid plans

---

## 2. Architecture

### System Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTS                              │
├──────────────┬──────────────┬───────────────────────────────┤
│ Mobile App   │ Mobile App   │ Admin Panel                   │
│ (Customer)   │ (Worker/Shop)│ (React SPA)                   │
│ React Native │ React Native │ React + Vite                  │
└──────┬───────┴──────┬───────┴───────────┬───────────────────┘
       │              │                   │
       └──────────────┼───────────────────┘
                      │ HTTPS / WebSocket
              ┌───────▼────────┐
              │   Express.js   │
              │   + Socket.IO  │
              └───────┬────────┘
                      │
       ┌──────────────┼──────────────┐
       │              │              │
  ┌────▼────┐   ┌─────▼─────┐  ┌────▼────┐
  │ MongoDB │   │   Redis   │  │ Cloudinary│
  │ (Mongoose)│  │ (Cache/   │  │ (Images) │
  │         │   │  Sessions/ │  │          │
  │         │   │  Pub/Sub)  │  │          │
  └─────────┘   └───────────┘  └──────────┘
                      │
              ┌───────▼────────┐
              │   Cron Jobs    │
              │ (Job sweeps,   │
              │  Subscriptions)│
              └────────────────┘
```

### Backend Structure
```
backend/src/
├── server.js                    # Entry point — boots all subsystems
├── app.js                       # Express config, middleware, route mounting
├── config/db.js                 # MongoDB connection (pool: 20)
├── constants/messages.js        # Centralized message strings
├── helpers/                     # Shared utilities (10 files)
│   ├── async.helper.js          # catchAsync wrapper
│   ├── response.helper.js       # successResponse/errorResponse
│   ├── logger.helper.js         # Winston logger
│   ├── redis.helper.js          # Redis client + cache + locks
│   ├── socket.helper.js         # Socket.IO init + emit helpers
│   ├── notifyUser.helper.js     # Notification creation
│   ├── razorpay.helper.js       # Payment gateway wrapper
│   ├── worker.helper.js         # Worker eligibility finder
│   ├── adminActivity.helper.js  # Admin audit logging
│   └── seeder.helper.js         # Dev data seeding
├── middleware/                   # Express middleware (7 files)
│   ├── auth.middleware.js        # JWT auth + Redis session cache
│   ├── role.middleware.js        # RBAC
│   ├── error.middleware.js       # Global error handler
│   ├── rateLimit.middleware.js   # Redis-backed rate limiting
│   ├── validate.middleware.js    # Joi validation
│   ├── sanitize.middleware.js    # NoSQL injection + XSS protection
│   └── upload.middleware.js      # Multer file upload
├── modules/                     # Domain modules (24 total)
│   ├── auth/                    # Registration, login, OTP, JWT
│   ├── admin/                   # Admin management + reports
│   ├── customer/                # Customer profiles + addresses
│   ├── worker/                  # Worker profiles + KYC + earnings
│   ├── job/                     # Service jobs lifecycle
│   ├── quote/                   # Worker bids on jobs
│   ├── category/                # Service categories + subcategories
│   ├── settings/                # Platform configuration
│   ├── wallet/                  # User wallets + transactions
│   ├── notification/            # In-app notifications
│   ├── shop/                    # Shop profiles + delivery
│   ├── product/                 # Shop product inventory
│   ├── shoporder/               # Shop order lifecycle
│   ├── payment/                 # Razorpay payment processing
│   ├── payout/                  # Worker/Shop withdrawal requests
│   ├── settlement/              # Shop payment settlements
│   ├── subscription/            # Worker/Shop subscription plans
│   ├── promotion/               # Banners + promo codes
│   ├── cart/                    # Customer shopping cart
│   ├── chat/                    # In-app messaging
│   ├── dispute/                 # Customer complaints + refunds
│   ├── suggestion/              # Worker category suggestions
│   ├── adminWallet/             # Platform wallet
│   └── deliveryStaff/           # Shop delivery personnel
├── validators/                  # Joi schemas (11 files)
├── sockets/                     # Socket event handlers
├── cron/                        # Scheduled tasks
├── workers/                     # Background job engine
├── services/                    # External service wrappers
└── __tests__/                   # Test suites (32 files, 620 tests)
```

---

## 3. Backend — Complete API Reference

### Authentication (`/api/v1/auth`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/send-otp` | No | Send OTP to phone (rate: 3/10min) |
| POST | `/verify-otp` | No | Verify OTP + create/login user |
| POST | `/check-status` | No | Check if phone+role exists |
| POST | `/login` | No | Email/phone + password login |
| POST | `/forgot-password` | No | Request password reset OTP |
| POST | `/reset-password` | No | Reset password with OTP |
| POST | `/logout` | Yes | Blacklist JWT token |
| PATCH | `/set-password` | Yes | Set/change password |
| GET | `/me` | Yes | Get current user profile |

### Customer (`/api/v1/customers`)
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/me/profile` | Yes | CUSTOMER | Get profile |
| PUT | `/me/profile` | Yes | CUSTOMER | Update profile + image |
| DELETE | `/me/account` | Yes | CUSTOMER | Soft-delete account |
| POST | `/me/addresses` | Yes | CUSTOMER | Add address |
| PUT | `/me/addresses/:id` | Yes | CUSTOMER | Update address |
| DELETE | `/me/addresses/:id` | Yes | CUSTOMER | Delete address |
| PATCH | `/me/addresses/:id/primary` | Yes | CUSTOMER | Set primary |
| PUT | `/me/notifications` | Yes | CUSTOMER | Update notification prefs |
| GET | `/top-pros` | Yes | CUSTOMER | Top 10 rated workers |
| GET | `/jobs/active` | Yes | CUSTOMER | Active job |
| POST | `/disputes` | Yes | CUSTOMER | Open dispute |
| GET | `/workers/:id/profile` | Yes | CUSTOMER | Worker public profile |

### Worker (`/api/v1/workers`)
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/me` | Yes | WORKER | Full profile |
| GET | `/me/stats` | Yes | WORKER | Today's job stats |
| PATCH | `/me/profile` | Yes | WORKER | Update profile |
| PATCH | `/me/services` | Yes | WORKER | Set service categories |
| PATCH | `/me/location` | Yes | WORKER | Update GPS location |
| PATCH | `/me/online` | Yes | WORKER | Toggle online status |
| PATCH | `/me/bank` | Yes | WORKER | Update bank/UPI details |
| PATCH | `/me/kyc` | Yes | WORKER | Upload KYC document |
| GET | `/earnings/summary` | Yes | WORKER | Earnings overview |
| GET | `/earnings/chart` | Yes | WORKER | Earnings chart data |
| POST | `/earnings/withdraw` | Yes | WORKER | Request withdrawal |

### Jobs (`/api/v1/jobs`)
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/` | Yes | CUSTOMER | Create job (auto-broadcasts to workers) |
| GET | `/my` | Yes | CUSTOMER | Customer's jobs |
| GET | `/available` | Yes | WORKER | Available jobs (geo-filtered) |
| GET | `/worker` | Yes | WORKER | Worker's assigned jobs |
| POST | `/:id/start` | Yes | WORKER | Start job (OTP + GPS verify) |
| POST | `/:id/complete` | Yes | WORKER | Mark complete with media |
| POST | `/:id/pay` | Yes | CUSTOMER | Pay for job (CASH/WALLET) |
| POST | `/:id/rate` | Yes | CUSTOMER | Rate 1-5 stars |
| GET | `/:id/receipt` | Yes | Any | Payment receipt |
| PATCH | `/:id/cancel` | Yes | ADMIN/CUSTOMER | Cancel job |
| GET | `/all` | Yes | ADMIN | All jobs (paginated) |
| GET | `/disputes` | Yes | ADMIN | Disputed jobs |

### Quotes (`/api/v1/quotes`)
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/` | Yes | WORKER | Place quote on job |
| GET | `/worker` | Yes | WORKER | Worker's quotes |
| GET | `/job/:jobId` | Yes | CUSTOMER | Quotes for a job |
| PATCH | `/:id/accept` | Yes | CUSTOMER | Accept quote (assigns worker) |
| PATCH | `/:id/withdraw` | Yes | WORKER | Withdraw quote |

### Shop Orders (`/api/v1/shoporders`)
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/` | Yes | CUSTOMER | Place shop order (with OTP) |
| GET | `/customer` | Yes | CUSTOMER | Customer's orders |
| GET | `/shop` | Yes | SHOP | Shop's orders |
| PATCH | `/:id/status` | Yes | SHOP/ADMIN | Update order status |
| GET | `/all` | Yes | ADMIN | All orders |
| GET | `/:id` | Yes | Any | Order detail |
| GET | `/:id/invoice` | Yes | Any | Download invoice |

### Wallet (`/api/v1/wallet`)
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/balance` | Yes | Any | Wallet balance + history |
| POST | `/topup` | Yes | Any | Top-up via Razorpay |
| POST | `/withdraw` | Yes | Any | Withdraw to bank |
| POST | `/adjust` | Yes | ADMIN | Admin credit/debit |
| GET | `/transactions` | Yes | ADMIN | All transactions |

### Shop (`/api/v1/shops`)
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/` | Yes | Any | Create shop |
| GET | `/my` | Yes | SHOP | My shop |
| PATCH | `/my` | Yes | SHOP | Update shop |
| PATCH | `/my/owner` | Yes | SHOP | Update owner name |
| POST | `/my/payout-methods` | Yes | SHOP | Add payout method |
| DELETE | `/:id` | Yes | SHOP/ADMIN | Delete shop |
| GET | `/:id` | Yes | Any | Shop public profile |
| PATCH | `/:id/delivery-config` | Yes | SHOP/ADMIN | Delivery settings |

### Products (`/api/v1/products`)
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/` | Yes | Any | List products |
| GET | `/shop` | Yes | SHOP | My shop's products |
| POST | `/` | Yes | SHOP | Add product |
| PATCH | `/:id` | Yes | SHOP | Update product |
| DELETE | `/:id` | Yes | SHOP | Delete product |

### Promotions (`/api/v1/promotions`)
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/banners` | No | — | Active banners (public) |
| POST | `/validate` | Yes | Any | Validate promo code |
| GET | `/banners/all` | Yes | ADMIN | All banners |
| POST/PATCH/DELETE | `/banners/:id` | Yes | ADMIN | Banner CRUD |
| GET | `/promotions` | Yes | ADMIN | All promos |
| POST/PATCH/DELETE | `/promotions/:id` | Yes | ADMIN | Promo CRUD |

### Admin (`/api/v1/admin`)
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/stats` | Yes | ADMIN | Dashboard stats (5min cache) |
| GET | `/badges` | Yes | ADMIN | Badge counts (1min cache) |
| GET | `/health` | Yes | ADMIN | Platform health |
| GET | `/ledger` | Yes | ADMIN | Transaction ledger |
| GET | `/customers` | Yes | ADMIN | List customers |
| GET | `/workers` | Yes | ADMIN | List workers |
| GET | `/shops` | Yes | ADMIN | List shops |
| GET | `/pending-kyc` | Yes | ADMIN | Pending KYC queue |
| POST | `/users` | Yes | ADMIN | Create user |
| PATCH | `/users/:id` | Yes | ADMIN | Update user |
| PATCH | `/users/:id/toggle-status` | Yes | ADMIN | Enable/disable user |
| DELETE | `/users/:id` | Yes | ADMIN | Soft-delete user |
| POST | `/users/:id/impersonate` | Yes | ADMIN | Impersonate user (1h) |
| PATCH | `/workers/:id/kyc` | Yes | ADMIN | Approve/reject KYC |
| GET | `/payouts` | Yes | ADMIN | Payout requests |
| PATCH | `/payouts/:id/status` | Yes | ADMIN | Process payout |
| GET | `/disputes` | Yes | ADMIN | All disputes |
| PATCH | `/disputes/:id/status` | Yes | ADMIN | Resolve dispute |
| GET | `/reports/:tab` | Yes | ADMIN | Analytics reports |

### Remaining Endpoints
| Module | Key Endpoints |
|--------|---------------|
| **Notifications** | GET `/my`, GET `/unread-count`, PATCH `/read-all`, POST `/broadcast` |
| **Categories** | GET `/` (public), CRUD (admin), subcategory CRUD |
| **Settings** | GET `/public`, GET/` (admin), PATCH `/` (admin) |
| **Subscriptions** | GET `/plans` (public), POST `/subscribe`, GET `/my` |
| **Chat** | GET `/history`, POST `/send`, POST `/mark-read`, GET `/support/threads` |
| **Cart** | GET `/`, POST `/`, PATCH `/:itemId`, DELETE `/:itemId`, DELETE `/clear` |
| **Payouts** | GET `/`, PATCH `/:id/status` |
| **Settlements** | GET `/`, POST `/:id/settle`, POST `/bulk-settle` |
| **Admin Wallet** | GET `/balance`, GET `/transactions`, POST `/credit`, POST `/debit`, PATCH `/bank-details` |
| **Delivery Staff** | GET `/`, POST `/`, PATCH `/:staffId`, DELETE `/:staffId` |
| **Payments** | POST `/webhook`, POST `/create-order`, POST `/verify`, POST `/refund` |

---

## 4. Customer Flow — Complete Lifecycle

### 4.1 Registration & Authentication
```
Customer opens app
  → RoleSelection screen
  → Selects "Customer"
  → LoginScreen: enters phone number
  → POST /auth/send-otp { phone, role: 'CUSTOMER' }
  → OTPVerifyScreen: enters 4-digit code
  → POST /auth/verify-otp { phone, code, role, name }
  → If new user: Account created in Customer model
  → JWT token returned + cached in Redis (24h)
  → AsyncStorage stores token
  → AuthContext updates: userToken, userRole, user
  → RootNavigator switches to CustomerTabs
```

### 4.2 Profile Setup
```
ProfileScreen → EditProfileScreen
  → PUT /customers/me/profile { name, email, profileImage }
  → Image uploaded via Cloudinary (compressed to WebP)
  → Old image cleaned up from Cloudinary
  → Session cache invalidated in Redis

SavedAddressesScreen
  → POST /customers/me/addresses { label, street, city, pincode, location }
  → PUT /customers/me/addresses/:id (update)
  → PATCH /customers/me/addresses/:id/primary (set primary)
  → DELETE /customers/me/addresses/:id (remove)
```

### 4.3 Browse & Book Service
```
HomeScreen
  → GET /categories → displays service categories with images
  → GET /promotions/banners → active banners for carousel
  → GET /customers/top-pros → top 10 rated workers

User selects category → SubCategoriesScreen
  → Displays subcategories with min prices

User selects subcategory → BookServiceScreen
  → GET /customers/me/profile → pre-fill location
  → User selects: date, time slot, location, description
  → POST /jobs { category, description, preferredDate, timeSlot, location, addressDetails }
  → Job created with status: BROADCASTING
  → Backend finds eligible workers via Haversine geo-query
  → Socket emits NEW_JOB_ALERT to each eligible worker
  → Job stored with broadcast radius/round tracking
```

### 4.4 Quote & Selection
```
LiveBidsScreen (polling/socket)
  → GET /quotes/job/:jobId → list of worker quotes
  → Each quote shows: worker name, rating, amount, ETA, pricing breakdown
  → Pricing: workerAmount + platformFee + GST = customerPayable

Customer selects a quote
  → PATCH /quotes/:id/accept
  → Atomic operation with MongoDB transaction:
    1. Quote status → ACCEPTED
    2. All other quotes → REJECTED
    3. Job status → ALLOCATED
    4. Worker assigned to job
    5. OTPs generated (arrival + completion)
    6. Worker wallet balance checked
  → Socket: QUOTE_ACCEPTED to customer, JOB_TAKEN to rejected workers
  → Notifications sent to customer and rejected workers
```

### 4.5 Job Execution
```
LiveTrackingScreen
  → Socket: WORKER_LOCATION updates from worker
  → Real-time GPS tracking on map

Worker arrives → WorkerArrivalOTPScreen
  → Worker enters arrival OTP + GPS coords
  → POST /jobs/:id/start { arrivalOtp, currentCoordinates }
  → GPS geofence check: within 200m of job location
  → Job status → IN_PROGRESS
  → Socket: JOB_STARTED to customer

Worker completes → WorkerJobCompleteScreen
  → POST /jobs/:id/complete { media: [...], report }
  → Job status → COMPLETED
  → Socket: JOB_COMPLETED to customer
```

### 4.6 Payment
```
WorkCompletedScreen → Payment
  → POST /jobs/:id/pay { method: 'CASH' | 'WALLET', completionOtp }
  → If WALLET: atomic deduction from customer wallet
  → If CASH: platform fee + GST deducted from worker wallet
  → Payment breakdown calculated from settings:
    - platformFee = flat amount or percentage
    - gst = platformFee × gstPercentage / 100
    - workerPayout = amount - platformFee - gst (for WALLET)
  → Platform fee collected via AdminWallet
  → Job status → PAID
  → Socket: JOB_PAID to worker
```

### 4.7 Rating & Receipt
```
RateExperienceScreen
  → POST /jobs/:id/rate { score: 1-5, review: "..." }
  → Worker's rolling average rating updated
  → Notification sent to worker

JobReceipt (viewable anytime)
  → GET /jobs/:id/receipt
  → Returns: invoiceId, customer/worker info, breakdown, payment status
```

### 4.8 Shop Order Flow (Alternative to Jobs)
```
ShopScreen → ShopDetailScreen
  → GET /shops/:id → shop details
  → GET /products?shopId=:id → product catalog

CartScreen
  → POST /cart { shopId, productId, qty }
  → Cart stored with 24h TTL (MongoDB auto-deletes)
  → Cross-shop conflict detection (409 CONFLICT)
  → Stock validation on add/update

Place Order
  → POST /shoporders { shopId, items, deliveryAddress, deliveryLocation, paymentMethod }
  → Atomic stock reservation via findOneAndUpdate with $gte guard
  → Promo code validation (if provided)
  → WALLET: atomic customer wallet deduction
  → 4-digit delivery OTP generated
  → Order number: timestamp + random 4 chars
  → Status: NEW

Shop Fulfills
  → PATCH /shoporders/:id/status { status: 'CONFIRMED' }
  → PATCH /shoporders/:id/status { status: 'PACKING' }
  → PATCH /shoporders/:id/status { status: 'OUT_FOR_DELIVERY' }
  → PATCH /shoporders/:id/status { status: 'DELIVERED', otp: '1234' }
  → OTP verified before delivery
  → Settlement created (PENDING status)
  → Commission calculated from settings
```

---

## 5. Worker Flow — Complete Lifecycle

### 5.1 Registration & Setup
```
Worker registers via OTP → role: WORKER
  → Auto-creates free trial subscription (14 days from settings)
  → Profile setup:
    - PATCH /workers/me/services → set service categories
    - PATCH /workers/me/bank → bank/UPI details
    - PATCH /workers/me/kyc → upload KYC document (PAN/Aadhaar)
    → KYC status: PENDING → Admin approves → APPROVED
    → isVerifiedWorker = isVerified AND kyc.status === 'APPROVED'
```

### 5.2 Going Online
```
WorkerDashboard
  → Toggle online status via PATCH /workers/me/online { isOnline: true }
  → Guard: must be isVerifiedWorker (KYC approved + isVerified)
  → Guard: must have active subscription or within 180-day new account window
  → Guard: wallet.balance >= minimumBalance (₹100)
  → Socket joins worker room for job alerts
```

### 5.3 Receiving & Quoting Jobs
```
WorkerDashboard receives NEW_JOB_ALERT via Socket
  → GET /jobs/available → list of matching jobs
  → Each job shows: category, description, distance, ETA, customer rating
  → Eligibility check: category match, geo radius, online, KYC, subscription, wallet

Worker places quote
  → POST /quotes { jobId, amount, description, timeToReach, workerLocation }
  → Guard: KYC approved + subscription valid + wallet >= ₹100
  → Guard: not self-quote, job accepting quotes, no duplicate
  → ETA calculated via Haversine distance
  → Socket: NEW_QUOTE to customer room
  → Job status: BROADCASTING → QUOTES_RECEIVED
```

### 5.4 Job Execution
```
Quote accepted by customer → Socket: QUOTE_ACCEPTED
  → Job status: ALLOCATED
  → Worker assigned, OTPs generated

Worker navigates to job → WorkerNavigateJobScreen
  → Shows customer location, phone number, directions

Worker arrives → WorkerArrivalOTPScreen
  → Customer shares arrival OTP verbally
  → POST /jobs/:id/start { arrivalOtp: '1234', currentCoordinates: [...] }
  → GPS geofence: within 200m of job location
  → Job status: IN_PROGRESS

Worker completes → WorkerJobCompleteScreen
  → POST /jobs/:id/complete { media: ['photo_url'], report: '...' }
  → Job status: COMPLETED
  → Socket: JOB_COMPLETED to customer
```

### 5.5 Earnings & Withdrawal
```
WorkerEarningsScreen
  → GET /workers/earnings/summary → all-time, monthly, weekly totals
  → GET /workers/earnings/chart → daily grouped data
  → GET /workers/earnings/transactions → paginated history

Withdraw
  → POST /workers/earnings/withdraw { amount, payoutMethod: 'UPI' | 'BANK' }
  → Atomic deduction from wallet + minimum balance enforcement
  → Payout record created (PENDING status)
  → Admin processes: approve → transfer → mark complete
```

---

## 6. Shop Flow — Complete Lifecycle

### 6.1 Shop Setup
```
Shop owner registers via OTP → role: SHOP
  → POST /shops { name, category, address, location }
  → Shop created with kyc.status: PENDING
  → Admin approves KYC → APPROVED
  → Shop goes online

ShopProfile management
  → PATCH /shops/my → update name, description, hours
  → PATCH /shops/my/owner → update owner name
  → POST /shops/my/payout-methods → add BANK/UPI
  → PATCH /shops/:id/delivery-config → delivery radius, slots, fees
```

### 6.2 Product Management
```
ShopProductsScreen
  → POST /products { name, price, stock, category, imageUrl }
  → PATCH /products/:id → update price, stock, image
  → DELETE /products/:id → remove product
  → GET /products/shop → list own products
```

### 6.3 Order Fulfillment
```
ShopOrdersScreen
  → GET /shoporders/shop → incoming orders
  → Socket: NEW_ORDER when customer places order

Order lifecycle:
  NEW → CONFIRMED → PACKING → OUT_FOR_DELIVERY → DELIVERED
  ↳ Any status → CANCELLED (with stock restore + wallet refund)

Delivery with OTP:
  → Customer shares delivery OTP
  → PATCH /shoporders/:id/status { status: 'DELIVERED', otp: '1234' }
  → OTP verified, settlement created, commission calculated
```

### 6.4 Delivery Staff
```
ShopDeliveryConfigScreen
  → POST /delivery-staff { name, phone }
  → GET /delivery-staff → list staff
  → PATCH /delivery-staff/:id → update
  → DELETE /delivery-staff/:id → remove (blocked if active delivery)
```

---

## 7. Admin Flow — Complete Management

### 7.1 Dashboard
```
Dashboard.jsx
  → GET /admin/stats → KPIs: users, jobs, revenue, charts
  → Socket: DASHBOARD_UPDATE for real-time refresh
  → Badge counts: pending KYC, payouts, disputes, suggestions
  → 5-min Redis cache for stats
```

### 7.2 User Management
```
Users.jsx (Customers) / Workers.jsx / Shops.jsx
  → GET /admin/customers → paginated list with search
  → POST /admin/users → create user with role
  → PATCH /admin/users/:id → update profile
  → PATCH /admin/users/:id/toggle-status → enable/disable
  → DELETE /admin/users/:id → soft delete
  → POST /admin/users/:id/impersonate → 1h impersonation token
```

### 7.3 KYC Verification
```
KYC.jsx
  → GET /admin/pending-kyc → merged worker + shop KYC queue
  → PATCH /admin/workers/:id/kyc { status: 'APPROVED' | 'REJECTED' }
  → Document preview (images + PDFs)
  → Cloudinary-hosted documents
```

### 7.4 Financial Management
```
Wallets.jsx → User wallets
  → POST /wallet/adjust { userId, amount, type, debit, description }
  → Admin credits/debits from AdminWallet

AdminWallet.jsx → Platform wallet
  → GET /admin/admin-wallet/balance
  → POST /admin/admin-wallet/credit → manual credit
  → POST /admin/admin-wallet/debit → manual debit
  → PATCH /admin/admin-wallet/bank-details → bank/UPI info

Payouts.jsx → Withdrawal processing
  → GET /admin/payouts → pending requests
  → PATCH /admin/payouts/:id/status { status: 'APPROVED' | 'TRANSFERRED' | 'REJECTED' }
  → Transactional: approve credits worker, reject refunds

Settlements.jsx → Shop settlements
  → GET /admin/settlements → pending settlements
  → POST /admin/settlements/:id/settle → settle individual
  → POST /admin/settlements/bulk-settle → settle multiple
  → Credits shop wallet + collects platform commission
```

### 7.5 Dispute Resolution
```
Disputes.jsx
  → GET /admin/disputes → all disputes with populated refs
  → PATCH /admin/disputes/:id/status { status, resolution, refundAmount }
  → Refund flow (transactional):
    1. Credit customer wallet
    2. Create WalletTxn (REFUND)
    3. If PENDING settlement exists → cancel it
    4. If already SETTLED → clawback from provider wallet
    5. Notifications to both parties
```

### 7.6 Settings & Configuration
```
Settings.jsx (6 tabs)
  → Fees & Payments: platform fee type (flat/percent), amount, GST%
  → Wallet & Trials: minimum balance, topup presets, trial days
  → Search Radius: max broadcast radius (km)
  → Branding: app name, logo, icon
  → Legal: terms of service, privacy policy
  → Maintenance: toggle maintenance mode
```

---

## 8. Real-Time Infrastructure

### Socket.IO Architecture
```
┌──────────────────────────────────────────────┐
│ Socket.IO Server (attached to HTTP server)   │
├──────────────────────────────────────────────┤
│ Auth: JWT verification on connection         │
│ Adapter: Redis Pub/Sub (multi-node support)  │
│ Transports: WebSocket + HTTP Long-Polling    │
│ Ping: 20s timeout, 25s interval             │
└──────────────────────────────────────────────┘

Room Structure:
  customer_{userId}   → Customer-specific events
  worker_{userId}     → Worker-specific events
  shop_{shopId}       → Shop-specific events
  job_{jobId}         → Job bidding room
  admin_dashboard     → Admin real-time feed
```

### Socket Events
| Event | Direction | Purpose |
|-------|-----------|---------|
| `NEW_JOB_ALERT` | Server→Worker | New job available for bidding |
| `JOB_RADIUS_EXPANDED` | Server→Customer | Broadcast radius increased |
| `NEW_QUOTE` | Server→Customer | Worker placed a quote |
| `QUOTE_ACCEPTED` | Server→Worker | Customer accepted quote |
| `JOB_TAKEN` | Server→Worker | Job assigned to another worker |
| `WORKER_LOCATION` | Worker→Customer | Real-time GPS tracking |
| `JOIN_JOB_ROOM` | Client→Server | Join job bidding room |
| `SEND_MESSAGE` | Client→Server | In-app chat message |
| `JOB_STARTED` | Server→Customer | Worker started the job |
| `JOB_COMPLETED` | Server→Customer | Worker completed the job |
| `JOB_PAID` | Server→Worker | Customer paid for job |
| `NEW_ORDER` | Server→Shop | New shop order received |
| `ORDER_STATUS` | Server→Customer | Shop order status updated |
| `NEW_NOTIFICATION` | Server→User | Push notification |
| `DASHBOARD_UPDATE` | Server→Admin | Stats refresh needed |
| `FORCED_OFFLINE` | Server→Worker/Shop | Subscription expired |
| `DISPUTE_RESOLVED` | Server→Customer | Dispute resolved |

### Anti-Spoofing
- `WORKER_LOCATION` handler verifies worker is actually assigned to the job via Redis cache lookup `job:{jobId}:assigned_worker`
- `SEND_MESSAGE` verifies `socket.userId === senderId`

---

## 9. Redis & Caching Strategy

### Cache Keys & TTLs
| Key Pattern | TTL | Purpose |
|-------------|-----|---------|
| `session:{userId}` | 24h | User session (full user object) |
| `blacklist:{token}` | Token remaining TTL | Logged-out JWT blacklist |
| `otp:{phone}` | 5min | OTP storage |
| `otp_attempts:{phone}` | 1h | OTP rate limiting |
| `app_settings` | 10min | Platform settings |
| `public_settings` | 24h | Public subset of settings |
| `app_branding` | 24h | App name/logo |
| `admin_dashboard_stats` | 5min | Dashboard KPIs |
| `admin_badges` | 1min | Badge counts |
| `admin_payouts` | 5min | Payout list |
| `categories_list` | 1h | Category catalog |
| `top_pros` | 1h | Top-rated workers |
| `admin_disputes_list` | 1h | Dispute list |
| `job:{jobId}:eligible_workers` | 30min | Eligible workers for broadcasting |
| `job:{jobId}:assigned_worker` | 2h | Worker assignment (anti-spoofing) |

### Cache Stampede Prevention
`fetchWithCache(key, ttl, fetcher)` uses Redis NX lock with 200ms retry to prevent multiple simultaneous DB queries for the same key.

### Distributed Locks
`acquireLock(lockKey, ttl)` / `releaseLock(lockKey)` — used by cron jobs to prevent concurrent execution across multiple server nodes.

### Cache Invalidation
- `delCache(key)` — direct key deletion
- `delCacheByPattern(pattern)` — SCAN-based non-blocking pattern deletion (production-safe)
- Special `admin_dashboard_stats` key auto-invalidates all range-suffixed variants

---

## 10. Cron Jobs & Background Processing

### Subscription Cron (Daily at midnight)
```
1. Find workers/shops with subscription/trial expiring in 3 days
   → Send SUBSCRIPTION_EXPIRING notification
2. Find online workers/shops with expired subscription
   → Set isOnline = false
   → Emit FORCED_OFFLINE socket event
   → Send SUBSCRIPTION_EXPIRED notification
```

### Cron Engine (Background Sweeps)
| Job | Frequency | Purpose | Lock |
|-----|-----------|---------|------|
| `sweepBroadcastingJobs` | Every 1min | Progressive radius expansion for jobs. Round 1→2→3. Auto-cancel after 3 rounds. | Redis lock |
| `sweepGhostQuotes` | Every 1min | Cancel QUOTES_RECEIVED jobs older than 2h | Redis lock |
| `sweepGhostOrders` | Every 5min | Cancel NEW shop orders >30min old. Refund paid orders via wallet. | Redis lock |
| `sweepExpiredSubscriptions` | Every 10min | Force offline workers/shops with expired subscriptions | Redis lock |

### Progressive Job Broadcasting
```
Round 1: Search within initial radius (from settings)
Round 2: Double the radius, wait radiusRound2Wait minutes
Round 3: Triple the radius, wait radiusRound3Wait minutes
After Round 3:
  - Regular jobs: AUTO-CANCELLED
  - Scheduled jobs: Delay 30min, then cancel
```

---

## 11. Payment & Wallet System

### Wallet Architecture
```
┌─────────────────────────────────────────┐
│              AdminWallet                │
│  (Platform's money pool)                │
│  balance, bankDetails, upiId            │
└────────────┬───────────────┬────────────┘
             │               │
    Credits from:     Debits to:
    - Platform fees   - Worker payouts
    - Commissions     - Shop payouts
    - Subscriptions   - Customer refunds
    - Manual topup    - Manual debit
```

### Transaction Types
| WalletTxn Type | Direction | Source |
|---------------|-----------|--------|
| `JOB_CREDIT` | Credit | Worker earns from job |
| `JOB_DEBIT` | Debit | Customer pays for job |
| `ORDER_CREDIT` | Credit | Shop earns from order |
| `ORDER_DEBIT` | Debit | Customer pays for order |
| `TOPUP` | Credit | Razorpay wallet top-up |
| `WITHDRAWAL` | Debit | Worker/Shop withdrawal |
| `REFUND` | Credit | Dispute refund to customer |
| `SUBSCRIPTION` | Debit | Subscription payment |
| `ADJUSTMENT` | Both | Admin manual adjustment |
| `REFERRAL_BONUS` | Credit | Referral reward |
| `PLATFORM_FEE_COLLECTED` | Credit | AdminWallet receives fee |
| `COMMISSION_COLLECTED` | Credit | AdminWallet receives commission |

### Razorpay Integration
```
1. Client creates order: POST /payments/create-order
   → Razorpay order created, Payment record (CREATED)
   → Returns razorpayOrderId + keyId

2. Client opens Razorpay checkout (react-native-razorpay)

3. Client verifies: POST /payments/verify
   → HMAC-SHA256 signature verification (timing-safe)
   → Fetches payment from Razorpay API
   → Updates Payment record (CAPTURED)
   → Updates linked ShopOrder payment.status (PAID)

4. Webhook fallback: POST /payments/webhook
   → Handles payment.captured, payment.failed, refund.created
   → Idempotent via webhookEventId
```

### Atomic Wallet Operations
```javascript
// Atomic credit
await Customer.findByIdAndUpdate(userId, { $inc: { 'wallet.balance': amount } });

// Atomic deduct with minimum balance guard
await Customer.findOneAndUpdate(
  { _id: userId, 'wallet.balance': { $gte: amount + minimumBalance } },
  { $inc: { 'wallet.balance': -amount } }
);
```

---

## 12. Validation & Error Handling

### Validation Pipeline
```
Request → sanitizeMiddleware (NoSQL + XSS) → rateLimiter → authMiddleware
  → roleMiddleware → validate(joiSchema) → controller → response
```

### Error Response Format
```json
{
  "status": "error",
  "message": "Human-readable error",
  "errors": ["Field-specific error 1", "Field-specific error 2"]
}
```

### Error Types Handled
| Error Type | HTTP Status | Handler |
|-----------|-------------|---------|
| Joi validation | 400 | validate.middleware.js |
| Mongoose ValidationError | 400 | error.middleware.js |
| MongoDB Duplicate Key (11000) | 409 | error.middleware.js |
| Invalid ObjectId (CastError) | 400 | error.middleware.js |
| JWT Error | 401 | error.middleware.js |
| Token Expired | 401 | error.middleware.js |
| Rate Limit Exceeded | 429 | rateLimit.middleware.js |
| Not Found (404) | 404 | app.js catch-all |
| Server Error | 500 | error.middleware.js |

### Password Validation
```
Regex: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 digit
- At least 1 special character (@$!%*?&)
```

---

## 13. Security Architecture

### Authentication
- **JWT** with configurable expiry (default 1h)
- Token blacklisting via Redis on logout
- Session caching in Redis (full user object, 24h TTL)
- Impersonation tokens (1h, `isImpersonated: true` flag)

### Authorization
- Role-based access control via `authorize('ADMIN')`, `authorize('WORKER', 'SHOP')`
- Ownership checks in controllers (e.g., customer can only view own jobs)

### Rate Limiting
| Limiter | Limit | Window |
|---------|-------|--------|
| Global | 1000 req/IP | 15 min |
| Auth routes | 5 req/IP | 15 min |
| OTP send | 3 req/IP | 10 min |
| OTP attempts | 5/phone | 1 hour |

### Input Sanitization
- NoSQL injection prevention (strips `$` and `.` keys)
- Prototype pollution prevention (`__proto__`, `constructor`)
- XSS prevention via `xss()` library on all string values
- Joi validation with `stripUnknown: true`

### Payment Security
- Razorpay HMAC-SHA256 signature verification
- **Timing-safe comparison** via `crypto.timingSafeEqual`
- Webhook signature verification (skips if placeholder key)

### Socket Security
- JWT verification on connection
- Anti-spoofing: worker location verified against job assignment in Redis
- Message sender identity verified before broadcast

---

## 14. Database Schema Reference

### Customer (shared model for all roles)
```
Customer {
  role: enum [CUSTOMER, WORKER, ADMIN, SHOP]
  phone: String (unique per role)
  email: String (sparse, unique per role)
  password: String (bcrypt hashed)
  isVerified: Boolean
  name: String
  profileImage: String
  wallet: { balance, bankDetails: { accountNumber, ifscCode, bankName }, upiId }
  kyc: { status: enum [PENDING, APPROVED, REJECTED], documents: [{ type, url, public_id }] }
  subscription: { planId, expiryDate, isTrial, trialEndDate }
  activeLocation: GeoJSON Point
  addresses: [{ isPrimary, label, street, city, pincode, location: GeoJSON }]
  services: [{ category (ref Category), categoryName, subcategories[], isActive }]
  serviceRadius: Number (default 10)
  isOnline: Boolean
  city: String
  rating: { average, count }
  notificationPreferences: { jobUpdates, promotions }
  isDeleted: Boolean
}
```

### Job
```
Job {
  customerId (ref Customer)
  workerId (ref Customer)
  category: String
  description: String
  media: [String]
  preferredDate: Date
  timeSlot: enum [urgent, morning, afternoon, evening]
  status: enum [BROADCASTING, QUOTES_RECEIVED, ALLOCATED, ARRIVING,
                IN_PROGRESS, COMPLETED, PAID, CLOSED, CANCELLED, DISPUTED]
  location: GeoJSON Point
  addressDetails: { city, fullAddress }
  broadcast: { round, lastAttemptAt, radiusKm }
  payment: { amount, platformFee, gst, workerPayout, status, razorpayOrderId }
  security: { arrivalOtp, completionOtp }
  completionDetails: { media[], report, completedAt }
  rating: { score: 1-5, review, createdAt }
  dispute: { reportedBy, reason, status, resolution }
}
```

### Shop
```
Shop {
  ownerId (ref Customer, unique)
  name: String
  category: String
  description: String
  logoUrl: String
  address: String
  location: GeoJSON Point
  businessHours: { monFri, sat, sun }
  delivery: { radiusKm, fee, freeAbove, estimatedMinutes }
  deliveryConfig: { radius, minOrder, discounts[], slots[] }
  kyc: { status, documents[] }
  payoutMethods: [{ type: enum [BANK, UPI], label, detail, isPrimary }]
  wallet: { balance }
  isOnline: Boolean
  rating: { average, count }
  totalOrders: Number
  subscription: { status, planId, expiryDate, isTrial }
}
```

### ShopOrder
```
ShopOrder {
  orderNumber: String (unique)
  shopId (ref Shop)
  customerId (ref Customer)
  items: [{ productId, name, price, qty, imageUrl }]
  subtotal, deliveryFee, discount, total
  deliveryAddress, deliveryLocation: GeoJSON
  status: enum [NEW, CONFIRMED, PACKING, OUT_FOR_DELIVERY, DELIVERED, CANCELLED]
  deliveryOtp: String
  payment: { amount, method: enum [WALLET, UPI, CASH], status }
  promoCode, promoDiscount
  statusHistory: [{ status, timestamp, note }]
}
```

### Quote
```
Quote {
  jobId (ref Job)
  workerId (ref Customer)
  amount: Number
  description: String
  timeToReach: String
  workerLocation: GeoJSON Point
  status: enum [PENDING, ACCEPTED, REJECTED, WITHDRAWN]
}
```

---

## 15. Frontend — Admin Panel

### Tech Stack
- React 18 + Vite
- React Router v6 (26 routes)
- Axios (API client with JWT interceptor)
- Socket.IO client (real-time dashboard)
- Recharts (analytics charts)
- Leaflet/OpenStreetMap (location picker)
- Lucide React (icons)

### State Management
- Local `useState` per component (no Redux)
- `ThemeContext` for dark/light mode
- `useServerPagination` hook for paginated lists

### Key Pages (23 modules)
| Module | Lines | Key Feature |
|--------|-------|-------------|
| Shops | 1,875 | Largest — 7 concerns: CRUD, products, KYC, payouts, wallet, hours, delivery |
| Workers | 815 | Worker CRUD + KYC + services + MapPicker |
| Categories | 923 | Category/subcategory + suggestion approval |
| Promotions | 869 | Banner + promo code management |
| Users | 657 | Customer CRUD with detail tabs |
| Jobs | 441 | Job lifecycle + reassign + impersonate |
| Wallets | 467 | All-user wallet management |
| AdminWallet | 426 | Platform wallet + Razorpay |
| Settings | 409 | 6-tab platform configuration |
| Orders | 311 | Shop order lifecycle |

### Real-Time Features
- Dashboard auto-refreshes on `DASHBOARD_UPDATE` socket event
- Badge counts update in sidebar (KYC, payouts, disputes)
- Support chat with live message delivery

---

## 16. Frontend — Mobile App

### Tech Stack
- React Native (Expo-compatible)
- React Navigation 6 (Stack + Bottom Tabs)
- Socket.IO client
- AsyncStorage
- Axios (API client with 401 interceptor)
- react-native-razorpay
- react-native-maps
- react-native-image-picker

### Navigation Architecture
```
RootNavigator
├── AuthStack (6 screens)
├── CustomerTabs (5 tabs × nested stacks)
│   ├── HomeStack (18 screens)
│   ├── ShopStack (6 screens)
│   ├── BookStack (10 screens)
│   ├── WalletStack (3 screens)
│   └── ProfileStack (12 screens)
├── WorkerTabs (5 tabs × nested stacks)
│   ├── DashboardStack (10 screens)
│   ├── QuotesStack (9 screens)
│   ├── EarningsStack (2 screens)
│   └── ProfileStack (4 screens)
└── ShopTabs (5 tabs × nested stacks)
    ├── DashboardStack (4 screens)
    ├── OrdersStack (3 screens)
    ├── ProductsStack (2 screens)
    ├── WalletStack (2 screens)
    └── SettingsStack (4 screens)
```

### Service Layer (10 services)
| Service | Endpoints | Purpose |
|---------|-----------|---------|
| authService | 9 | Auth flow |
| customerService | 14 | Profile, addresses, disputes |
| workerService | 20+ | Profile, KYC, services, earnings |
| jobService | 18+ | Job lifecycle, quotes, categories |
| shopService | 25+ | Shop, products, orders, wallet |
| walletService | 5 | Wallet operations |
| notificationService | 5 | Notifications |
| chatService | 3 | Messaging |
| settingsService | 1 | Public settings |

### Socket Events Handled
17 event types: NEW_QUOTE, QUOTE_ACCEPTED, JOB_TAKEN, WORKER_LOCATION, NEW_MESSAGE, START_TIMER, JOB_STARTED, JOB_COMPLETED, JOB_PAID, NEW_ORDER, ORDER_STATUS, DASHBOARD_UPDATE, NEW_NOTIFICATION, FORCED_OFFLINE, JOB_RADIUS_EXPANDED, JOB_DISPUTED, DISPUTE_RESOLVED

---

## 17. Integration Points

### Cross-Module Dependencies
```
Job creation → finds eligible workers → emits socket → creates notifications
Quote acceptance → assigns worker → generates OTPs → updates job status → emits sockets
Job payment → deducts wallet → credits worker → collects fee → creates txn → emits socket
Shop order → reserves stock → validates promo → deducts wallet → creates OTP → emits socket
Dispute refund → credits customer → debits provider → cancels settlement → notifies both
Subscription expiry → forces offline → emits socket → sends notification
```

### External Integrations
| Service | Purpose | Configuration |
|---------|---------|---------------|
| Razorpay | Payments | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` |
| Cloudinary | Image hosting | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| Twilio/Fast2SMS | SMS/OTP | `TWILIO_*` or `FAST2SMS_API_KEY` |
| Firebase | Push notifications | `FIREBASE_*` |
| MongoDB | Database | `MONGO_URI` |
| Redis | Cache/Sessions | `REDIS_HOST`, `REDIS_PORT` |

---

## 18. Suggestions for Improvement

### Critical Issues (Fix Immediately)

1. **Double promo usage counting** — `promotion.validatePromoCode` increments `usesCount` on validation, then `shoporder.placeOrder` increments again. Fix: Remove increment from one location, or make `placeOrder` use the already-validated discount.

2. **AdminWallet Razorpay fallback to fake data** — `verifyRazorpayPayment` catches fetch errors and falls back to `{ status: 'captured', amount: 0 }`. This could be exploited if Razorpay is unreachable. Fix: Return error instead of fake success.

3. **Non-atomic wallet operations** — Dispute refunds, settlement credits, and payout refunds use read-modify-write without transactions on standalone MongoDB. Fix: Use `findOneAndUpdate` with `$inc` for all wallet balance operations.

4. **Auth middleware `delCache` not imported** — Line 50 references `delCache` but only `getCache`/`setCache` are imported. Fix: Add `delCache` to the destructured import.

### High Priority (Next Sprint)

5. **Redis `KEYS *` for cache invalidation** — Shop model post-hooks use `KEYS *shops_list*` which is O(n) and blocks Redis. Fix: Replace with `SCAN`-based pattern deletion (already implemented in `delCacheByPattern`).

6. **MongoDB topology internal API** — `mongoose.connection.client.topology.s.description.type` is fragile. Fix: Replace with try/catch on `startSession()` to detect replica set support.

7. **Notification `readBy`/`deletedBy` array growth** — Broadcast notifications accumulate user IDs in arrays, risking MongoDB's 16MB document limit. Fix: Use a separate read-receipt collection for broadcasts.

8. **Invoice HTML XSS** — User-provided names/addresses rendered without escaping. Fix: HTML-escape all dynamic content in invoice templates.

9. **Missing `delCacheByPattern` in Redis mock** — TestSetup.js mocks `redis.helper` but doesn't export `delCacheByPattern`, causing harmless but noisy error logs. Fix: Add to mock.

### Medium Priority (Backlog)

10. **`withdrawSchema` duplicated** in `shop.validator.js` and `wallet.validator.js`. Fix: Extract to shared validator.

11. **`updateShopAdminSchema` lacks `.min(1)`** — Can accept empty object, unlike all other update schemas. Fix: Add `.min(1)`.

12. **Shops.jsx at 1,875 lines** — Handles 7+ concerns. Fix: Split into sub-components (ShopForm, ShopProducts, ShopKYC, ShopPayouts, etc.).

13. **Socket.IO connection patterns** — Three different connection patterns across admin (AppLayout, Dashboard, SupportChats). Fix: Create a shared SocketProvider context.

14. **`shopService.js` duplicates endpoints** — Notification and wallet methods exist in both `shopService` and dedicated services. Fix: Remove duplicates, use dedicated services.

15. **Worker `updateServices` replaces entire array** — No validation that at least one service remains. Fix: Add minimum 1 service requirement.

16. **Cart `sellingPrice` fallback** — `product.sellingPrice || product.price` but Product model has no `sellingPrice` field. Fix: Remove the dead `sellingPrice` reference.

17. **RateExperienceScreen hardcoded worker fallback** — Shows mock data if route params missing. Fix: Navigate back if no worker data.

18. **PaymentMethodsScreen duplicate useEffect** — Two competing hooks for same data. Fix: Remove the second useEffect.

### Low Priority (Enhancements)

19. **Add API response caching headers** — Static data (categories, settings) could benefit from HTTP cache headers.

20. **Implement proper CSRF protection** — State-changing auth routes lack CSRF tokens.

21. **Add request ID tracing** — Unique request ID for debugging across logs.

22. **Implement health check endpoint details** — Current `/health` is minimal; add DB/Redis/Socket status.

23. **Add OpenAPI/Swagger documentation** — Auto-generate from Joi validators.

24. **Implement proper soft-delete for shops** — Current soft-delete doesn't cascade to user account.

25. **Add admin activity export** — Currently only viewable in-app, no CSV/export option.

---

*Document generated from complete codebase analysis of 200+ source files across backend, admin, and mobile applications.*
