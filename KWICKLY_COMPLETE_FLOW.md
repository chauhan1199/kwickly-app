# Kwickly — Complete System Flow Documentation

> **Version**: 1.0 | **Date**: June 2026
> **Covers**: Backend API, Admin Panel, Mobile App — All Flows

---



## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Technology Stack](#2-technology-stack)
3. [Authentication & Authorization](#3-authentication--authorization)
4. [Backend API — Complete Endpoint Reference](#4-backend-api--complete-endpoint-reference)
5. [Database Schema — All Models](#5-database-schema--all-models)
6. [Mobile App — Complete User Flows](#6-mobile-app--complete-user-flows)
7. [Admin Panel — Complete Operator Flows](#7-admin-panel--complete-operator-flows)
8. [Real-Time Communication (Socket.io)](#8-real-time-communication-socketio)
9. [Payment & Wallet System](#9-payment--wallet-system)
10. [Redis Caching Strategy](#10-redis-caching-strategy)
11. [Security Measures](#11-security-measures)
12. [Error Handling](#12-error-handling)

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENTS                                       │
│                                                                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │   Mobile App      │  │   Admin Panel     │  │   Shop Owner     │  │
│  │   (React Native)  │  │   (React Web)     │  │   (Mobile App)   │  │
│  │                   │  │                   │  │   Same app,      │  │
│  │  3 Roles:         │  │  1 Role:          │  │   SHOP role      │  │
│  │  - Customer       │  │  - Admin          │  │                  │  │
│  │  - Worker         │  │                   │  │                  │  │
│  │  - Shop Owner     │  │                   │  │                  │  │
│  └────────┬──────────┘  └────────┬──────────┘  └────────┬─────────┘  │
│           │                      │                       │            │
└───────────┼──────────────────────┼───────────────────────┼────────────┘
            │    REST API + Socket.io                      │
┌───────────▼──────────────────────▼───────────────────────▼────────────┐
│                    BACKEND API (Node.js + Express 5)                   │
│                                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │  Auth Layer   │  │  RBAC Layer   │  │  Validation   │               │
│  │  JWT + Redis  │  │  4 Roles      │  │  Joi Schemas  │               │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘               │
│         └─────────────────┼─────────────────┘                        │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │                    27 Route Groups (150+ endpoints)           │    │
│  │                                                               │    │
│  │  Auth │ Admin │ Customer │ Worker │ Jobs │ Quotes │ Shop     │    │
│  │  ShopOrder │ Products │ Payments │ Wallet │ Settlements      │    │
│  │  Payouts │ Subscriptions │ Notifications │ Chat │ Cart       │    │
│  │  Categories │ DeliveryStaff │ PaymentMethods │ Settings      │    │
│  │  Promotions │ AdminWallet │ Reports │ Suggestions            │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐    │
│  │  MongoDB    │  │  Redis      │  │  Socket.io  │  │  Razorpay   │    │
│  │  (28 models)│  │  (cache +   │  │  (real-time)│  │  (payments) │    │
│  │             │  │  sessions)  │  │             │  │             │    │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘    │
└───────────────────────────────────────────────────────────────────────┘
```

### Request Flow (Every API Call)

```
Client Request
     │
     ▼
CORS Check ──→ Helmet Headers ──→ Morgan Logging ──→ JSON Parser
     │
     ▼
Rate Limiter (1000 req / 15 min per IP)
     │
     ▼
Route Matching (/api/v1/...)
     │
     ├──→ Public Route? ──→ Controller ──→ Response
     │
     └──→ Protected Route?
              │
              ▼
         authMiddleware()
              │
              ├── Extract Bearer token
              ├── Verify JWT signature + expiry
              ├── Check Redis blacklist (if blacklisted → 401)
              ├── Check Redis session cache (fallback to DB)
              └── Attach req.user
              │
              ▼
         authorize('ROLE')?
              │
              ├── Check req.user.role against allowed list
              └── If not in list → 403
              │
              ▼
         validate(schema)?
              │
              ├── Joi validation (body/query/params)
              └── stripUnknown: true
              │
              ▼
         Controller Logic
              │
              ▼
         successResponse() / errorResponse()
              │
              ▼
         404 Handler (if no route matched)
              │
              ▼
         Global Error Handler (Mongoose/JWT/cast errors)
```

---

## 2. Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Node.js (CommonJS) | — |
| Framework | Express | 5.2.1 |
| Database | MongoDB (Mongoose) | 9.4.1 |
| Cache/PubSub | Redis (ioredis) | 5.10.1 |
| Real-time | Socket.io | 4.8.3 |
| Payments | Razorpay SDK | 2.9.6 |
| Validation | Joi | 18.1.2 |
| Auth | JWT + bcryptjs | 9.0.3 / 3.0.3 |
| File Upload | Multer | 2.1.1 |
| Logging | Winston + Morgan | 3.19.0 / 1.10.1 |
| Security | Helmet + CORS + Rate Limit | 8.1.0 / 8.5.2 |
| Testing | Jest + Supertest | 30.4.2 / 7.2.2 |
| Mobile | React Native | — |
| Admin Panel | React + Tailwind CSS | — |

---

## 3. Authentication & Authorization

### 3.1 Roles

| Role | Constant | Description | Key Permissions |
|------|----------|-------------|-----------------|
| Admin | `ADMIN` | Platform operator | Full CRUD, KYC, settlements, settings, impersonation |
| Customer | `CUSTOMER` | End user | Post jobs, place orders, pay, rate |
| Worker | `WORKER` | Service provider | Bid on jobs, complete work, manage earnings |
| Shop | `SHOP` | Store owner | Manage products, orders, delivery staff, wallet |

### 3.2 Registration Flow (All Roles)

```
1. App Open → Select Role Screen
   ○ I'm a Customer
   ○ I'm a Service Worker
   ○ I'm a Shop Owner

2. Enter Phone Number (+91XXXXXXXXXX)

3. POST /api/v1/auth/send-otp { phone, role }
   → Generate 4-digit OTP
   → Redis: otp:{phone} TTL 5min
   → Rate limit: 3 OTPs per 10min per IP
   → Send OTP via SMS

4. Enter OTP (60-sec countdown + resend)

5. POST /api/v1/auth/verify-otp { phone, otp }
   → Verify OTP against Redis
   → Create/find user (unique per phone+role)
   → Generate JWT (payload: userId, role)
   → Cache session: Redis session:{userId} TTL 24h
   → Return { user, token }
```

### 3.3 Login Flow

```
Option A: OTP Login (Primary)
  POST /send-otp → SMS → POST /verify-otp → JWT

Option B: Password Login
  POST /login { email/phone, password }
  → bcrypt compare
  → Generate JWT
  → Cache session in Redis
  → Return { user, token }

Option C: Check Status (pre-login)
  POST /check-status { phone, role }
  → Returns whether user exists for this phone+role
  → Mobile uses this to show "Login" vs "Register"
```

### 3.4 Token Lifecycle

```
JWT Created
    │
    ├── Stored in client (AsyncStorage / SecureStore)
    ├── Sent as: Authorization: Bearer <token>
    │
    ▼
Auth Middleware (every protected request)
    │
    ├── 1. Extract token from header
    ├── 2. Verify JWT signature + expiry
    ├── 3. Check Redis blacklist → if found, 401
    ├── 4. Check Redis session:{userId} → if found, attach cached user
    ├── 5. Fallback: DB query → cache in Redis
    └── 6. Attach req.user
    │
    ▼
Logout
    │
    ├── POST /auth/logout
    ├── Store token in Redis blacklist: blacklist:{token} (TTL = remaining JWT expiry)
    ├── Invalidate session: delCache(session:{userId})
    └── Return success
```

---

## 4. Backend API — Complete Endpoint Reference

### 4.1 Auth (`/api/v1/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/login` | Public | Email/phone + password login |
| POST | `/check-status` | Public | Check if user exists for phone+role |
| POST | `/send-otp` | Public | Send OTP to phone |
| POST | `/verify-otp` | Public | Verify OTP, get JWT |
| POST | `/forgot-password` | Public | Send reset OTP |
| POST | `/reset-password` | Public | Reset password with OTP |
| POST | `/logout` | Auth | Blacklist JWT |
| PATCH | `/set-password` | Auth | Set/change password |
| GET | `/me` | Auth | Get current user |

### 4.2 Admin (`/api/v1/admin`) — All require ADMIN role

| Method | Path | Description |
|--------|------|-------------|
| GET | `/settings/branding` | **PUBLIC** — Branding info |
| POST | `/upload-image` | Upload image |
| GET | `/stats` | Dashboard stats (cached 5min) |
| GET | `/badges` | Badge counts (cached 1min) |
| GET | `/health` | Platform health (DB, sockets, uptime) |
| GET | `/ledger` | Wallet transaction ledger |
| GET | `/customers` | List customers (paginated, searchable) |
| GET | `/customers/export` | CSV export customers |
| GET | `/customers/:id` | Customer detail + job stats |
| GET | `/customers/:id/jobs` | Customer's jobs |
| GET | `/customers/:id/orders` | Customer's orders |
| POST | `/customers/:id/jobs` | Create job on behalf of customer |
| POST | `/customers/:id/orders` | Create order on behalf of customer |
| GET | `/workers` | List workers (paginated, filterable by KYC) |
| GET | `/workers/export` | CSV export workers |
| GET | `/workers/:id` | Worker detail + earnings |
| GET | `/pending-kyc` | Pending KYC (workers + shops) |
| POST | `/users` | Create user (any role) |
| PATCH | `/users/:id` | Update user |
| PATCH | `/users/:id/toggle-status` | Activate/deactivate user |
| DELETE | `/users/:id` | Delete user |
| POST | `/users/:id/impersonate` | Generate impersonation token (1hr) |
| PATCH | `/jobs/:id/details` | Admin update job |
| PATCH | `/workers/:id/kyc` | Approve/reject worker KYC |
| POST | `/workers/:id/kyc-documents` | Upload KYC document |
| DELETE | `/workers/:id/kyc-documents/:docIndex` | Remove KYC document |
| GET | `/shops` | List all shops |
| GET | `/shops/:id` | Shop detail + products + wallet txns |
| POST | `/shops` | Create shop (with owner) |
| PATCH | `/shops/:id` | Full shop update (with logo upload) |
| DELETE | `/shops/:id` | Delete shop + products |
| PATCH | `/shops/:id/kyc` | Approve/reject shop KYC |
| PATCH | `/shops/:id/toggle` | Enable/disable shop |
| POST | `/shops/:id/wallet/credit` | Credit shop wallet from admin |
| POST | `/shops/:id/wallet/debit` | Debit shop wallet to admin |
| POST | `/shops/:id/kyc-doc` | Upload shop KYC doc |
| DELETE | `/shops/:id/kyc-doc/:docIndex` | Delete shop KYC doc |
| PATCH | `/shops/:id/kyc-doc/:docIndex` | Edit shop KYC doc |
| POST | `/shops/:id/payout-methods` | Add shop payout method |
| PATCH | `/shops/:id/payout-methods/:methodId` | Edit shop payout method |
| DELETE | `/shops/:id/payout-methods/:methodId` | Delete shop payout method |
| PATCH | `/shops/:id/payout-methods/:methodId/primary` | Set primary payout |
| PATCH | `/shops/:id/owner` | Update shop owner |
| GET | `/jobs/export` | CSV export jobs |
| GET | `/jobs/:id` | Job detail (with quotes + wallet txns) |
| GET | `/payments/export` | CSV export payments |
| GET | `/payouts` | List payout requests |
| PATCH | `/payouts/:id/status` | Approve/reject payout |
| GET | `/suggestions` | List worker suggestions |
| PATCH | `/suggestions/:id/approve` | Approve suggestion |
| PATCH | `/suggestions/:id/reject` | Reject suggestion |
| GET | `/disputes` | List disputes |
| PATCH | `/disputes/:id/status` | Update dispute status |

**Admin Sub-routes:**

| Prefix | Module |
|--------|--------|
| `/api/v1/admin/jobs` | Job management |
| `/api/v1/admin/reports` | Revenue, performance, retention, demand |
| `/api/v1/admin/categories` | Category CRUD + subcategories |
| `/api/v1/admin/notifications` | Broadcast, activity logs, mark read |
| `/api/v1/admin/settings` | App settings (fees, payment, OTP, etc.) |
| `/api/v1/admin/wallet` | Admin wallet balance + ledger + adjustments |
| `/api/v1/admin/shoporders` | All shop orders |
| `/api/v1/admin/settlements` | Settlement management |
| `/api/v1/admin/promotions` | Promo codes + banners |
| `/api/v1/admin/admin-wallet` | Admin wallet CRUD + bank details |

### 4.3 Customer (`/api/v1/customers`) — All require CUSTOMER role

| Method | Path | Description |
|--------|------|-------------|
| GET | `/me/profile` | Get profile |
| PUT | `/me/profile` | Update profile (with image) |
| DELETE | `/me/account` | Deactivate account |
| POST | `/me/addresses` | Add address |
| PUT | `/me/addresses/:addressId` | Update address |
| DELETE | `/me/addresses/:addressId` | Delete address |
| PATCH | `/me/addresses/:addressId/primary` | Set primary address |
| GET | `/top-pros` | Browse top-rated workers |
| GET | `/jobs/active` | Get current active job |
| GET | `/jobs/:id/receipt` | Get job receipt |
| POST | `/disputes` | Open dispute |
| PUT | `/me/notifications` | Update notification prefs |
| GET | `/workers/:id/profile` | View worker profile |

### 4.4 Worker (`/api/v1/workers`) — All require WORKER role

| Method | Path | Description |
|--------|------|-------------|
| GET | `/me` | Get profile |
| PATCH | `/me/profile` | Partial profile update |
| PUT | `/me/profile` | Full profile update |
| PATCH | `/me/kyc` | Upload KYC document |
| PATCH | `/me/bank` | Update bank details |
| PATCH | `/me/services` | Update service categories |
| PATCH | `/me/location` | Update location |
| PATCH | `/me/online` | Toggle online status |
| GET | `/earnings/summary` | Earnings summary (all-time/month/week) |
| GET | `/earnings/chart` | Earnings chart data |
| GET | `/earnings/transactions` | Earnings transaction list (paginated) |
| POST | `/earnings/withdraw` | Request withdrawal |
| POST | `/category-suggestions` | Suggest new category |
| GET | `/category-suggestions` | View own suggestions |
| POST | `/me/addresses` | Add address |
| PUT | `/me/addresses/:addressId` | Update address |
| DELETE | `/me/addresses/:addressId` | Delete address |
| PATCH | `/me/addresses/:addressId/primary` | Set primary address |

### 4.5 Jobs (`/api/v1/jobs`)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/` | CUSTOMER | Create job (broadcasts to eligible workers) |
| GET | `/my` | CUSTOMER | List my jobs |
| POST | `/:id/pay` | CUSTOMER | Pay for completed job |
| POST | `/:id/rate` | CUSTOMER | Rate completed job |
| GET | `/available` | WORKER | Browse available jobs (geo-filtered) |
| GET | `/worker` | WORKER | List my assigned jobs |
| POST | `/:id/start` | WORKER | Start job (OTP verification) |
| POST | `/:id/complete` | WORKER | Mark job complete |
| GET | `/all` | ADMIN | List all jobs |
| GET | `/disputes` | ADMIN | List cancelled/disputed jobs |
| PATCH | `/:id/cancel` | ADMIN, CUSTOMER | Cancel job |
| PATCH | `/:id/reassign` | ADMIN | Reassign worker |

### 4.6 Quotes (`/api/v1/quotes`)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/` | WORKER | Place quote on job (Haversine ETA) |
| GET | `/worker` | WORKER | List own quotes |
| PATCH | `/:id/withdraw` | WORKER | Withdraw pending quote |
| GET | `/job/:jobId` | CUSTOMER | View quotes for job (with distance) |
| PATCH | `/:id/accept` | CUSTOMER | Accept quote (atomic, generates OTPs) |

### 4.7 Shop (`/api/v1/shops`)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/` | Auth(SHOP) | Create shop |
| GET | `/my` | Auth(SHOP) | Get own shop |
| PATCH | `/my` | Auth(SHOP) | Update own shop |
| PATCH | `/my/owner` | Auth(SHOP) | Update owner name |
| POST | `/my/payout-methods` | Auth(SHOP) | Add payout method |
| POST | `/my/withdraw` | Auth(SHOP) | Request withdrawal |
| PATCH | `/my/payout-methods/:methodId/primary` | Auth(SHOP) | Set primary payout |
| DELETE | `/my/payout-methods/:methodId` | Auth(SHOP) | Delete payout method |
| DELETE | `/my` | Auth(SHOP) | Delete own shop |
| GET | `/:id/delivery-config` | Auth | Get delivery config |
| PATCH | `/:id/delivery-config` | Auth(SHOP) | Update delivery config |
| GET | `/` | Auth | List all shops |
| PATCH | `/:id` | ADMIN | Admin update shop |
| DELETE | `/:id` | ADMIN | Admin delete shop |
| PATCH | `/:id/kyc` | ADMIN | Admin review KYC |
| PATCH | `/:id/toggle` | ADMIN | Admin toggle shop |
| GET | `/:id` | Auth | Browse shop by ID |

### 4.8 Products (`/api/v1/products`)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/` | Auth | List products (filterable by shopId) |
| GET | `/shop` | Auth(SHOP) | Get own shop's products |
| GET | `/:id` | Auth | Get product by ID |
| POST | `/` | SHOP/ADMIN | Create product |
| PATCH | `/:id` | SHOP/ADMIN | Update product |
| DELETE | `/:id` | SHOP/ADMIN | Delete product |

### 4.9 Shop Orders (`/api/v1/shoporders`)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/` | CUSTOMER | Place order (atomic stock reservation) |
| GET | `/customer` | CUSTOMER | Customer's orders |
| POST | `/:id/cancel` | CUSTOMER | Cancel order (restores stock + refund) |
| GET | `/shop` | SHOP | Shop's orders |
| PATCH | `/:id/status` | SHOP | Update order status (with OTP for delivery) |
| GET | `/all` | ADMIN | All orders |
| PATCH | `/:id/status` | ADMIN | Admin update status |
| GET | `/:id` | Auth | Order detail |
| GET | `/:id/invoice` | Auth | HTML invoice |

### 4.10 Payments (`/api/v1/payments`)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/webhook` | PUBLIC | Razorpay webhook (raw body) |
| POST | `/create-order` | Auth | Create Razorpay order |
| POST | `/verify` | Auth | Verify payment signature |
| GET | `/history` | Auth | Payment history |
| GET | `/:orderId` | Auth | Payment by order |
| POST | `/refund` | ADMIN | Issue refund |

### 4.11 Wallet (`/api/v1/wallet`)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/balance` | Auth | Get balance + paginated transactions |
| POST | `/topup` | Auth | Top up wallet (+ optional subscription) |
| POST | `/withdraw` | Auth | Request withdrawal |
| GET | `/transactions` | ADMIN | All transactions (filterable) |
| POST | `/adjust` | ADMIN | Admin credit/debit adjustment |

**GET /wallet/balance Query Params:**
- `page` (default: 1) — Page number
- `limit` (default: 20) — Items per page
- `type` — Filter by transaction type (e.g., `JOB_CREDIT`, `WITHDRAWAL`)

**Response:**
```json
{
  "status": "success",
  "data": {
    "balance": 2500,
    "transactions": [...],
    "total": 45,
    "page": 1,
    "totalPages": 3
  }
}
```

### 4.12 Subscriptions (`/api/v1/subscriptions`)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/plans` | Auth | Browse active plans |
| POST | `/subscribe` | WORKER | Purchase plan (credits wallet) |
| GET | `/my` | WORKER | Own subscription history |
| POST | `/plans` | ADMIN | Create plan |
| PATCH | `/plans/:id` | ADMIN | Update plan |
| DELETE | `/plans/:id` | ADMIN | Deactivate plan |
| GET | `/all` | ADMIN | All subscriptions |

### 4.13 Notifications (`/api/v1/notifications`)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/` | ADMIN | Admin notifications |
| GET | `/activity-logs` | ADMIN | Admin activity log |
| POST | `/broadcast` | ADMIN | Send broadcast |
| GET | `/my` | Auth | User's notifications + unread count |
| PATCH | `/read-all` | ADMIN | Mark all read |
| PATCH | `/:id/read` | ADMIN | Mark one read |

### 4.14 Other Endpoints

| Module | Base Path | Key Endpoints |
|--------|-----------|---------------|
| Chat | `/api/v1/chat` | `GET /history`, `POST /send` |
| Cart | `/api/v1/cart` | `GET /`, `POST /`, `PATCH /:itemId`, `DELETE /:itemId`, `DELETE /clear` |
| Categories | `/api/v1/categories` | `GET /` (public), `POST /` (admin), `PATCH /:id`, `DELETE /:id` |
| Delivery Staff | `/api/v1/delivery-staff` | `GET /`, `POST /`, `PATCH /:staffId`, `DELETE /:staffId` |
| Payment Methods | `/api/v1/payment-methods` | Bank + UPI CRUD |
| Promotions | `/api/v1/promotions` | `GET /banners` (public), `POST /validate`, Admin CRUD |
| Settings | `/api/v1/settings` | `GET /public`, `GET /` (admin), `PATCH /` (admin) |

---

## 5. Database Schema — All Models

### 5.1 Core User Model

**Customer** (single collection, multi-role via `role` field)

```
Customer {
  _id: ObjectId
  role: 'CUSTOMER' | 'WORKER' | 'ADMIN' | 'SHOP'
  phone: String (required, unique per role)
  email: String (sparse, unique per role)
  password: String (bcrypt hashed)
  isVerified: Boolean
  name: String
  profileImage: String

  // Worker-specific
  wallet: {
    balance: Number (default: 0)
    bankDetails: { accountNumber, ifscCode, bankName }
    upiId: String
  }
  kyc: {
    status: 'PENDING' | 'APPROVED' | 'REJECTED'
    documents: [{ type, url, uploadedAt }]
  }
  subscription: {
    planId: String
    expiryDate: Date
    isTrial: Boolean (default: true)
  }
  activeLocation: GeoJSON Point (2dsphere index)
  addresses: [{ isPrimary, label, street, city, area, pincode, location }]
  serviceRadius: Number (default: 10 km)
  services: [{ category (ref), subcategories [], isActive }]
  isOnline: Boolean
  city: String
  bio: String
  rating: { average: Number, count: Number }
  notificationPreferences: { jobUpdates, promotions }
}
```

### 5.2 Service Marketplace Models

**Job** — Service job lifecycle
```
Job {
  customerId → Customer
  workerId → Customer (WORKER)
  category, subcategory
  description, media[]
  preferredDate, timeSlot
  status: 'BROADCASTING' → 'QUOTES_RECEIVED' → 'ALLOCATED' → 'ARRIVING'
         → 'IN_PROGRESS' → 'COMPLETED' → 'PAID' → 'CLOSED'
         / 'CANCELLED'
  payment: { amount, platformFee, workerPayout, status, razorpayIds }
  security: { arrivalOtp, completionOtp }
  completionDetails: { media[], report, completedAt }
  rating: { score, review, createdAt }
  location: GeoJSON Point (2dsphere index)
  addressDetails: { city, pincode, area }
}
```

**Quote** — Worker bids on jobs
```
Quote {
  jobId → Job
  workerId → Customer
  amount: Number
  description: String
  timeToReach: Number (minutes, Haversine-computed)
  workerLocation: GeoJSON Point
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN'
  // Unique partial index: one active quote per worker per job
}
```

**Category** — Service categories
```
Category {
  name: String (unique)
  icon: String
  color: String
  description: String
  active: Boolean
  subcategories: [{
    name, description, minPrice, platformFee, suggestedMax, active
  }]
}
```

### 5.3 E-Commerce Models

**Shop** — Storefront
```
Shop {
  ownerId → Customer (unique)
  name, category, description, logoUrl
  subscription: { plan, validUntil }
  address, location: GeoJSON (2dsphere)
  businessHours: { monFri, sat, sun }
  delivery: { radiusKm, fee, freeAbove }
  kyc: { status, documents[] }
  payoutMethods: [{ type: 'BANK'|'UPI', label, detail, isPrimary }]
  wallet: { balance }
  isOnline: Boolean
  rating: Number
  totalOrders: Number
}
```

**Product** — Shop inventory
```
Product {
  shopId → Shop
  name, price, imageUrl, category, brand, unit
  description, stock, minQty
  attributes: [{ key, value }]
  isActive: Boolean
}
```

**ShopOrder** — E-commerce orders
```
ShopOrder {
  orderNumber: String (unique, ORD-YYYY-NNNN)
  shopId → Shop
  customerId → Customer
  items: [{ productId, name, price, qty, imageUrl }]
  subtotal, deliveryFee, discount, total
  deliveryAddress, deliveryLocation: GeoJSON
  deliverySlot: String
  status: 'NEW' → 'CONFIRMED' → 'PACKING' → 'OUT_FOR_DELIVERY'
         → 'DELIVERED' / 'CANCELLED'
  deliveryOtp: String
  deliveryStaffName, deliveryStaffPhone
  statusHistory: [{ status, timestamp, note }]
  payment: { amount, status, method: 'WALLET'|'UPI'|'CASH' }
  promoCode, promoDiscount, invoiceUrl
}
```

**Cart** — Per-customer shopping cart
```
Cart {
  customerId: ObjectId (unique)
  shopId → Shop
  items: [{ productId, name, price, qty, imageUrl, stockAtAdd }]
  totals: { subtotal, deliveryFee, total }
  expiresAt: Date (TTL index)
}
```

### 5.4 Financial Models

**WalletTxn** — Universal wallet ledger
```
WalletTxn {
  userId → Customer
  type: 'JOB_CREDIT' | 'JOB_DEBIT' | 'SUBSCRIPTION' | 'WITHDRAWAL'
       | 'REFUND' | 'ORDER_CREDIT' | 'ORDER_DEBIT' | 'REFERRAL_BONUS'
       | 'ADJUSTMENT' | 'TOPUP' | 'ORDER_PAYMENT'
  amount: Number (always positive)
  balance: Number (wallet balance after this txn)
  status: 'PENDING' | 'COMPLETED' | 'FAILED'
  refId: String (jobId / orderId / subscriptionId)
  description: String
  invoiceUrl: String
  // Indexes: {userId, createdAt}, {userId, type}, {type, createdAt}, {status}
}
```

**Payment** — Razorpay payment tracking
```
Payment {
  orderId → ShopOrder
  razorpayOrderId: String (unique)
  razorpayPaymentId, razorpaySignature
  amount, currency: 'INR'
  status: 'CREATED' | 'AUTHORIZED' | 'CAPTURED' | 'FAILED'
        | 'REFUNDED' | 'PARTIAL_REFUNDED'
  userId → Customer
  metadata: Object
  refundId, refundAmount, failureReason
}
```

**Payout** — Withdrawal requests
```
Payout {
  workerId → Customer (for workers)
  shopId → Shop (for shops)
  amount: Number
  status: 'PENDING' | 'APPROVED' | 'TRANSFERRED' | 'REJECTED'
  paymentMethod: 'UPI' | 'BANK'
  paymentDetails: String
  txnId: String
  walletTxnId → WalletTxn
  rejectReason: String
  processedAt: Date
}
```

**Settlement** — Shop order settlements
```
Settlement {
  type: 'SERVICE_JOB' | 'PRODUCT_ORDER'
  orderId → ShopOrder
  shopId → Shop
  customerId → Customer
  totalAmount, platformCommission, shopEarning
  status: 'PENDING' | 'SETTLED' | 'CANCELLED'
  settledAt: Date
  settledBy → Customer (ADMIN)
  note: String
}
```

**AdminWallet** — Platform treasury
```
AdminWallet {
  balance: Number (min 0)
  bankDetails: { accountHolder, accountNumber, ifscCode, bankName }
  upiId: String
}

AdminWalletTxn {
  type: 'PLATFORM_FEE_COLLECTED' | 'COMMISSION_COLLECTED'
       | 'SETTLEMENT_CREDIT' | 'MANUAL_CREDIT' | 'MANUAL_DEBIT'
       | 'PAYOUT_DEBIT' | 'WORKER_PAYOUT' | 'SHOP_PAYOUT'
       | 'WITHDRAWAL' | 'REFUND_DEBIT' | 'TOPUP'
  amount, balanceAfter
  description, referenceId, referenceModel
  meta: { performedBy }
}
```

### 5.5 Supporting Models

| Model | Purpose |
|-------|---------|
| Notification | Push notifications (broadcast/direct/system/admin activity) |
| Message | Chat messages (jobId, senderId, receiverId, text, media) |
| WorkerSubscription | Worker subscription purchase records |
| SubscriptionPlan | Admin-configured plans (name, duration, price) |
| Banner | Promotional banners (title, image, position, priority) |
| Promotion | Discount codes (FLAT/PERCENTAGE/FREE_DELIVERY/FIRST_ORDER/CASHBACK) |
| DeliveryStaff | Shop delivery personnel (name, phone, activeOrderId) |
| BankAccount | User bank accounts (for payout) |
| UpiAccount | User UPI accounts (for payout) |
| Suggestion | Worker-suggested new categories |
| Dispute | Customer/worker complaints |
| AuditLog | System audit trail |
| AppSettings | Singleton config (fees, payment, OTP, maintenance, branding) |

---

## 6. Mobile App — Complete User Flows

### 6.1 Customer: Service Booking Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 1: BROWSE CATEGORIES                                           │
│                                                                     │
│ App Home → Categories Grid (cached 1hr in Redis)                    │
│ GET /api/v1/categories (PUBLIC)                                     │
│                                                                     │
│ Each category shows: icon, color, name, subcategory count           │
└─────────────────────────────┬───────────────────────────────────────┘
                              │ Tap category
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 2: VIEW SUBCATEGORIES                                          │
│                                                                     │
│ GET /api/v1/categories (filtered by parent)                         │
│                                                                     │
│ Each subcategory shows: name, minPrice, platformFee, suggestedMax   │
│ "Book Now" button on each subcategory                               │
└─────────────────────────────┬───────────────────────────────────────┘
                              │ Tap "Book Now"
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 3: CREATE JOB                                                  │
│                                                                     │
│ POST /api/v1/jobs                                                   │
│ Body: { category, subcategory, description, media[],               │
│         preferredDate, timeSlot, location, addressDetails }         │
│                                                                     │
│ Backend:                                                            │
│   1. Save job with status = BROADCASTING                            │
│   2. Geospatial query: find workers within serviceRadius            │
│   3. Filter: isVerified, KYC approved, online, active subscription  │
│   4. Socket: NEW_JOB_ALERT → all eligible workers                   │
│                                                                     │
│ App shows: "Searching for workers..." animation                     │
└─────────────────────────────┬───────────────────────────────────────┘
                              │ Workers respond
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 4: RECEIVE QUOTES                                              │
│                                                                     │
│ Socket: NEW_QUOTE → Customer                                        │
│ Job status: BROADCASTING → QUOTES_RECEIVED                          │
│                                                                     │
│ GET /api/v1/quotes/job/:jobId                                       │
│ Returns: [{ worker name, rating, amount, timeToReach, distance }]   │
│                                                                     │
│ Customer sees list of quotes sorted by:                             │
│   - Price (low to high)                                             │
│   - Distance (near to far)                                          │
│   - Rating (high to low)                                            │
└─────────────────────────────┬───────────────────────────────────────┘
                              │ Tap "Accept" on a quote
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 5: ACCEPT QUOTE                                                │
│                                                                     │
│ PATCH /api/v1/quotes/:id/accept                                     │
│                                                                     │
│ Backend (ATOMIC):                                                   │
│   1. findOneAndUpdate with status guard (prevents double-accept)    │
│   2. Generate arrival OTP (4-digit, stored on job)                  │
│   3. Generate completion OTP (4-digit, stored on job)               │
│   4. Job status → ALLOCATED                                         │
│   5. Socket: QUOTE_ACCEPTED → worker                                │
│   6. Socket: JOB_TAKEN → customer                                   │
│                                                                     │
│ App shows: Worker details + "Share Arrival OTP" button              │
└─────────────────────────────┬───────────────────────────────────────┘
                              │ Worker arrives
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 6: OTP VERIFICATION (Arrival)                                  │
│                                                                     │
│ Customer shares arrival OTP with worker verbally                    │
│ Worker enters OTP: POST /api/v1/jobs/:id/start { arrivalOtp }       │
│                                                                     │
│ Backend: Validates OTP → Job status → IN_PROGRESS                   │
│ Socket: JOB_STARTED → customer                                      │
│                                                                     │
│ App shows: "Worker is on the way" → "Job in progress"              │
└─────────────────────────────┬───────────────────────────────────────┘
                              │ Worker completes
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 7: WORKER COMPLETES JOB                                        │
│                                                                     │
│ Worker: POST /api/v1/jobs/:id/complete { media, report }            │
│ Backend: Job status → COMPLETED                                     │
│ Socket: JOB_COMPLETED → customer                                    │
│                                                                     │
│ App shows: "Job completed! Please verify and pay"                   │
│ Customer verifies completion OTP                                     │
└─────────────────────────────┬───────────────────────────────────────┘
                              │ Customer pays
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 8: PAYMENT                                                     │
│                                                                     │
│ POST /api/v1/jobs/:id/pay { method, completionOtp }                 │
│                                                                     │
│ Backend:                                                            │
│   1. Validates completion OTP                                       │
│   2. Calculates platform fee (flat or percentage)                   │
│   3. ATOMIC wallet settlement:                                      │
│      - CASH: Worker wallet debited (platform fee)                   │
│      - ONLINE: Customer wallet debited, Worker wallet credited      │
│   4. AdminWallet credited (platform fee)                            │
│   5. Job status → PAID                                              │
│   6. Socket: JOB_PAID → worker                                      │
│                                                                     │
│ App shows: "Payment successful!" + Receipt                          │
└─────────────────────────────┬───────────────────────────────────────┘
                              │ Rate worker
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 9: RATE                                                        │
│                                                                     │
│ POST /api/v1/jobs/:id/rate { score, review }                        │
│                                                                     │
│ Backend: Updates worker rating (running average)                    │
│ Job status: PAID → CLOSED                                           │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 Customer: Product Order Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 1: BROWSE SHOPS                                                │
│                                                                     │
│ GET /api/v1/shops (filtered by customer location + delivery radius)  │
│                                                                     │
│ Each shop shows: name, logo, rating, delivery fee, distance         │
└─────────────────────────────┬───────────────────────────────────────┘
                              │ Tap shop
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 2: VIEW PRODUCTS                                               │
│                                                                     │
│ GET /api/v1/products?shopId=xxx                                     │
│                                                                     │
│ Each product shows: name, price, image, stock status                │
│ "Add to Cart" button                                                │
└─────────────────────────────┬───────────────────────────────────────┘
                              │ Add items
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 3: MANAGE CART                                                 │
│                                                                     │
│ POST /api/v1/cart { productId, qty } — Add item                     │
│ PATCH /api/v1/cart/:itemId { qty } — Update quantity                │
│ DELETE /api/v1/cart/:itemId — Remove item                           │
│ DELETE /api/v1/cart/clear — Clear cart                              │
│                                                                     │
│ Cart auto-expires (TTL index)                                        │
│ One cart per customer per shop                                       │
└─────────────────────────────┬───────────────────────────────────────┘
                              │ Checkout
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 4: PLACE ORDER                                                 │
│                                                                     │
│ POST /api/v1/shoporders                                             │
│ Body: { shopId, items[], deliveryAddress, paymentMethod, promoCode }│
│                                                                     │
│ Backend (ATOMIC):                                                   │
│   1. Validate shop is online + KYC approved                         │
│   2. ATOMIC stock reservation per item:                             │
│      Product.findOneAndUpdate({ stock >= qty })                     │
│      → { $inc: { stock: -qty } }                                   │
│   3. Calculate: subtotal + deliveryFee - discount = total           │
│   4. Validate promo code (if provided)                              │
│   5. If WALLET payment: atomic deduction with balance guard         │
│   6. Create order: status = NEW                                     │
│   7. Socket: NEW_ORDER → shop                                       │
│                                                                     │
│ App shows: "Order placed!" + order tracking                         │
└─────────────────────────────┬───────────────────────────────────────┘
                              │ Shop processes
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 5: ORDER TRACKING                                              │
│                                                                     │
│ Status progression:                                                 │
│   NEW → CONFIRMED → PACKING → OUT_FOR_DELIVERY → DELIVERED         │
│                                                                     │
│ Socket: ORDER_STATUS → customer (real-time updates)                 │
│                                                                     │
│ Customer can cancel (only if status = NEW):                         │
│   POST /api/v1/shoporders/:id/cancel                                │
│   → Restores stock + refunds wallet if paid                         │
└─────────────────────────────┬───────────────────────────────────────┘
                              │ Delivery
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 6: DELIVERY                                                    │
│                                                                     │
│ Shop enters delivery OTP on their device                            │
│ PATCH /api/v1/shoporders/:id/status { status: 'DELIVERED', otp }    │
│                                                                     │
│ Backend:                                                            │
│   1. Validates delivery OTP                                         │
│   2. Creates Settlement record (PENDING)                            │
│   3. Increments shop totalOrders                                    │
│   4. Socket: ORDER_STATUS → customer                                │
│                                                                     │
│ App shows: "Order delivered!" + "Rate order"                        │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.3 Worker Flow

```
ONBOARDING:
  1. Register → OTP → Set password → Select role WORKER
  2. Complete profile: services, location, bio, bank/UPI
  3. Upload KYC documents (Aadhaar, PAN, License)
  4. Free Trial assigned (180 days, 5 quotes/month)
  5. Admin approves KYC → worker becomes active

DAILY WORK:
  1. Go online: PATCH /workers/me/online { isOnline: true }
  2. Receive NEW_JOB_ALERT via socket
  3. View available jobs: GET /jobs/available (geo-filtered)
  4. Place quote: POST /quotes { amount, description, timeToReach }
     → Haversine formula computes ETA from current location
  5. If accepted → travel to location → start with OTP → complete work
  6. Payment auto-credited to wallet

EARNINGS:
  → GET /workers/earnings/summary (all-time, month, week)
  → GET /workers/earnings/chart (daily breakdown)
  → GET /workers/earnings/transactions?page=1&limit=20

WITHDRAWAL:
  → POST /workers/earnings/withdraw { amount, payoutMethod }
  → Creates Payout request (PENDING)
  → Admin approves → bank/UPI transfer
  → Wallet debited: WITHDRAWAL

SUBSCRIPTION:
  → Free trial: 5 quotes/month
  → Paid plan: unlimited quotes
  → GET /subscriptions/plans → POST /subscriptions/subscribe
  → Notification priority: Premium(0min) > Basic(2min) > Free(5min)
```

### 6.4 Shop Owner Flow

```
ONBOARDING:
  1. Register → OTP → Set password → Select role SHOP
  2. Create shop: name, category, address, location
  3. Configure delivery: radius, fee, free-above threshold
  4. Set business hours
  5. Upload KYC + payout methods (BANK/UPI)
  6. Admin approves KYC → shop goes live

PRODUCT MANAGEMENT:
  1. Add products: POST /products { name, price, stock... }
  2. Products visible to customers immediately (no sub req)
  3. Manage inventory: update stock, prices
  4. Toggle product active/inactive

ORDER FULFILLMENT:
  1. Receive NEW_ORDER via socket
  2. Confirm → Packing → Assign delivery staff
  3. Staff delivers → enter delivery OTP
  4. Order complete → settlement created

DELIVERY STAFF:
  → Shop's own physical workers (no app role)
  → Managed via: POST /delivery-staff { name, phone }
  → Assigned to orders by shop owner

FINANCES:
  → Wallet credited on settlement (ORDER_CREDIT)
  → Commission deducted on settlement
  → Withdrawal: POST /shops/my/withdraw
  → Transaction history: GET /wallet/balance
```

---

## 7. Admin Panel — Complete Operator Flows

### 7.1 Dashboard

```
┌─────────────────────────────────────────────────────────────────────┐
│ ADMIN DASHBOARD                                                      │
│                                                                     │
│ GET /api/v1/admin/stats (cached 5min in Redis)                      │
│                                                                     │
│ Displays:                                                           │
│   - Total Users (customers + workers + shops)                       │
│   - Active Workers (online now)                                     │
│   - Total Jobs (all time)                                           │
│   - Total Orders (shop orders)                                      │
│   - Revenue (platform fees + commissions)                           │
│   - Pending KYC count                                               │
│   - Pending Payouts count                                           │
│   - Open Disputes count                                             │
│                                                                     │
│ GET /api/v1/admin/badges (cached 1min)                              │
│   - pendingKYC, pendingPayouts, openDisputes, pendingSuggestions    │
│                                                                     │
│ GET /api/v1/admin/health                                            │
│   - DB status, Redis status, Socket connections, Uptime             │
│                                                                     │
│ Real-time updates via Socket.io: DASHBOARD_UPDATE events            │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.2 User Management

```
┌─────────────────────────────────────────────────────────────────────┐
│ CUSTOMER MANAGEMENT                                                  │
│                                                                     │
│ List: GET /admin/customers?page=1&limit=20&search=xxx               │
│   → Paginated, searchable by name/phone/email                       │
│   → Export: GET /admin/customers/export (CSV)                       │
│                                                                     │
│ Detail: GET /admin/customers/:id                                     │
│   → Profile + job stats + order stats                               │
│                                                                     │
│ Jobs: GET /admin/customers/:id/jobs                                 │
│ Orders: GET /admin/customers/:id/orders                             │
│                                                                     │
│ Create on behalf: POST /admin/customers/:id/jobs                    │
│                   POST /admin/customers/:id/orders                  │
│                                                                     │
│ Actions:                                                            │
│   PATCH /admin/users/:id — Update any field                         │
│   PATCH /admin/users/:id/toggle-status — Activate/Deactivate       │
│   DELETE /admin/users/:id — Delete user                             │
│   POST /admin/users/:id/impersonate — 1hr impersonation token       │
├─────────────────────────────────────────────────────────────────────┤
│ WORKER MANAGEMENT                                                    │
│                                                                     │
│ List: GET /admin/workers?page=1&limit=20&kycStatus=APPROVED         │
│   → Filterable by KYC status                                        │
│   → Export: GET /admin/workers/export (CSV)                         │
│                                                                     │
│ Detail: GET /admin/workers/:id                                      │
│   → Profile + earnings + wallet + KYC status                        │
│                                                                     │
│ KYC:                                                                 │
│   GET /admin/pending-kyc — All pending (workers + shops)            │
│   PATCH /admin/workers/:id/kyc { status: 'APPROVED'|'REJECTED' }    │
│   POST /admin/workers/:id/kyc-documents — Upload doc                │
│   DELETE /admin/workers/:id/kyc-documents/:docIndex                 │
├─────────────────────────────────────────────────────────────────────┤
│ SHOP MANAGEMENT                                                      │
│                                                                     │
│ List: GET /admin/shops                                              │
│ Detail: GET /admin/shops/:id (products + wallet txns)               │
│ Create: POST /admin/shops (with owner account)                      │
│ Update: PATCH /admin/shops/:id                                      │
│ Delete: DELETE /admin/shops/:id (cascades products)                 │
│                                                                     │
│ KYC: PATCH /admin/shops/:id/kyc                                     │
│ Toggle: PATCH /admin/shops/:id/toggle (enable/disable)              │
│                                                                     │
│ Wallet:                                                              │
│   POST /admin/shops/:id/wallet/credit { amount, description }       │
│   POST /admin/shops/:id/wallet/debit { amount, description }        │
│                                                                     │
│ Payout Methods:                                                      │
│   POST /admin/shops/:id/payout-methods                              │
│   PATCH /admin/shops/:id/payout-methods/:methodId                   │
│   DELETE /admin/shops/:id/payout-methods/:methodId                  │
│   PATCH /admin/shops/:id/payout-methods/:methodId/primary           │
│                                                                     │
│ Owner: PATCH /admin/shops/:id/owner                                 │
│                                                                     │
│ KYC Documents:                                                       │
│   POST /admin/shops/:id/kyc-doc                                     │
│   DELETE /admin/shops/:id/kyc-doc/:docIndex                         │
│   PATCH /admin/shops/:id/kyc-doc/:docIndex                          │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.3 Financial Management

```
┌─────────────────────────────────────────────────────────────────────┐
│ ADMIN WALLET                                                        │
│                                                                     │
│ Balance: GET /admin/admin-wallet/balance                            │
│ Ledger: GET /admin/admin-wallet/transactions?page=1&limit=50        │
│ Credit: POST /admin/admin-wallet/credit { amount, description }     │
│ Debit: POST /admin/admin-wallet/debit { amount, description }       │
│ Bank: PATCH /admin/admin-wallet/bank-details                        │
├─────────────────────────────────────────────────────────────────────┤
│ WALLET LEDGER (All Users)                                           │
│                                                                     │
│ GET /wallet/transactions?page=1&limit=50&type=JOB_CREDIT&userId=xxx │
│   → Filterable by type, user, paginated                             │
│                                                                     │
│ POST /wallet/adjust { userId, amount, debit, description }          │
│   → Admin credits/debits any user's wallet                          │
│   → Creates AdminWalletTxn + WalletTxn + Notification               │
├─────────────────────────────────────────────────────────────────────┤
│ PAYOUTS                                                             │
│                                                                     │
│ List: GET /payouts?status=PENDING                                    │
│   → Shows worker/shop name, amount, method, status                  │
│                                                                     │
│ Process: PATCH /payouts/:id/status                                  │
│   { status: 'APPROVED'|'TRANSFERRED'|'REJECTED', txnId, reason }    │
│   → APPROVED: marks payout, admin processes bank transfer           │
│   → REJECTED: refunds amount to user wallet + creates REFUND txn    │
├─────────────────────────────────────────────────────────────────────┤
│ SETTLEMENTS                                                         │
│                                                                     │
│ List: GET /admin/settlements?status=PENDING&type=PRODUCT_ORDER      │
│ Pending: GET /admin/settlements/pending (with total amount)         │
│                                                                     │
│ Settle: POST /admin/settlements/:id/settle                          │
│   { shopAmount, commissionAmount, note }                             │
│   → Credits shop wallet (ORDER_CREDIT)                              │
│   → Collects commission to AdminWallet (COMMISSION_COLLECTED)       │
│                                                                     │
│ Bulk: POST /admin/settlements/bulk-settle { settlementIds[] }       │
├─────────────────────────────────────────────────────────────────────┤
│ JOB MANAGEMENT (Admin)                                              │
│                                                                     │
│ List: GET /admin/jobs?page=1&limit=20&status=COMPLETED              │
│ Export: GET /admin/jobs/export (CSV)                                │
│ Detail: GET /admin/jobs/:id (quotes + wallet txns)                  │
│ Update: PATCH /admin/jobs/:id/details                               │
│ Reassign: PATCH /admin/jobs/:id/reassign { workerId }               │
│ Cancel: PATCH /admin/jobs/:id/cancel                                │
│ Disputes: GET /admin/jobs/disputes                                  │
├─────────────────────────────────────────────────────────────────────┤
│ SHOP ORDERS (Admin)                                                 │
│                                                                     │
│ List: GET /admin/shoporders?status=DELIVERED&shopId=xxx             │
│ Update: PATCH /admin/shoporders/:id/status { status }               │
│ Detail: GET /admin/shoporders/:id                                   │
│ Invoice: GET /admin/shoporders/:id/invoice (HTML)                   │
├─────────────────────────────────────────────────────────────────────┤
│ PAYMENTS                                                            │
│                                                                     │
│ Export: GET /admin/payments/export (CSV)                            │
│ Refund: POST /payments/refund { paymentId, amount, reason }         │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.4 Platform Configuration

```
┌─────────────────────────────────────────────────────────────────────┐
│ CATEGORIES                                                          │
│                                                                     │
│ List: GET /categories (PUBLIC)                                       │
│ Create: POST /admin/categories { name, icon, color }                │
│ Update: PATCH /admin/categories/:id                                 │
│ Delete: DELETE /admin/categories/:id                                │
│                                                                     │
│ Subcategories:                                                      │
│   POST /admin/categories/:id/subcategories { name, minPrice, ... }  │
│   DELETE /admin/categories/:id/subcategories/:subId                 │
│                                                                     │
│ Worker Suggestions:                                                  │
│   GET /admin/categories/suggestions                                 │
│   PATCH /admin/categories/suggestions/:id (approve/reject)          │
├─────────────────────────────────────────────────────────────────────┤
│ SUBSCRIPTION PLANS                                                  │
│                                                                     │
│ List: GET /subscriptions/plans                                      │
│ Create: POST /subscriptions/plans { name, durationDays, price }     │
│ Update: PATCH /subscriptions/plans/:id                              │
│ Delete: DELETE /subscriptions/plans/:id (deactivate)                │
│ All: GET /subscriptions/all                                         │
├─────────────────────────────────────────────────────────────────────┤
│ APP SETTINGS                                                        │
│                                                                     │
│ Public: GET /settings/public (branding, plans, maintenance)         │
│ Full: GET /settings (admin only)                                    │
│ Update: PATCH /settings { key: value }                              │
│                                                                     │
│ Settings sections:                                                   │
│   - fees: fixedThreshold, fixedAmount, percentage                   │
│   - paymentMethods: { cod, upi, wallet }                            │
│   - wallet: minimumBalance, withdrawalLimit                         │
│   - otp: expiryMinutes, length                                      │
│   - maintenance: isOn, message                                      │
│   - branding: logo, primaryColor, secondaryColor                    │
│   - radius: maxKm                                                   │
├─────────────────────────────────────────────────────────────────────┤
│ PROMOTIONS                                                          │
│                                                                     │
│ Banners:                                                             │
│   GET /promotions/banners (public, active only)                     │
│   GET /promotions/banners/all (admin)                               │
│   POST /promotions/banners { title, imageUrl, position, priority }  │
│   PATCH /promotions/banners/:id                                     │
│   DELETE /promotions/banners/:id                                    │
│                                                                     │
│ Promo Codes:                                                        │
│   POST /promotions/validate { code } (auth)                         │
│   GET /promotions/promotions (admin)                                │
│   POST /promotions/promotions { code, type, value, limits }         │
│   PATCH /promotions/promotions/:id                                  │
│   DELETE /promotions/promotions/:id                                 │
├─────────────────────────────────────────────────────────────────────┤
│ NOTIFICATIONS                                                        │
│                                                                     │
│ Admin notifications: GET /notifications                             │
│ Activity logs: GET /notifications/activity-logs                     │
│ Broadcast: POST /notifications/broadcast { title, message, target } │
│ Mark read: PATCH /notifications/read-all                            │
│           PATCH /notifications/:id/read                             │
│                                                                     │
│ User notifications: GET /notifications/my                           │
│   → Returns: { notifications[], unreadCount }                       │
├─────────────────────────────────────────────────────────────────────┤
│ REPORTS                                                             │
│                                                                     │
│ GET /admin/reports/:tab                                             │
│                                                                     │
│ Tabs:                                                               │
│   - revenue: total revenue, commission, payouts by period           │
│   - performance: active workers, completion rate                    │
│   - retention: new vs returning customers                           │
│   - demand: top categories, total jobs                              │
├─────────────────────────────────────────────────────────────────────┤
│ DISPUTES                                                            │
│                                                                     │
│ List: GET /admin/disputes                                           │
│ Update: PATCH /admin/disputes/:id/status { status }                 │
│   → open → in_review → resolved/refunded                            │
│                                                                     │
│ Customer opens: POST /customers/disputes { jobId, issue, reason }   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 8. Real-Time Communication (Socket.io)

### 8.1 Connection

```
Client connects with JWT in auth header
     │
     ▼
Socket.io middleware verifies JWT
     │
     ├── Valid token → connection accepted
     └── Invalid/missing → connection rejected
```

### 8.2 Room System

| Room Pattern | Who Joins | Purpose |
|-------------|-----------|---------|
| `customer_{userId}` | Customer | Job updates, quote notifications |
| `worker_{userId}` | Worker | Job alerts, payment notifications |
| `shop_{shopId}` | Shop Owner | New order alerts, status updates |
| `job_{jobId}` | All parties | Chat messages during job |
| `admin_dashboard` | Admin | Real-time dashboard updates |

### 8.3 Events

| Event | Direction | Payload | When |
|-------|-----------|---------|------|
| `NEW_JOB_ALERT` | Server → Workers | jobId, category, location, description | Job created |
| `NEW_QUOTE` | Server → Customer | quote details, worker info | Worker places quote |
| `QUOTE_ACCEPTED` | Server → Worker | jobId, arrivalOtp | Customer accepts |
| `JOB_TAKEN` | Server → Customer | jobId, worker info | Quote accepted |
| `JOB_STARTED` | Server → Customer | jobId | Worker starts |
| `JOB_COMPLETED` | Server → Customer | jobId | Worker completes |
| `JOB_PAID` | Server → Worker | jobId, amount | Customer pays |
| `NEW_ORDER` | Server → Shop | orderId, total | Customer orders |
| `ORDER_STATUS` | Server → Customer | orderId, status | Shop updates status |
| `NEW_NOTIFICATION` | Server → User | notification object | Any notification |
| `DASHBOARD_UPDATE` | Server → Admin | type, id | Any platform event |
| `WORKER_LOCATION` | Worker → Server | coordinates | Live GPS tracking |
| `NEW_MESSAGE` | Client ↔ Server | message object | Chat during job |
| `OTP_SENT` | Server → Client | otp type | OTP generated |
| `SYNC_STATE_REQUIRED` | Server → Client | — | State desync detected |

### 8.4 Room Join Authorization

```
Worker tries to join room_xxx
     │
     ├── room === "worker_{ownUserId}" → ALLOWED
     ├── room === "job_{jobId}" (if assigned) → ALLOWED
     └── Otherwise → REJECTED

Customer tries to join room_xxx
     │
     ├── room === "customer_{ownUserId}" → ALLOWED
     ├── room === "job_{jobId}" (if their job) → ALLOWED
     └── Otherwise → REJECTED

Shop tries to join room_xxx
     │
     ├── room === "shop_{ownShopId}" → ALLOWED
     └── Otherwise → REJECTED

Admin tries to join room_xxx
     │
     └── ANY room → ALLOWED (admin has full access)
```

---

## 9. Payment & Wallet System

### 9.1 Money Flow Diagram

```
                    ALL MONEY FLOWS HERE FIRST
                           │
                           ▼
┌──────────────────────────────────────────────────┐
│              RAZORPAY (Admin's Account)           │
│                                                   │
│  Customer pays → Razorpay → Admin's bank          │
└──────────────────────────┬───────────────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
    ┌──────────────────┐     ┌──────────────────┐
    │   SERVICE JOBS    │     │  PRODUCT ORDERS   │
    │                   │     │                   │
    │ Platform fee      │     │ Commission        │
    │ deducted from     │     │ deducted on       │
    │ worker earnings   │     │ settlement        │
    │                   │     │                   │
    │ Worker wallet     │     │ Shop wallet       │
    │ ← JOB_CREDIT      │     │ ← ORDER_CREDIT    │
    │                   │     │                   │
    │ Worker withdraws  │     │ Shop withdraws    │
    │ → WITHDRAWAL      │     │ → WITHDRAWAL      │
    │                   │     │                   │
    │ Admin wallet      │     │ Admin wallet      │
    │ ← PLATFORM_FEE    │     │ ← COMMISSION      │
    └──────────────────┘     └──────────────────┘
```

### 9.2 Platform Fee Calculation

```
Settings: fees.fixedThreshold = 500, fees.fixedAmount = 50, fees.percentage = 10

If jobAmount <= 500:
    platformFee = ₹50 (flat)
    workerPayout = jobAmount - 50

If jobAmount > 500:
    platformFee = jobAmount × 10%
    workerPayout = jobAmount - platformFee

Example:
    Job = ₹300 → Fee = ₹50, Worker gets ₹250
    Job = ₹1000 → Fee = ₹100, Worker gets ₹900
```

### 9.3 Wallet Transaction Types

| Type | Direction | When | Who |
|------|-----------|------|-----|
| `JOB_CREDIT` | Credit | Worker completes online job | Worker |
| `JOB_DEBIT` | Debit | Platform fee for cash job | Worker |
| `TOPUP` | Credit | Wallet top-up via payment | Any |
| `WITHDRAWAL` | Debit | Withdrawal request | Worker/Shop |
| `REFUND` | Credit | Order cancelled / payout rejected | Customer/Worker/Shop |
| `ORDER_CREDIT` | Credit | Settlement processed | Shop |
| `ORDER_DEBIT` | Debit | Customer pays for order (wallet) | Customer |
| `ORDER_PAYMENT` | Debit | Customer pays for order | Customer |
| `SUBSCRIPTION` | Debit | Plan purchase | Worker |
| `ADJUSTMENT` | Credit/Debit | Admin manual adjustment | Any |
| `REFERRAL_BONUS` | Credit | Referral reward | Any |

### 9.4 Atomic Safety

All financial mutations use MongoDB `findOneAndUpdate` with balance guards:

```javascript
// This prevents race conditions and negative balances
const updated = await Customer.findOneAndUpdate(
    { _id: userId, 'wallet.balance': { $gte: amount } },
    { $inc: { 'wallet.balance': -amount } },
    { new: true }
);
if (!updated) throw new Error('Insufficient balance');
```

### 9.5 Settlement Flow (Shop Orders)

```
1. Customer places order → pays Razorpay → money in admin account
2. Shop delivers → Settlement record created (PENDING)
3. Admin reviews settlement:
   POST /admin/settlements/:id/settle { shopAmount, commissionAmount }
4. Backend:
   - Shop wallet credited: ORDER_CREDIT
   - Admin wallet credited: COMMISSION_COLLECTED
   - Settlement status → SETTLED
5. Shop can now withdraw from wallet
```

---

## 10. Redis Caching Strategy

| Key Pattern | TTL | Purpose | Invalidated On |
|-------------|-----|---------|----------------|
| `session:{userId}` | 24h | Auth session cache | Profile update, logout, KYC change |
| `otp:{phone}` | 5min | OTP storage | Verification |
| `blacklist:{token}` | JWT expiry | Logout token blacklist | — |
| `admin_dashboard_stats_{range}` | 5min | Dashboard aggregations | Any platform event |
| `admin_badge_counts` | 1min | Pending KYC/payouts/disputes | Any change |
| `categories_list` | 1hr | Category hierarchy | Category CRUD |
| `products_list_{filters}` | 5min | Product listings | Product CRUD |
| `app_settings` | 10min (raw), 24h (flat) | App configuration | Settings update |
| `shops_list_{filters}` | 5min | Shop listings | Shop CRUD |
| `admin_payouts` | 5min | Payout list | Payout status change |

### Cache Invalidation Rules

```
User Profile Update → delCache('session:{userId}')
KYC Status Change → delCache('session:{userId}')
Logout → delCache('session:{userId}') + add to blacklist
Admin Dashboard Change → delCache('admin_dashboard_stats') + delCache('admin_badge_counts')
Category Change → delCache('categories_list')
Product Change → delCache('products_list_*')
Settings Change → delCache('app_settings')
Shop Change → delCache('shops_list_*')
Payout Change → delCache('admin_payouts')
```

---

## 11. Security Measures

| Layer | Measure | Implementation |
|-------|---------|----------------|
| Transport | HTTPS | Enforced via Helmet |
| Headers | Security headers | Helmet (CSP, HSTS, X-Frame-Options) |
| Auth | JWT tokens | Short-lived (configurable), verified per request |
| Token blacklist | Logout invalidation | Redis-backed, TTL = remaining JWT expiry |
| Session cache | Fast auth | Redis 24h TTL, fallback to DB |
| RBAC | Role enforcement | `authorize()` middleware on every protected route |
| Rate limiting | DDoS prevention | Global: 1000/15min, Auth: 5/15min, OTP: 3/10min |
| OTP brute-force | Rate limiting | Redis: max 5 attempts per phone per hour |
| Input validation | Injection prevention | Joi with `stripUnknown: true` |
| Password hashing | Bcrypt | 12 rounds |
| CORS | Origin whitelist | Configurable via ALLOWED_ORIGINS env |
| File upload | Type + size filtering | Images only, 5MB limit |
| Financial ops | Atomic operations | `findOneAndUpdate` with `$gte` balance guards |
| Webhook | HMAC verification | Razorpay signature verification (SHA-256) |
| Socket auth | JWT verification | Middleware on connection |
| Room authorization | Access control | Users can only join their own rooms |
| Impersonation | Short-lived tokens | 1hr expiry, `isImpersonated` flag |
| Graceful degradation | Resilience | Redis/Socket failures don't crash server |
| Body limits | Payload size | 10KB max |

---

## 12. Error Handling

### 12.1 API Response Format

**Success:**
```json
{
  "status": "success",
  "message": "Wallet fetched",
  "data": {
    "balance": 2500,
    "transactions": [...]
  }
}
```

**Error:**
```json
{
  "status": "error",
  "message": "Insufficient wallet balance",
  "errors": null
}
```

### 12.2 Global Error Handler

```
Mongoose ValidationError → 400 (with field errors)
Mongoose DuplicateKeyError → 409 (conflict)
Mongoose CastError → 400 (invalid ID format)
JWT TokenExpiredError → 401 (token expired)
JWT JsonWebTokenError → 401 (invalid token)
Multer FileSizeError → 413 (file too large)
Generic Error → 500 (internal server error)
```

### 12.3 Rate Limit Responses

```
429 Too Many Requests
{
  "status": "error",
  "message": "Too many requests, please try again later"
}
```

---

## Appendix: File Structure

```
backend/
├── src/
│   ├── server.js                    # Entry point, startup sequence
│   ├── app.js                       # Express app configuration
│   ├── config/
│   │   └── db.js                    # MongoDB connection
│   ├── middleware/
│   │   ├── auth.middleware.js        # JWT verification + Redis session
│   │   ├── role.middleware.js        # RBAC enforcement
│   │   ├── validate.middleware.js    # Joi validation wrapper
│   │   ├── rateLimit.middleware.js   # Rate limiting configs
│   │   ├── error.middleware.js       # Global error handler
│   │   └── upload.middleware.js      # Multer file upload config
│   ├── modules/
│   │   ├── admin/                   # Admin controller + routes + reports
│   │   ├── auth/                    # Login, OTP, JWT management
│   │   ├── customer/                # Customer profile + addresses
│   │   ├── worker/                  # Worker profile + earnings + KYC
│   │   ├── job/                     # Job lifecycle management
│   │   ├── quote/                   # Worker quoting system
│   │   ├── shop/                    # Shop CRUD + management
│   │   ├── shoporder/               # E-commerce order lifecycle
│   │   ├── product/                 # Product inventory
│   │   ├── payment/                 # Razorpay integration
│   │   ├── wallet/                  # Wallet + transaction ledger
│   │   ├── settlement/              # Shop order settlements
│   │   ├── payout/                  # Withdrawal processing
│   │   ├── adminWallet/             # Platform treasury
│   │   ├── subscription/            # Plan management
│   │   ├── notification/            # Push notifications
│   │   ├── chat/                    # In-app messaging
│   │   ├── category/                # Service categories
│   │   ├── cart/                    # Shopping cart
│   │   ├── deliveryStaff/           # Shop delivery personnel
│   │   ├── paymentMethod/           # Bank/UPI accounts
│   │   ├── promotion/               # Promo codes + banners
│   │   ├── settings/                # App configuration
│   │   ├── suggestion/              # Worker category suggestions
│   │   ├── dispute/                 # Customer/worker complaints
│   │   └── transaction/             # Legacy transaction model
│   ├── helpers/
│   │   ├── socket.helper.js         # Socket.io initialization
│   │   ├── redis.helper.js          # Redis get/set/del/cache
│   │   ├── razorpay.helper.js       # Razorpay SDK wrapper
│   │   ├── logger.helper.js         # Winston logger config
│   │   ├── response.helper.js       # Standardized responses
│   │   ├── async.helper.js          # Async error wrapper
│   │   ├── seeder.helper.js         # Dev data seeder
│   │   └── adminActivity.helper.js  # Admin action logging
│   ├── services/
│   │   └── sms.service.js           # OTP SMS delivery
│   ├── sockets/
│   │   └── index.js                 # Socket event handlers
│   ├── validators/
│   │   ├── auth.validator.js
│   │   ├── admin.validator.js
│   │   ├── category.validator.js
│   │   ├── dispute.validator.js
│   │   ├── job.validator.js
│   │   ├── product.validator.js
│   │   ├── shop.validator.js
│   │   ├── shoporder.validator.js
│   │   └── wallet.validator.js
│   └── __tests__/                   # Jest test suites
├── package.json
├── .env.example
└── logs/                            # Winston log files
```
