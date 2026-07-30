# Kwickly Backend - Complete Architecture Analysis

## Table of Contents
1. [Modules Overview](#1-modules-overview)
2. [Module Details (Endpoints, Models, Controllers)](#2-module-details)
3. [Middleware Catalog](#3-middleware-catalog)
4. [Helpers Catalog](#4-helpers-catalog)
5. [Services Catalog](#5-services-catalog)
6. [Cron Jobs](#6-cron-jobs)
7. [Socket Handlers](#7-socket-handlers)
8. [Validators Catalog](#8-validators-catalog)
9. [Config Files](#9-config-files)
10. [Environment Variables](#10-environment-variables)
11. [Startup Flow (server.js + app.js)](#11-startup-flow)

---

## 1. Modules Overview

| # | Module | Files | Mounted At |
|---|--------|-------|------------|
| 1 | **admin** | admin.controller.js, admin.routes.js, reports.controller.js, reports.routes.js | `/api/v1/admin` |
| 2 | **adminWallet** | adminWallet.model.js, adminWallet.controller.js, adminWallet.service.js, adminWallet.routes.js | `/api/v1/admin/admin-wallet` |
| 3 | **auth** | auth.controller.js, auth.routes.js | `/api/v1/auth` |
| 4 | **cart** | cart.model.js, cart.controller.js, cart.routes.js | `/api/v1/cart` |
| 5 | **category** | category.model.js, category.controller.js, category.routes.js | `/api/v1/categories` |
| 6 | **chat** | message.model.js, chat.controller.js, chat.routes.js | `/api/v1/chat` |
| 7 | **customer** | customer.model.js, customer.controller.js, customer.routes.js | `/api/v1/customers` |
| 8 | **deliveryStaff** | deliveryStaff.model.js, deliveryStaff.controller.js, deliveryStaff.routes.js | `/api/v1/delivery-staff` |
| 9 | **dispute** | dispute.model.js, dispute.controller.js | (used via admin + customer routes) |
| 10 | **job** | job.model.js, job.controller.js, job.routes.js | `/api/v1/jobs` |
| 11 | **notification** | notification.model.js, notification.controller.js, notification.routes.js | `/api/v1/notifications` |
| 12 | **payment** | payment.model.js, payment.controller.js, payment.routes.js | `/api/v1/payments` |
| 13 | **payout** | payout.model.js, payout.controller.js, payout.routes.js | `/api/v1/payouts` |
| 14 | **product** | product.model.js, product.controller.js, product.routes.js | `/api/v1/products` |
| 15 | **promotion** | promotion.model.js, promotion.controller.js, promotion.routes.js | `/api/v1/promotions` |
| 16 | **quote** | quote.model.js, quote.controller.js, quote.routes.js | `/api/v1/quotes` |
| 17 | **settings** | settings.model.js, settings.controller.js, settings.service.js, settings.routes.js | `/api/v1/settings` |
| 18 | **settlement** | settlement.model.js, settlement.controller.js, settlement.routes.js | (mounted under admin) |
| 19 | **shop** | shop.model.js, shop.controller.js, shop.routes.js | `/api/v1/shops` |
| 20 | **shoporder** | shoporder.model.js, shoporder.controller.js, shoporder.routes.js | `/api/v1/shoporders` |
| 21 | **subscription** | subscription.model.js, subscription.controller.js, subscription.routes.js | `/api/v1/subscriptions` |
| 22 | **suggestion** | suggestion.model.js, suggestion.controller.js | (used via admin + worker routes) |
| 23 | **wallet** | wallet.model.js, wallet.controller.js, wallet.routes.js | `/api/v1/wallet` |
| 24 | **worker** | worker.controller.js, worker.routes.js | `/api/v1/workers` |

**Note:** The `customer` and `worker` modules share the same MongoDB collection (`Customer` model) differentiated by the `role` field.

---

## 2. Module Details

### 2.1 auth
**Model:** Uses `Customer` model (`modules/customer/customer.model.js`).
**Roles:** All (CUSTOMER, WORKER, SHOP, ADMIN).

**Endpoints:**
| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| POST | `/api/v1/auth/check-status` | No | authLimiter | Check if user exists, has password |
| POST | `/api/v1/auth/send-otp` | No | otpSendLimiter | Send OTP to phone (Redis-stored, 5 min TTL) |
| POST | `/api/v1/auth/verify-otp` | No | authLimiter | Verify OTP, create user if new, return JWT |
| POST | `/api/v1/auth/login` | No | authLimiter | Login with email/phone + password + role |
| POST | `/api/v1/auth/logout` | Bearer | - | Blacklist token + clear session cache |
| PATCH | `/api/v1/auth/set-password` | Bearer | - | Set/update password (bcrypt, 12 rounds) |
| GET | `/api/v1/auth/me` | Bearer | - | Get current user profile |
| POST | `/api/v1/auth/forgot-password` | No | otpSendLimiter | Send reset OTP |
| POST | `/api/v1/auth/reset-password` | No | authLimiter | Reset password with OTP |

**Controller Logic:**
- **checkStatus** — Finds user by phone+role, returns `{exists, hasPassword}`
- **sendOTP** — Rate-limited OTP sending via SMS service, stored in Redis with 5-min TTL
- **verifyOTP** — Verifies OTP, creates new user if not found, auto-creates Shop for SHOP role, generates JWT, caches session in Redis
- **login** — Email/phone + password login, bcrypt comparison, JWT generation, session caching
- **logout** — JWT blacklisting (Redis), clears session cache
- **setPassword** — Hashes password with bcrypt(12), invalidates session cache
- **getMe** — Returns user with populated services.category
- **forgotPassword/resetPassword** — Password reset flow via OTP

---

### 2.2 customer
**Model:** `Customer` (MongoDB collection `customers`)

**Model Fields:**
```
role: enum[CUSTOMER, WORKER, ADMIN, SHOP] (required)
phone: String (required)
email: String (sparse, lowercase, trimmed)
password: String (bcrypt hashed)
isVerified: Boolean (default: false)
name: String
profileImage: String (Cloudinary URL)

wallet:
  balance: Number (default: 0)
  bankDetails: { accountNumber, ifscCode, bankName }
  upiId: String

kyc:
  status: enum[PENDING, APPROVED, REJECTED] (default: PENDING)
  documents: [{ type: enum[AADHAR, PAN, LICENSE, OTHER], url, public_id, uploadedAt }]

subscription:
  planId: String
  expiryDate: Date
  isTrial: Boolean (default: true)
  trialEndDate: Date

activeLocation: { type: Point, coordinates: [lng, lat], addressDetails: { city, pincode, area } }
addresses: [{ isPrimary, label, street, city, area, pincode, location: GeoJSON Point }] (max 10)
serviceRadius: Number (km, default 10)

services: [{ category: ref->Category, categoryName, subcategories: [String], isActive }] (max 20)
isOnline: Boolean (default: false)
city: String
bio: String
rating: { average: Number, count: Number }
notificationPreferences: { jobUpdates: Boolean, promotions: Boolean }
isDeleted: Boolean (default: false)
deletedAt: Date

timestamps: true
```

**Indexes:** phone+role (unique), email+role (unique partial), 2dsphere on activeLocation, role+phone, role+isOnline+kyc+isVerified, services.category compound geo index, city+role, subscription.expiryDate

**Endpoints (under `/api/v1/customers`):**
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/me/profile` | CUSTOMER | Get own profile |
| PUT | `/me/profile` | CUSTOMER | Update profile (name, email, profile image, wallet bank/UPI) |
| DELETE | `/me/account` | CUSTOMER | Soft-delete account (cancels active jobs/orders) |
| POST | `/me/addresses` | CUSTOMER | Add address (label, street, city, pincode, location) |
| PUT | `/me/addresses/:addressId` | CUSTOMER | Update address |
| DELETE | `/me/addresses/:addressId` | CUSTOMER | Remove address |
| PATCH | `/me/addresses/:addressId/primary` | CUSTOMER | Set primary address |
| GET | `/top-pros` | CUSTOMER | Get top 10 rated verified workers (cached 1h) |
| GET | `/jobs/active` | CUSTOMER | Get current active job |
| GET | `/jobs/:id/receipt` | CUSTOMER | Get job receipt |
| POST | `/disputes` | CUSTOMER | Open a dispute (validated) |
| PUT | `/me/notifications` | CUSTOMER | Update notification preferences |
| POST | `/me/notifications/trigger` | CUSTOMER | Send test notification |
| GET | `/workers/:id/profile` | CUSTOMER | View worker profile (with completed jobs) |
| POST | `/category-suggestions` | CUSTOMER | Submit category/subcategory suggestion |

---

### 2.3 category
**Model:** `Category` (MongoDB collection `categories`)

**Model Fields:**
```
name: String (required, unique)
description: String
icon: String (emoji)
color: String (default: #000000)
imageUrl: String (Cloudinary URL)
active: Boolean (default: true)
subcategories: [{
  name: String (required),
  imageUrl: String,
  minPrice: Number (default: 0),
  platformFee: Number (default: 50),
  suggestedMax: Number,
  active: Boolean (default: true)
}]
createdBy: ref->Customer
updatedBy: ref->Customer
```

**Endpoints (under `/api/v1/categories`):**
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Public | List categories (active only for public, all for admin) |
| POST | `/` | ADMIN | Create category (with image upload) |
| PATCH | `/:id` | ADMIN | Update category |
| DELETE | `/:id` | ADMIN | Delete category (cleans Cloudinary images) |
| POST | `/:id/subcategories` | ADMIN | Add subcategory |
| PATCH | `/:id/subcategories/:subId` | ADMIN | Update subcategory |
| DELETE | `/:id/subcategories/:subId` | ADMIN | Delete subcategory |
| GET | `/suggestions` | ADMIN | List category suggestions |
| PATCH | `/suggestions/:id` | ADMIN | Process (approve/reject) suggestion |

---

### 2.4 job
**Model:** `Job` (MongoDB collection `jobs`)

**Model Fields:**
```
customerId: ref->Customer (required)
workerId: ref->Customer
category: String (required)
subcategory: String
description: String
media: [String]
preferredDate: Date
timeSlot: enum[urgent, morning, afternoon, evening]

status: enum[BROADCASTING, QUOTES_RECEIVED, ALLOCATED, ARRIVING, IN_PROGRESS, COMPLETED, PAID, CLOSED, CANCELLED, DISPUTED]

location: GeoJSON Point (required)
addressDetails: { city, fullAddress }

broadcast: { round: Number, lastAttemptAt: Date, radiusKm: Number }

payment: {
  amount: Number          // Total customer paid
  platformFee: Number     // Admin revenue
  gst: Number             // GST collected
  workerPayout: Number    // Worker's quoted amount
  status: enum[PENDING, PAID, REFUNDED]
  razorpayOrderId: String
  razorpayPaymentId: String
}

security: { arrivalOtp: String, completionOtp: String }
completionDetails: { media: [String], report: String, completedAt: Date }
rating: { score: 1-5, review: String, createdAt: Date }

dispute: {
  reportedBy: enum[WORKER, CUSTOMER]
  amountReceived: Number
  shortAmount: Number
  reason: String
  reportedAt: Date
  status: enum[OPEN, RESOLVED]
  resolution: enum[DEDUCT_FROM_WORKER, WAIVE_FEE, REFUND_CUSTOMER, CLOSE]
  adminNote: String
  resolvedAt: Date
}
disputeId: ref->Dispute
```

**Indexes:** 2dsphere on location, customerId+createdAt, workerId+createdAt, status+createdAt, payment.status

**Endpoints (under `/api/v1/jobs`):**
| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/` | CUSTOMER | Create job (validates worker eligibility, broadcasts to eligible workers via WebSocket) |
| GET | `/` or `/my` | CUSTOMER | Get own jobs (with status filter) |
| GET | `/available` | WORKER | Get available jobs (enforces 8 eligibility criteria: verified, KYC approved, online, subscription active, wallet balance, categories match, within serviceRadius) |
| GET | `/worker` | WORKER | Get own assigned jobs |
| POST | `/:id/start` | WORKER | Start job (validates arrival OTP + GPS geofence <=200m) |
| POST | `/:id/complete` | WORKER | Complete job (media, report) |
| POST | `/:id/pay` | CUSTOMER | Pay for job (CASH: deducts commission from worker wallet; ONLINE: credits worker + collects platform fee to admin wallet) |
| POST | `/:id/rate` | CUSTOMER | Rate job (1-5 stars), updates worker average |
| GET | `/all` | ADMIN | Get all jobs (paginated, status filter) |
| GET | `/disputes` | ADMIN | Get disputed jobs |
| PATCH | `/:id/cancel` | ADMIN, CUSTOMER | Cancel job (notifies workers/bidders) |
| PATCH | `/:id/reassign` | ADMIN | Reassign worker to job |
| PATCH | `/:id/resolve-dispute` | ADMIN | Resolve dispute (DEDUCT_FROM_WORKER, WAIVE_FEE, REFUND_CUSTOMER, CLOSE) |
| POST | `/:id/report-partial-payment` | WORKER | Report cash shortfall (moves job to DISPUTED) |
| GET | `/:id/receipt` | All | Get detailed invoice-style receipt |
| GET | `/:id` | All | Get job detail |
| POST | `/upload-media` | All | Upload media file |

---

### 2.5 shop
**Model:** `Shop` (MongoDB collection `shops`)

**Model Fields:**
```
ownerId: ref->Customer (required, unique)
name: String (required)
category: String (default: General)
description: String
logoUrl: String (Cloudinary)
address: String
location: GeoJSON Point
businessHours: { monFri, sat, sun } (default: 9 AM - 10 PM)

deliveryConfig: {
  deliveryRadiusKm: Number (default: 3)
  minOrderAmount: Number (default: 100)
  freeDeliveryAbove: Number (default: 1000)
  deliveryCharge: Number (default: 40)
  discountEnabled: Boolean
  discountAbove: Number (default: 1000)
  discountType: enum[flat, percent] (default: flat)
  discountValue: Number (default: 100)
  discountPct: Number (default: 10)
  maxDiscountCap: Number (default: 200)
  sameDayDelivery: Boolean (default: true)
  deliverySlots: [{ label, slotOpen, slotClose }]
}

kyc: { status: enum[PENDING, APPROVED, REJECTED], documents: [{ name, url, public_id, docType }] }
payoutMethods: [{ type: enum[BANK, UPI], label, detail, isPrimary }] (max 5)
wallet: { balance: Number (default: 0) }
isOnline: Boolean (default: true)
rating: Number (default: 0)
totalOrders: Number (default: 0)
subscription: { status: enum[ACTIVE, EXPIRED, TRIAL, NONE], planId, expiryDate, isTrial }
isDeleted: Boolean
deletedAt: Date
```

**Indexes:** 2dsphere on location, kyc.status, isDeleted

**Endpoints (under `/api/v1/shops`):**
| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/` | Auth | Create/register shop |
| GET | `/my` | SHOP | Get own shop |
| PATCH | `/my` | SHOP | Update own shop (logo, details, location) |
| PATCH | `/my/owner` | SHOP | Update owner name |
| POST | `/my/payout-methods` | SHOP | Add payout method |
| POST | `/my/withdraw` | SHOP | Request withdrawal (atomic wallet deduction) |
| PATCH | `/my/payout-methods/:methodId/primary` | SHOP | Set primary payout |
| DELETE | `/my/payout-methods/:methodId` | SHOP | Remove payout method |
| DELETE | `/my` | SHOP | Delete shop + products |
| GET | `/:id/delivery-config` | Auth | Get delivery config |
| PATCH | `/:id/delivery-config` | SHOP, ADMIN | Update delivery config |
| GET | `/` | Auth | List shops (admin: paginated+filtered; customer: active only) |
| PATCH | `/:id` | ADMIN | Admin-update shop |
| DELETE | `/:id` | ADMIN | Admin-delete shop |
| PATCH | `/:id/kyc` | ADMIN | Approve/reject shop KYC |
| PATCH | `/:id/toggle` | ADMIN | Block/unblock shop |
| GET | `/:id` | Auth | Get shop by ID (sensitive fields hidden from non-owners) |

---

### 2.6 product
**Model:** `Product` (MongoDB collection `products`)

**Model Fields:**
```
shopId: ref->Shop (required)
name: String (required)
price: Number (required)
imageUrl: String
category: String (default: General)
brand: String
unit: String (default: Piece)
description: String
stock: Number (default: 0)
minQty: Number (default: 1)
attributes: [{ name: String, value: String }]
isActive: Boolean (default: true)
```

**Endpoints (under `/api/v1/products`):**
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/` | Auth | List products (by shopId, search, isActive) |
| GET | `/shop` | SHOP, ADMIN | Get own shop's products |
| GET | `/:id` | Auth | Get product by ID |
| POST | `/` | Auth | Create product (shop owner auto-detected, image via Cloudinary) |
| PATCH | `/:id` | Auth | Update product |
| DELETE | `/:id` | Auth | Delete product |

---

### 2.7 shoporder
**Model:** `ShopOrder` (MongoDB collection `shoporders`)

**Model Fields:**
```
orderNumber: String (unique, format: ORD-YYYYMMDD-RAND)
shopId: ref->Shop (required)
customerId: ref->Customer (required)
items: [{ productId: ref->Product, name, price, qty, imageUrl }] (max 50)
subtotal: Number (required)
deliveryFee: Number (default: 0)
discount: Number (default: 0)
total: Number (required)
deliveryAddress: String
deliveryLocation: GeoJSON Point
deliverySlot: { time, date, notes }

status: enum[NEW, CONFIRMED, PACKING, OUT_FOR_DELIVERY, DELIVERED, CANCELLED]

deliveryOtp: String
deliveryOtpGeneratedAt: Date
deliveryOtpAttempts: Number (default: 0)
deliveryStaffName: String
deliveryStaffPhone: String

statusHistory: [{ status, timestamp, note }]

payment: {
  amount: Number
  method: enum[WALLET, UPI, CASH]
  status: enum[PENDING, PAID, REFUNDED]
  razorpayOrderId: String
  razorpayPaymentId: String
}

promoCode: String
promoDiscount: Number
invoiceUrl: String
shopNote: String
```

**Endpoints (under `/api/v1/shoporders`):**
| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/` | CUSTOMER | Place order (atomic stock reservation, promo code, wallet payment) |
| GET | `/customer` | CUSTOMER | Get own orders (paginated) |
| POST | `/:id/cancel` | CUSTOMER | Cancel order (restores stock, refunds if paid) |
| GET | `/shop` | SHOP | Get shop's orders (paginated, status filter) |
| PATCH | `/:id/status` | SHOP, ADMIN | Update order status (validates transitions, OTP on delivery) |
| GET | `/all` | ADMIN | Get all orders (paginated, status/shop filter) |
| GET | `/:id` | Auth | Get order by ID |
| GET | `/:id/invoice` | Auth | HTML invoice download/print |

**Status Transitions:**
```
NEW -> CONFIRMED, CANCELLED
CONFIRMED -> PACKING, CANCELLED
PACKING -> OUT_FOR_DELIVERY, CANCELLED
OUT_FOR_DELIVERY -> DELIVERED, CANCELLED
DELIVERED -> CANCELLED
CANCELLED -> (terminal)
```

---

### 2.8 payment
**Model:** `Payment` (MongoDB collection `payments`)

**Model Fields:**
```
orderId: ref->ShopOrder
razorpayOrderId: String (required, unique)
razorpayPaymentId: String
razorpaySignature: String
amount: Number (required)
currency: String (default: INR)
status: enum[CREATED, AUTHORIZED, CAPTURED, FAILED, REFUNDED, PARTIAL_REFUNDED]
method: String
description: String
userId: ref->Customer (required)
metadata: Mixed
refundId: String
refundAmount: Number
failureReason: String
webhookEventId: String
```

**Endpoints (under `/api/v1/payments`):**
| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/webhook` | Public | Razorpay webhook (raw body, no parse) |
| POST | `/create-order` | Auth | Create Razorpay order |
| POST | `/verify` | Auth | Verify Razorpay payment (signature + Razorpay API check) |
| GET | `/history` | Auth | Get payment history |
| GET | `/:orderId` | Auth | Get payment by order ID |
| POST | `/refund` | ADMIN | Process refund |

---

### 2.9 promotion
**Model:** Three schemas - `Banner`, `Promotion`, `UserPromoUsage`

**Banner Fields:**
```
title: String (required)
subtitle: String
imageUrl: String (required)
linkType: enum[SHOP, PRODUCT, CATEGORY, EXTERNAL, NONE]
linkValue: String
position: enum[HOME_TOP, HOME_MIDDLE, SHOP_PAGE, CATEGORY_PAGE]
isActive: Boolean
priority: Number
startAt: Date
endAt: Date
createdBy: ref->Customer
```

**Promotion Fields:**
```
code: String (required, unique, uppercase)
title: String (required)
description: String
type: enum[FLAT_DISCOUNT, PERCENTAGE_DISCOUNT, FREE_DELIVERY, FIRST_ORDER, CASHBACK]
value: Number (required, min: 0)
maxDiscountCap: Number
minOrderAmount: Number
maxUsesTotal: Number
maxUsesPerUser: Number (default: 1)
usesCount: Number (default: 0)
appliesTo: enum[ALL, SHOPS, CATEGORIES, PRODUCTS]
appliesToIds: [ObjectId]
applicableRoles: [enum[CUSTOMER, WORKER, SHOP]]
isActive: Boolean
startAt: Date
endAt: Date
createdBy: ref->Customer
```

**UserPromoUsage Fields:** promoId, userId, usedAt

**Endpoints (under `/api/v1/promotions`):**
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/banners` | Public | Get active, in-date banners (by position) |
| POST | `/validate` | Auth | Validate promo code |
| GET | `/banners/all` | ADMIN | List all banners |
| POST | `/banners` | ADMIN | Create banner |
| PATCH | `/banners/:id` | ADMIN | Update banner |
| DELETE | `/banners/:id` | ADMIN | Delete banner |
| GET | `/promotions` | ADMIN | List all promotions |
| POST | `/promotions` | ADMIN | Create promotion |
| PATCH | `/promotions/:id` | ADMIN | Update promotion |
| DELETE | `/promotions/:id` | ADMIN | Delete promotion |

---

### 2.10 quote
**Model:** `Quote` (MongoDB collection `quotes`)

**Model Fields:**
```
jobId: ref->Job (required)
workerId: ref->Customer (required)
amount: Number (required)
description: String
timeToReach: String (e.g. "25 mins")
workerLocation: GeoJSON Point
status: enum[PENDING, ACCEPTED, REJECTED, WITHDRAWN]
```

**Indexes:** jobId+workerId (unique partial for PENDING/ACCEPTED to prevent duplicates)

**Endpoints (under `/api/v1/quotes`):**
| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/` | WORKER | Place quote (enforces KYC, subscription, wallet balance, prevents self-quoting) |
| GET | `/worker` | WORKER | Get own quotes |
| PATCH | `/:id/withdraw` | WORKER | Withdraw a quote |
| GET | `/job/:jobId` | CUSTOMER | Get all quotes for a job |
| PATCH | `/:id/accept` | CUSTOMER | Accept quote (generates OTPs, allocates job, notifies worker) |

---

### 2.11 subscription
**Model:** `WorkerSubscription` and `ShopSubscription` (separate collections)

**WorkerSubscription/ShopSubscription Fields:**
```
workerId/shopId: ref (required)
planId: String (required)
planName: String
amount: Number (required)
startDate: Date
endDate: Date (required)
isTrial: Boolean (default: false)
payment: { status: enum[PAID, PENDING, FAILED], razorpayOrderId, razorpayPaymentId }
```

**Endpoints (under `/api/v1/subscriptions`):**
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/plans` | Public | Get available subscription plans from settings |
| POST | `/subscribe` | WORKER, SHOP | Purchase plan (mandatory Razorpay payment verification) |
| GET | `/my` | WORKER, SHOP | Get own subscriptions |
| GET | `/all` | ADMIN | Get all subscriptions |

---

### 2.12 wallet
**Model:** `WalletTxn` (MongoDB collection `wallettxns`)

**Model Fields:**
```
userId: ref->Customer (required)
type: enum[JOB_CREDIT, JOB_DEBIT, SUBSCRIPTION, WITHDRAWAL, REFUND, ORDER_CREDIT, ORDER_DEBIT, REFERRAL_BONUS, ADJUSTMENT, TOPUP, ORDER_PAYMENT]
amount: Number (required, always positive)
balance: Number (required, post-txn balance)
status: enum[PENDING, COMPLETED, FAILED] (default: COMPLETED)
refId: String
description: String
invoiceUrl: String
```

**Endpoints (under `/api/v1/wallet`):**
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/balance` | Auth | Get wallet balance + transaction history (paginated, type filter) |
| POST | `/topup` | Auth | Top up wallet (Razorpay payment) |
| POST | `/withdraw` | Auth | Request withdrawal (payout created) |
| GET | `/transactions` | ADMIN | Get all transactions (filtered by type) |
| POST | `/adjust` | ADMIN | Manual balance adjustment (credit/debit) |

---

### 2.13 worker
(uses `Customer` model with `role: 'WORKER'`)

**Endpoints (under `/api/v1/workers`):**
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/me` | WORKER | Get own profile |
| GET | `/me/stats` | WORKER | Get stats (today's jobs, completed, inProgress, cancelled) |
| PATCH | `/me/profile` | WORKER | Partial profile update |
| PUT | `/me/profile` | WORKER | Full profile update (name, email, bio, city, services, wallet) |
| PATCH | `/me/kyc` | WORKER | Upload KYC document |
| DELETE | `/me/kyc/:docIndex` | WORKER | Remove KYC document |
| PATCH | `/me/bank` | WORKER | Update bank details |
| PATCH | `/me/services` | WORKER | Update service categories |
| PATCH | `/me/location` | WORKER | Update active location |
| PATCH | `/me/online` | WORKER | Toggle online status |
| GET | `/earnings/summary` | WORKER | Earnings summary |
| GET | `/earnings/chart` | WORKER | Earnings chart data |
| GET | `/earnings/transactions` | WORKER | Earnings transactions |
| POST | `/earnings/withdraw` | WORKER | Request earnings withdrawal |
| POST | `/category-suggestions` | WORKER | Submit category suggestion |
| GET | `/category-suggestions` | WORKER | Get own suggestions |
| POST | `/me/addresses` | WORKER | Add address |
| PUT | `/me/addresses/:addressId` | WORKER | Update address |
| DELETE | `/me/addresses/:addressId` | WORKER | Remove address |
| PATCH | `/me/addresses/:addressId/primary` | WORKER | Set primary address |

---

### 2.14 chat
**Model:** `Message` (MongoDB collection `messages`)

**Model Fields:**
```
jobId: ref->Job (null for admin chat)
senderId: ref->Customer (null for admin)
receiverId: ref->Customer (null for admin)
text: String
mediaUrl: String
isRead: Boolean (default: false)
```

**Endpoints (under `/api/v1/chat`):**
| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/upload-image` | Auth | Upload chat image (multer -> Cloudinary) |
| POST | `/upload-base64` | Auth | Upload base64 image |
| GET | `/history` | Auth | Get chat history (by jobId, partnerId, or all) |
| POST | `/send` | Auth | Send message (socket emit to receiver/admin) |
| POST | `/mark-read` | Auth | Mark messages as read |
| GET | `/support/threads` | ADMIN | Get support threads |

---

### 2.15 cart
**Model:** `Cart` (MongoDB collection `carts`)

**Model Fields:**
```
customerId: ref->Customer (required)
shopId: ref->Shop (required)
items: [{ productId, name, price, qty, imageUrl, stockAtAdd }] (max 50)
subtotal: Number
deliveryCharge: Number
discount: Number
totalAmount: Number
expiresAt: Date (24h TTL, MongoDB auto-expire)
```

**Indexes:** customerId+shopId (unique), expiresAt (TTL)

**Endpoints (under `/api/v1/cart`):**
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/` | CUSTOMER | Get cart |
| POST | `/` | CUSTOMER | Add to cart (one shop at a time, stock check) |
| PATCH | `/:itemId` | CUSTOMER | Update item qty |
| DELETE | `/:itemId` | CUSTOMER | Remove item |
| DELETE | `/clear` | CUSTOMER | Clear entire cart |

---

### 2.16 payout
**Model:** `Payout` (MongoDB collection `payouts`)

**Model Fields:**
```
workerId: ref->Customer (or shopId)
shopId: ref->Shop (or workerId)
amount: Number (required)
status: enum[PENDING, APPROVED, TRANSFERRED, REJECTED]
paymentMethod: enum[UPI, BANK] (required)
paymentDetails: String (required)
txnId: String
walletTxnId: ref->WalletTxn
rejectReason: String
requestedAt: Date
processedAt: Date
```

**Endpoints (under `/api/v1/payouts`):**
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/` | ADMIN | Get payouts (status filter, cache 5 min) |
| PATCH | `/:id/status` | ADMIN | Update payout status (reject refunds to wallet) |

---

### 2.17 admin
**Model:** Uses `Customer`, `Shop`, `Job`, `ShopOrder`, etc.

**Endpoints (under `/api/v1/admin`):**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/settings/branding` | PUBLIC: Get branding settings |
| POST | `/upload-image` | Upload image (admin use) |
| GET | `/stats` | Dashboard statistics |
| GET | `/badges` | Badge counts (pending KYC, disputes, etc.) |
| GET | `/health` | Platform health check |
| GET | `/ledger` | Admin ledger (transactions) |
| GET | `/customers` | List customers (paginated, search, status filter) |
| GET | `/customers/export` | Export customers CSV |
| GET | `/customers/:id` | Get customer detail |
| GET | `/workers` | List workers (paginated, search, KYC filter) |
| GET | `/workers/export` | Export workers CSV |
| GET | `/workers/:id` | Get worker detail |
| GET | `/pending-kyc` | Get users with pending KYC |
| POST | `/users` | Create user |
| PATCH | `/users/:id` | Update user |
| PATCH | `/users/:id/toggle-status` | Toggle user active status |
| DELETE | `/users/:id` | Delete user |
| POST | `/users/:id/impersonate` | Impersonate user (JWT with isImpersonated flag) |
| GET | `/customers/:id/jobs` | Get customer's jobs |
| GET | `/customers/:id/orders` | Get customer's orders |
| POST | `/customers/:id/jobs` | Admin-created job for customer |
| POST | `/customers/:id/orders` | Admin-created order for customer |
| PATCH | `/jobs/:id/details` | Admin-update job details |
| PATCH | `/workers/:id/kyc` | Approve/reject worker KYC |
| PATCH | `/workers/:id/extend-subscription` | Extend worker subscription |
| POST | `/workers/:id/kyc-documents` | Upload KYC doc for worker |
| DELETE | `/workers/:id/kyc-documents/:docIndex` | Remove KYC doc |
| GET | `/shops` | List all shops |
| GET | `/shops/:id` | Get shop detail |
| POST | `/shops` | Create shop (admin) |
| PATCH | `/shops/:id` | Update shop (admin) |
| DELETE | `/shops/:id` | Delete shop |
| PATCH | `/shops/:id/kyc` | Approve/reject shop KYC |
| PATCH | `/shops/:id/toggle` | Toggle shop status |
| POST | `/shops/:id/wallet/credit` | Credit shop wallet |
| POST | `/shops/:id/wallet/debit` | Debit shop wallet |
| POST | `/shops/:id/kyc-doc` | Upload shop KYC doc |
| DELETE | `/shops/:id/kyc-doc/:docIndex` | Delete shop KYC doc |
| POST | `/shops/:id/payout-methods` | Add shop payout method |
| PATCH | `/shops/:id/payout-methods/:methodId` | Edit shop payout method |
| DELETE | `/shops/:id/payout-methods/:methodId` | Delete shop payout method |
| PATCH | `/shops/:id/payout-methods/:methodId/primary` | Set primary payout |
| PATCH | `/shops/:id/kyc-doc/:docIndex` | Edit shop KYC doc |
| PATCH | `/shops/:id/owner` | Update shop owner |
| GET | `/jobs/export` | Export jobs CSV |
| GET | `/jobs/all` | Get all jobs (delegated to job controller) |
| GET | `/jobs/:id` | Get job detail |
| GET | `/payments/export` | Export payments CSV |
| GET | `/payouts` | Get payouts |
| PATCH | `/payouts/:id/status` | Update payout status |
| GET | `/suggestions` | List suggestions |
| PATCH | `/suggestions/:id/approve` | Approve suggestion |
| PATCH | `/suggestions/:id/reject` | Reject suggestion |
| GET | `/disputes` | List disputes |
| PATCH | `/disputes/:id/status` | Update dispute status |

**Mounted sub-routers under admin:**
- `/admin/jobs` -> job routes
- `/admin/reports` -> reports routes (`GET /:tab`)
- `/admin/categories` -> category routes
- `/admin/notifications` -> notification routes
- `/admin/settings` -> settings routes
- `/admin/wallet` -> wallet routes
- `/admin/shoporders` -> shoporder routes
- `/admin/settlements` -> settlement routes
- `/admin/promotions` -> promotion routes

---

### 2.18 adminWallet
**Model:** `AdminWallet`, `AdminWalletTxn`

**AdminWallet Fields:**
```
balance: Number (default: 0, min: 0)
bankDetails: { accountHolder, accountNumber, ifscCode, bankName }
upiId: String
```

**AdminWalletTxn Fields:**
```
type: enum[PLATFORM_FEE_COLLECTED, COMMISSION_COLLECTED, SETTLEMENT_CREDIT, MANUAL_CREDIT, MANUAL_DEBIT, PAYOUT_DEBIT, WORKER_PAYOUT, SHOP_PAYOUT, WITHDRAWAL, REFUND_DEBIT, TOPUP]
amount: Number (required)
balanceAfter: Number (required)
description: String
referenceId: ObjectId
referenceModel: String
meta: Mixed
```

**AdminWallet Service functions:**
- `getOrCreateWallet()` - Singleton admin wallet
- `adjustWalletBalance()` - Atomic balance adjustment with transaction support
- `collectPlatformFee()` - Collect platform fee into admin wallet
- `collectCommission()` - Collect commission into admin wallet

**Endpoints (under `/api/v1/admin/admin-wallet`):**
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/balance` | ADMIN | Get admin wallet balance |
| GET | `/transactions` | ADMIN | Get admin wallet transactions |
| POST | `/credit` | ADMIN | Manual credit |
| POST | `/debit` | ADMIN | Manual debit |
| PATCH | `/bank-details` | ADMIN | Update bank details |
| POST | `/razorpay-order` | ADMIN | Create Razorpay order |
| POST | `/razorpay-verify` | ADMIN | Verify Razorpay payment |

---

### 2.19 settings
**Model:** `AppSettings` (singleton document)

**Model Fields:**
```
isSingleton: String (unique, default: 'CONFIG')

fees: {
  type: enum[flat, percent] (default: flat)
  amount: Number (default: 50)
  gstPercentage: Number (default: 18)
}

wallet: {
  minimumBalance: Number (default: 100)
  topupPresets: [Number] (default: [50, 100, 200, 500])
}

subscription: {
  freeTrialDays: Number (default: 14)
}

subscriptionPlans: [{
  id: String
  label: String
  price: Number
  durationDays: Number
  features: [String]
  isActive: Boolean
  targetRole: enum[WORKER, SHOP] (default: WORKER)
}]

radius: { maxKm: Number (default: 15) }

maintenance: { mode: Boolean, message: String }

branding: { appName: String, logoUrl: String, iconUrl: String }

disputeCategories: [String]

legal: { termsOfService: String, privacyPolicy: String }

updatedBy: ref->Customer
```

**Settings Service:** `SettingsService.getAppSettings()` - Fetches from Redis cache (10 min TTL) with DB fallback.

**Endpoints (under `/api/v1/settings`):**
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/public` | Public | Get public branding + subscription plans |
| GET | `/` | ADMIN | Get all settings (flattened for frontend) |
| PATCH | `/` | ADMIN | Update settings (flat keys mapped to nested paths) |

---

### 2.20 settlement
**Model:** `Settlement` (MongoDB collection `settlements`)

**Model Fields:**
```
type: enum[SERVICE_JOB, PRODUCT_ORDER] (required)
orderId: ref->ShopOrder
shopId: ref->Shop
customerId: ref->Customer
totalAmount: Number (required)
platformCommission: Number (required)
shopEarning: Number (required)
status: enum[PENDING, SETTLED, CANCELLED]
settledAt: Date
settledBy: ref->Customer (immutable)
note: String
```

**Endpoints (under admin -> `/api/v1/admin/settlements`):**
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/` | ADMIN | Get all settlements |
| GET | `/pending` | ADMIN | Get pending settlements |
| POST | `/:id/settle` | ADMIN | Settle individual settlement |
| POST | `/bulk-settle` | ADMIN | Bulk settle all pending |

---

### 2.21 dispute
**Model:** `Dispute`

**Model Fields:**
```
jobId: ref->Job
shopOrderId: ref->ShopOrder
customerId: ref->Customer (required)
workerId: ref->Customer
issue: String
reason: String (required)
description: String
status: enum[OPEN, IN_REVIEW, RESOLVED, REFUNDED, DISMISSED]
resolutionNotes: String
openedAt: Date
resolvedAt: Date
```

**Controller:**
- `getDisputes` — List all disputes (with populated refs, cached 5 min)
- `openDispute` — Customer opens dispute on job or shop order
- `updateDisputeStatus` — Admin resolves dispute with optional refund

---

### 2.22 deliveryStaff
**Model:** `DeliveryStaff`

**Model Fields:**
```
shopId: ref->Shop (required)
name: String (required)
phone: String
activeOrderId: ref->ShopOrder
totalDeliveries: Number (default: 0)
averageRating: Number (default: 0)
```

**Endpoints (under `/api/v1/delivery-staff`):**
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/` | SHOP | Get delivery staff |
| POST | `/` | SHOP | Add staff (name, phone) |
| PATCH | `/:staffId` | SHOP | Update staff |
| DELETE | `/:staffId` | SHOP | Remove staff (prevents removal with active delivery) |

---

### 2.23 notification
**Model:** `Notification`

**Model Fields:**
```
userId: ref->Customer (null = broadcast)
title: String (required)
message: String (required)
type: enum[BROADCAST, DIRECT, SYSTEM, ADMIN_ACTIVITY]
action: enum[CREATE, UPDATE, DELETE, TOGGLE_STATUS, KYC, PAYOUT, WALLET_CREDIT, WALLET_DEBIT, WALLET_UPDATE, IMPERSONATE, SETTLE, BROADCAST, SYSTEM, OTHER, JOB_CREATED, JOB_UPDATED, JOB_CANCELLED, QUOTE_RECEIVED, ORDER_PLACED, ORDER_UPDATED, ORDER_CANCELLED, ORDER_DELIVERED, TOPUP, RATING_RECEIVED, EXTEND_SUBSCRIPTION, SUBSCRIPTION_EXPIRING, SUBSCRIPTION_EXPIRED]
entityType: enum[CUSTOMER, WORKER, SHOP, JOB, ORDER, PAYOUT, WALLET, KYC, CATEGORY, PROMOTION, PRODUCT, SETTINGS, BANNER, PROMO, DISPUTE, OTHER]
entityId: ObjectId
performedBy: ref->Customer
targetRole: enum[ALL, ADMIN, CUSTOMER, WORKER, SHOP, SHOP_OWNER]
readBy: [ObjectId]
deletedBy: [ObjectId]
```

**Endpoints (under `/api/v1/notifications`):**
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/` | ADMIN | Get all notifications (limit 100) |
| GET | `/activity-logs` | ADMIN | Get admin activity logs (paginated, type filter) |
| POST | `/broadcast` | ADMIN | Send broadcast notification |
| GET | `/my` | Auth | Get own notifications (DIRECT + BROADCAST for role) |
| GET | `/unread-count` | Auth | Get unread notification count |
| PATCH | `/read-all` | Auth | Mark all as read |
| PATCH | `/:id/read` | Auth | Mark one as read |
| DELETE | `/:id` | Auth | Delete notification (soft, adds to deletedBy) |

---

### 2.24 suggestion
**Model:** `Suggestion`

**Model Fields:**
```
workerId: ref->Customer (required)
workerName: String
workerCity: String
type: enum[new_category, new_subcategory] (required)
source: enum[worker, customer] (default: worker)
payload: {
  parentCategory: String
  parentCategoryId: ref->Category
  name: String (required)
  icon: String
  description: String (required)
  suggestedSubcategories: [String]
}
status: enum[PENDING, APPROVED, REJECTED]
rejectReason: String
approveReason: String
submittedAt: Date
```

**Controller:**
- `getSuggestions` — List all suggestions (cached 1h)
- `approveSuggestion` — Approve + create category/subcategory
- `rejectSuggestion` — Reject with reason, notify submitter

---

## 3. Middleware Catalog

| File | Type | Description |
|------|------|-------------|
| **auth.middleware.js** | Authentication | JWT verification (HS256), token blacklist check (Redis), Redis-first session lookup with DB fallback, attaches `req.user`, `req.isVerifiedWorker`, `req.walletBalance`, `req.isImpersonated` |
| **role.middleware.js** | Authorization | `authorize(...roles)` - checks `req.user.role` against allowed roles list, returns 403 if not authorized |
| **validate.middleware.js** | Input Validation | `validate(schema, source)` - Joi schema validation with `abortEarly: false`, `stripUnknown: true` |
| **upload.middleware.js** | File Upload | Multer memory storage, 5MB limit, allowed types: JPEG, PNG, WebP, GIF, PDF. Returns array of middleware (not single function) |
| **sanitize.middleware.js** | Security | Deep recursive sanitization: XSS via `xss` library, removes `__proto__`/`constructor`/`prototype` (prototype pollution), removes `$`-prefixed and `.`-containing keys (NoSQL injection) |
| **rateLimit.middleware.js** | Rate Limiting | Three limiters using RedisStore: `globalLimiter` (1000/15min), `authLimiter` (5/15min), `otpSendLimiter` (3/10min). Graceful fallback on Redis outage |
| **error.middleware.js** | Error Handling | Global error handler: normalizes Multer, JSON parse, Mongoose validation, duplicate key(11000), CastError, JWT errors into standard `{status, message, errors}` format |

---

## 4. Helpers Catalog

| File | Functions | Description |
|------|-----------|-------------|
| **async.helper.js** | `catchAsync(fn)` | Wraps async route handlers, forwards errors to Express error handler |
| **response.helper.js** | `successResponse(res, data, message, statusCode)` / `errorResponse(res, message, statusCode, errors)` | Standardized JSON responses `{status, message, data/errors}` |
| **logger.helper.js** | `logger` instance | Winston logger: JSON format, files `logs/error.log` (10MB, 5 files) + `logs/combined.log`, console output in non-production |
| **redis.helper.js** | `initRedis()`, `getRedis()`, `setCache(key, val, ttl)`, `getCache(key)`, `delCache(key)`, `delCacheByPattern(pattern)`, `fetchWithCache(key, ttl, fetcher)`, `acquireLock(name, ttl)`, `releaseLock(name, holderId)` | ioredis wrapper: auto-reconnect (max 60s delay), JSON serialization, distributed locking for cron jobs, pattern-based cache invalidation, smart dashboard stats invalidation |
| **socket.helper.js** | `initSocket(server)`, `getIO()`, `emitToAll(event, data)`, `emitToRoom(room, event, data)`, `emitToUser(userId, event, data)`, `triggerDashboardUpdate(payload)` | Socket.io setup: JWT auth middleware, Redis pub/sub adapter for clustering, room-based targeting (user_/customer_/worker_/shop_/admin_dashboard), ping/pong configs for 100K scale |
| **razorpay.helper.js** | `getRazorpay()`, `createRazorpayOrder(amount, receipt, notes)`, `fetchPayment(paymentId)`, `capturePayment(paymentId, amount)`, `createRefund(paymentId, amount, notes)`, `verifyPaymentSignature(orderId, paymentId, signature)` | Razorpay SDK wrapper: lazy singleton, timing-safe HMAC signature verification, paise conversion |
| **geo.helper.js** | `haversineDistance(coords1, coords2)` / `calculateETA(distanceKm)` | Haversine formula for distance in km, ETA = max(5, ceil(distance*2)+5) minutes |
| **worker.helper.js** | `findEligibleWorkers(job, radiusKm, minBalance)` | Finds workers matching all 8 criteria: role=WORKER, verified, KYC approved, online, subscription active, wallet >= minBalance, category match, within worker's serviceRadius |
| **notifyUser.helper.js** | `notifyUser({userId, title, message, action, entityType, entityId, targetRole})` / `sendFCMPush(fcmToken, title, body, data)` | Triple-redundancy: (1) DB persist, (2) Socket emit, (3) FCM push via Firebase Admin SDK or legacy HTTP API |
| **transaction.helper.js** | `supportsTransactions()` | Checks if MongoDB topology supports transactions (replica set/sharded cluster vs standalone) |
| **adminActivity.helper.js** | `logAdminActivity(action, entityType, entityId, title, message, adminId)` | Creates ADMIN_ACTIVITY notification + socket emit to admin_dashboard |
| **seeder.helper.js** | `seedData()` | Seeds admin user, settings, categories, test workers, shops, products on first run (only non-production) |

---

## 5. Services Catalog

| File | Functions | Description |
|------|-----------|-------------|
| **cloudinary.service.js** | `uploadImage(buffer, folder)` — compresses to WEBP (sharp: 1024px, quality 80) and uploads / `uploadBase64(base64, folder)` / `deleteImage(publicId)` / `cleanupImage(ref)` — accepts URL, public_id, or doc object / `extractPublicId(url)` | Cloudinary image management with auto-WEBP conversion |
| **sms.service.js** | `sendOTP(phone)` — generates secure 4-digit OTP, supports Fast2SMS/Twilio/MSG91 gateways, dev mode returns static OTP | SMS OTP service with pluggable gateway providers |

---

## 6. Cron Jobs

### 6.1 subscription.cron.js — `startSubscriptionCron()`
- **Schedule:** Daily at midnight (`0 0 * * *`)
- **Function:**
  1. Finds workers with subscriptions expiring in exactly 3 days — sends `SUBSCRIPTION_EXPIRING` notification
  2. Finds workers with expired subscriptions (online) — sets `isOnline=false`, emits `FORCED_OFFLINE` via socket, sends `SUBSCRIPTION_EXPIRED` notification

### 6.2 workers/cronEngine.js — `startCronEngine()`
- Registers 4 cron jobs with Redis distributed locking:

| Schedule | Lock Key | Job | Description |
|----------|----------|-----|-------------|
| Every minute | `cron:broadcast_sweep` (120s) | `sweepBroadcastingJobs()` | Progressive radius expansion (3 rounds), auto-cancels after round 3 if no workers found, finds eligible workers for each round and notifies them via socket |
| Every minute | `cron:job_sweep` (50s) | `sweepGhostQuotes()` | Cancels `QUOTES_RECEIVED` jobs older than 2 hours (except scheduled jobs) |
| Every 5 minutes | `cron:order_sweep` (290s) | `sweepGhostOrders()` | Cancels `NEW` shop orders older than 30 minutes, refunds wallet if paid |
| Every 10 minutes | `cron:worker_sweep` (590s) | `sweepExpiredSubscriptions()` | Forces offline workers/shops with expired paid subscriptions |

---

## 7. Socket Handlers

**File:** `sockets/index.js` — `initSocketHandlers()`

**Room conventions (auto-joined on connection based on JWT role):**
- `user_{userId}` — Personal room (all roles)
- `customer_{userId}` — Customer's room
- `worker_{userId}` — Worker's room
- `shop_{shopId}` — Shop's room
- `admin_dashboard` — Admin dashboard room

**Socket Events:**

| Event | Direction | Handler |
|-------|-----------|---------|
| `JOIN_JOB_ROOM` | Client -> Server | Verifies user is job participant (customer/worker/admin), joins `job_{jobId}` room |
| `WORKER_LOCATION_UPDATE` | Client -> Server | Verifies worker assignment via Redis cache, relays coords to `customer_{customerId}` |
| `SEND_MESSAGE` | Client -> Server | Sanitizes message (strip HTML, max 2000 chars), emits to `job_{jobId}` room |

**Server-emitted events (from controllers):**
- `NEW_JOB_ALERT` — to `worker_{id}` rooms
- `JOB_STARTED`, `JOB_COMPLETED`, `JOB_PAID`, `JOB_STATUS_CHANGED`, `JOB_DISPUTED`, `JOB_RADIUS_EXPANDED`, `DISPUTE_RESOLVED`
- `NEW_ORDER` — to `shop_{id}` room
- `ORDER_STATUS` — to customer/shop rooms
- `DASHBOARD_UPDATE` — to `admin_dashboard` room
- `NEW_NOTIFICATION` — to `user_{id}` room
- `FORCED_OFFLINE` — to `worker_{id}` room
- `NEW_MESSAGE` — to `user_{id}` room (chat)
- `SUPPORT_MESSAGE_RECEIVED`, `ADMIN_MESSAGE_SENT` — to `admin_dashboard`

---

## 8. Validators Catalog

All validators use **Joi** schemas.

| File | Exports | Description |
|------|---------|-------------|
| **auth.validator.js** | `loginSchema`, `sendOTPSchema`, `verifyOTPSchema`, `setPasswordSchema`, `forgotPasswordSchema`, `resetPasswordSchema` | Auth validation: phone (10-digit), email, password (min 6), role enum, OTP code |
| **admin.validator.js** | `updateKYCSchema`, `createUserSchema`, `updateUserSchema`, `adminCreateJobSchema`, `adminUpdateJobSchema`, `adminCreateOrderSchema`, `extendSubscriptionSchema`, `addPayoutMethodSchema`, `editPayoutMethodSchema`, `addKycDocSchema` | Admin CRUD validation |
| **category.validator.js** | `createCategorySchema`, `updateCategorySchema`, `addSubcategorySchema`, `updateSubcategorySchema` | Category/subcategory validation: name, icon, minPrice, platformFee |
| **shop.validator.js** | `createShopSchema`, `updateShopSchema`, `updateShopAdminSchema`, `addPayoutMethodSchema`, `withdrawSchema`, `updateOwnerSchema`, `reviewKycSchema`, `createShopAdminSchema`, `shopWalletSchema` | Shop validation: name, address, location, payout methods, KYC, wallet |
| **product.validator.js** | `createProductSchema`, `updateProductSchema` | Product validation: name, price, category, stock, minQty |
| **job.validator.js** | `createJobSchema` | Job creation: category, subcategory, description, location (coordinates required), timeSlot |
| **shoporder.validator.js** | `placeOrderSchema`, `updateOrderStatusSchema` | Order validation: items (array min 1), shopId, paymentMethod |
| **wallet.validator.js** | `topupSchema`, `withdrawSchema`, `adjustSchema` | Wallet validation: amount (positive), paymentMethod |
| **subscription.validator.js** | `validateSubscribe` | Subscription validation: planId, paymentId, razorpayOrderId/PaymentId/Signature |
| **dispute.validator.js** | `openDisputeSchema` | Dispute validation: reason, description, jobId or shopOrderId |
| **settings.validator.js** | `validateUpdateSettings` | Settings update validation with flat-to-nested mapping |

---

## 9. Config Files

| File | Purpose |
|------|---------|
| **config/db.js** | MongoDB connection via Mongoose: maxPoolSize 20, minPoolSize 5, serverSelectionTimeout 5s, socketTimeout 45s, connectTimeout 10s, heartbeat 10s. Exits process on failure |
| **constants/business.js** | Business constants: `MAX_ACTIVE_JOBS=5`, `MAX_AVAILABLE_JOBS=50`, `GEOFENCE_MAX_METERS=200`, OTP configs (`OTP_MIN=1000, OTP_MAX=9000, OTP_TTL=300s, OTP_BLOCK_TTL=3600s`), `SESSION_TTL=86400`, `CART_TTL_MS=24h`, `DASHBOARD_STATS_TTL=300`, `JOB_ELIGIBLE_WORKERS_TTL=1800`, `EARTH_RADIUS_KM=6371`, `FREE_TRIAL_DAYS_DEFAULT=14` |
| **constants/messages.js** | Standard response messages for AUTH, ADMIN, COMMON |

---

## 10. Environment Variables

### Required (fail-fast on startup):
| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | HMAC-SHA256 secret for JWT signing (min 32 chars recommended) |
| `MONGO_URI` | MongoDB connection string |

### Optional with defaults:
| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | Server port |
| `NODE_ENV` | `development` | Environment (development, test, production) |
| `JWT_EXPIRES_IN` | `7d` | JWT token expiry |
| `ALLOWED_ORIGINS` | `http://localhost:3000,http://localhost:19006,http://localhost:5173,http://localhost:5174` | CORS allowed origins (comma-separated) |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL |
| `RAZORPAY_KEY_ID` | (none) | Razorpay API key ID |
| `RAZORPAY_KEY_SECRET` | (none) | Razorpay API key secret |
| `CLOUDINARY_CLOUD_NAME` | (none) | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | (none) | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | (none) | Cloudinary API secret |
| `ENABLE_REAL_SMS` | `false` | Enable real SMS gateway |
| `DEV_STATIC_OTP` | (auto-generated) | Static OTP for dev/test |
| `ADMIN_DEFAULT_EMAIL` | `admin@kwickly.com` | Default admin email for seeding |
| `ADMIN_DEFAULT_PASSWORD` | `admin123` | Default admin password for seeding |
| `FCM_SERVER_KEY` | (none) | Firebase Cloud Messaging server key (legacy API) |
| `FIREBASE_PROJECT_ID` | (none) | Firebase project ID (Admin SDK) |
| `APP_NAME` | `Kwickly` | Application name |
| `APP_URL` | (none) | App URL |
| `ADMIN_URL` | (none) | Admin panel URL |

### SMS provider-specific (one of):
- `FAST2SMS_API_KEY`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- `MSG91_API_KEY`, `MSG91_TEMPLATE_ID`

---

## 11. Startup Flow (server.js + app.js)

### server.js startup sequence:
```
1. dotenv.config() — load .env
2. Check REQUIRED_ENV (JWT_SECRET, MONGO_URI) — exit if missing
3. require('./app') — load Express app
4. require('./config/db') — MongoDB connection function
5. require('./helpers/redis.helper').initRedis()
6. Create HTTP server from Express app
7. initSocket(server) — Socket.io with JWT middleware + Redis adapter
8. initSocketHandlers() — Register socket event handlers
9. initRedis() — Initialize Redis connection (ioredis with retry)
10. startServer():
    a. connectDB() — Mongoose connect with pool configs
    b. seedData() — Only if NODE_ENV !== 'production' (seeds admin, settings, categories)
    c. startCronEngine() — Schedule 4 cron jobs (broadcast, ghost jobs/orders, expired subs)
    d. startSubscriptionCron() — Schedule daily midnight subscription check
    e. server.listen(PORT) — Start HTTP server
11. SIGTERM handler — Graceful shutdown (close HTTP server)
12. uncaughtException — Log and exit
13. unhandledRejection — Log
```

### app.js middleware stack (in order):
```
1. CORS — Origin whitelist from ALLOWED_ORIGINS
2. helmet() — Security headers (crossOriginResourcePolicy: cross-origin)
3. morgan() — Dev: 'dev' format, Prod: 'combined' to Winston
4. express.json({ limit: '10mb' })
5. express.urlencoded({ extended: true, limit: '10mb' })
6. hpp() — HTTP Parameter Pollution protection
7. sanitizeMiddleware — XSS + NoSQL injection sanitization
8. compression() — Response compression
9. express.static('/uploads') — Serve public/uploads
10. globalLimiter — 1000 req/15min per IP (RedisStore)
11. Route mounting (24 modules)
12. /health endpoint — No auth, no rate limit
13. 404 handler
14. errorHandler — Global error handler
```

### Route Mounting Matrix:
```
/api/v1/auth              -> modules/auth/auth.routes.js
/api/v1/admin             -> modules/admin/admin.routes.js
/api/v1/customers         -> modules/customer/customer.routes.js
/api/v1/categories        -> modules/category/category.routes.js
/api/v1/jobs              -> modules/job/job.routes.js
/api/v1/payouts           -> modules/payout/payout.routes.js
/api/v1/settings          -> modules/settings/settings.routes.js
/api/v1/notifications     -> modules/notification/notification.routes.js
/api/v1/quotes            -> modules/quote/quote.routes.js
/api/v1/shops             -> modules/shop/shop.routes.js
/api/v1/products          -> modules/product/product.routes.js
/api/v1/shoporders        -> modules/shoporder/shoporder.routes.js
/api/v1/subscriptions     -> modules/subscription/subscription.routes.js
/api/v1/wallet            -> modules/wallet/wallet.routes.js
/api/v1/workers           -> modules/worker/worker.routes.js
/api/v1/chat              -> modules/chat/chat.routes.js
/api/v1/cart              -> modules/cart/cart.routes.js
/api/v1/delivery-staff    -> modules/deliveryStaff/deliveryStaff.routes.js
/api/v1/promotions        -> modules/promotion/promotion.routes.js
/api/v1/payments          -> modules/payment/payment.routes.js
/api/v1/admin/admin-wallet -> modules/adminWallet/adminWallet.routes.js
```

---

## System Architecture Notes

### Database:
- **MongoDB** with Mongoose ODM
- Connection pool: 20 max, 5 min
- Transactions used for wallet operations when MongoDB topology supports it
- GeoJSON 2dsphere indexes for location-based worker matching

### Caching Strategy (Redis):
- User sessions: 24h TTL
- Category list: 1h TTL
- App settings: 10 min TTL
- Dashboard stats: 5 min TTL
- Badge counts: 1 min TTL
- Job eligible workers: 30 min TTL
- OTP codes: 5 min TTL
- JWT blacklist: ~expiry TTL

### Notifications Architecture (Triple-redundancy):
1. DB persistence (Notification collection)
2. Socket.io real-time push to user room
3. FCM push notification (Firebase Admin SDK primary, legacy HTTP fallback)

### Worker Matching (8 Eligibility Criteria):
1. role = WORKER
2. isVerified = true
3. kyc.status = APPROVED
4. isOnline = true
5. Subscription valid (trial active or expiryDate > now)
6. wallet.balance >= minimumBalance
7. Worker has job category in active services
8. Job within worker's serviceRadius (Haversine distance)

### Job Broadcasting (3-Round Progressive Expansion):
- Round 1: Initial radius from settings
- Round 2 (after 1 min): 2x initial radius
- Round 3 (after 1 min): 3x initial radius (max)
- After round 3: Auto-cancel (or delay 30 min for scheduled jobs)

### Security Measures:
- JWT with HS256 algorithm
- Token blacklist on logout
- Password hashing with bcrypt (12 rounds)
- XSS sanitization on all inputs
- NoSQL injection prevention ($ and . key removal)
- Prototype pollution prevention
- Timing-safe OTP comparison
- GPS geofence verification (200m for job start)
- Atomic stock reservation for orders
- Atomic wallet operations with balance guard ($gte)
- Rate limiting on all routes
- CORS origin whitelist
- Helmet security headers
- HPP (HTTP Parameter Pollution) protection
