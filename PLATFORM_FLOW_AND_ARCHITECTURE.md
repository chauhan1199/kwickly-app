# ⚡ KWICKLY PLATFORM — MASTER ARCHITECTURE & FLOW DOCUMENTATION v2.0

> **Version:** 2.0 — Enhanced Edition  
> **Last Updated:** June 2026 | Full codebase + requirement analysis  
> **Covers:** Mobile App (React Native) · Backend API (Node.js/Express/MongoDB/Redis) · Admin Panel (React/Vite)

---

## 📋 TABLE OF CONTENTS

1. [Platform Overview](#1-platform-overview)
2. [Technology Stack](#2-technology-stack)
3. [System Architecture Diagram](#3-system-architecture-diagram)
4. [Database Schema — Normalized for 50k+ Users](#4-database-schema)
5. [Redis Caching Architecture — Zero Latency Strategy](#5-redis-caching-architecture)
6. [Wallet System — Admin-First Centralized Flow](#6-wallet-system)
7. [API Routes Reference](#7-api-routes-reference)
8. [User Roles & Permission Matrix](#8-user-roles--permission-matrix)
9. [Authentication Flow](#9-authentication-flow)
10. [Customer Flow — Step by Step](#10-customer-flow)
11. [Worker Flow — Step by Step](#11-worker-flow)
12. [Shop Flow — Step by Step](#12-shop-flow)
13. [Admin Flow — Step by Step](#13-admin-flow)
14. [Job Lifecycle State Machine](#14-job-lifecycle)
15. [Shop Order Lifecycle State Machine](#15-shop-order-lifecycle)
16. [Payment & Financial Flows](#16-payment--financial-flows)
17. [Real-Time Socket.io Events](#17-real-time-events)
18. [Google Maps Integration](#18-google-maps-integration)
19. [KYC & Verification Flows](#19-kyc--verification)
20. [Subscription System — Admin Configured](#20-subscription-system)
21. [Banner & Promotion System](#21-banner--promotion-system)
22. [Ads System — Future Monetization](#22-ads-system)
23. [Notification System](#23-notification-system)
24. [Chat System](#24-chat-system)
25. [Admin Panel — All 25 Modules](#25-admin-panel-modules)
26. [Mobile App Screens Reference](#26-mobile-app-screens)
27. [Security Architecture](#27-security-architecture)
28. [Scalability & Performance](#28-scalability--performance)
29. [Missing Parts & Recommendations](#29-missing-parts--recommendations)
30. [Complete Money Flow Summary](#30-complete-money-flow-summary)

---

## 1. PLATFORM OVERVIEW

**Kwickly** is a multi-sided marketplace platform with four distinct actor types, **each with their own wallet**:

| Actor | What They Do | Own Wallet |
|-------|-------------|-----------|
| **Customer** | Books home services (plumber, electrician, AC, etc.) and orders products from local shops | ✅ Customer Wallet |
| **Worker** | Verified service professionals who Quote (bid) on customer jobs and complete them | ✅ Worker Wallet |
| **Shop Owner** | Runs a local product shop; lists products and fulfils delivery orders | ✅ Shop Wallet |
| **Admin** | Platform operator — manages all users, KYC, finances, subscriptions, banners, ads, promotions, settings. Also acts as shop/service provider on behalf of shops and workers. **All money flows through Admin Wallet FIRST** | ✅ Admin Wallet (Treasury) |

**Two Core Business Lines:**
1. **Service Jobs** — Customer posts job → Workers submit Quotes → Customer accepts → Worker arrives (Arrival OTP) → Work done (Completion OTP) → Payment flows: Customer → Admin → Worker (after commission)
2. **Shop Orders** — Customer browses shops → Cart → Order → Shop processes → OTP delivery → Revenue flows: Customer → Admin → Shop (after settlement & commission)

> **KEY RULE:** Every rupee entering or leaving the platform **MUST pass through the Admin Wallet first**. There are no direct peer-to-peer transfers.

---

## 2. TECHNOLOGY STACK

### Mobile App
| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | React Native (Android + iOS) | Cross-platform mobile |
| Navigation | React Navigation v6 | Screen routing |
| State | Context API (Auth, Theme) | Global state |
| HTTP | Axios with interceptors | REST API calls |
| Real-time | Socket.io-client | Live job/order updates |
| Maps | **Google Maps SDK** (react-native-maps) | Location, routing, tracking |
| UI | Custom components, Lucide icons, LinearGradient | Premium UI |

### Backend API
| Layer | Technology | Purpose |
|-------|-----------|---------|
| Runtime | Node.js + Express.js | API server |
| Database | MongoDB + Mongoose | Primary data store |
| Cache | **Redis** (ioredis) | Sessions, OTP, settings, rate-limit |
| Real-time | Socket.io + Redis adapter | Bidirectional events |
| Auth | JWT (30-day) + bcryptjs | Stateless authentication |
| Payments | **Razorpay** | Orders, capture, refund, webhooks |
| Maps/Geo | **Google Maps Platform APIs** | Geocoding, Distance Matrix, Directions |
| Logging | Winston | Structured logs |
| Security | Helmet, CORS, Redis rate-limit | Defense in depth |

### Admin Panel
| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | React + Vite | Fast SPA build |
| Routing | React Router v6 | 25-module navigation |
| Charts | Recharts | Analytics dashboards |
| Maps | Google Maps JS API | Worker/shop location heatmaps |

---

## 3. SYSTEM ARCHITECTURE DIAGRAM

```
╔═══════════════════════════════════════════════════════════════════╗
║                 KWICKLY PLATFORM ARCHITECTURE                     ║
╠══════════════╦═══════════════════════════════╦════════════════════╣
║ MOBILE APP   ║   BACKEND API (Node.js)        ║  ADMIN PANEL       ║
║ React Native ║   Port: 5000                   ║  React + Vite      ║
║              ║                                ║                    ║
║ Customer App ║   REST API /api/v1/...         ║  25 Modules:       ║
║ Worker App   ║   Socket.io Real-time          ║  Dashboard, Users, ║
║ Shop App     ║   27 Backend Modules           ║  Workers, Shops,   ║
║              ║                                ║  KYC, Finance,     ║
║ Google Maps  ║   ┌──────────────────────┐     ║  Banners, Ads,     ║
║ SDK embedded ║   │  MongoDB Database    │     ║  Promotions,       ║
║              ║   │  22+ Collections     │     ║  Settings, etc.    ║
║              ║   │                      │     ║                    ║
║              ║   │  customers           │     ║  Google Maps JS    ║
║              ║   │  jobs, quotes        │     ║  API for admin     ║
║              ║   │  shops, products     │     ║  map views         ║
║              ║   │  shoporders          │     ║                    ║
║              ║   │  wallettxns          │     ║                    ║
║              ║   │  adminwallet(txns)   │     ║                    ║
║              ║   │  payouts             │     ║                    ║
║              ║   │  settlements         │     ║                    ║
║              ║   │  banners, promotions │     ║                    ║
║              ║   │  ads (future)        │     ║                    ║
║              ║   │  notifications       │     ║                    ║
║              ║   │  subscriptions       │     ║                    ║
║              ║   │  categories          │     ║                    ║
║              ║   │  appsettings         │     ║                    ║
║              ║   │  audits, disputes    │     ║                    ║
║              ║   └──────────────────────┘     ║                    ║
║              ║                                ║                    ║
║              ║   ┌──────────────────────┐     ║                    ║
║              ║   │   REDIS CACHE LAYER  │     ║                    ║
║              ║   │  (Zero-latency reads)│     ║                    ║
║              ║   │                      │     ║                    ║
║              ║   │  session:{userId} 24h│     ║                    ║
║              ║   │  otp:{phone}     5m  │     ║                    ║
║              ║   │  app_settings   10m  │     ║                    ║
║              ║   │  categories_all  1h  │     ║                    ║
║              ║   │  shops_list_*    5m  │     ║                    ║
║              ║   │  banners_{pos}   5m  │     ║                    ║
║              ║   │  ads_active_*   10m  │     ║                    ║
║              ║   │  user:{id}:wallet 2m │     ║                    ║
║              ║   │  admin_stats_*   5m  │     ║                    ║
║              ║   │  blacklist:{tok} TTL │     ║                    ║
║              ║   └──────────────────────┘     ║                    ║
╚══════════════╩═══════════════════════════════╩════════════════════╝

EXTERNAL SERVICES:
  Razorpay (Payments) · Google Maps Platform · SMS Provider · CDN (Media)

SOCKET.IO ROOMS:
  customer_{userId} · worker_{userId} · shop_{shopId} · job_{jobId} · admin_dashboard
```

---

## 4. DATABASE SCHEMA

> **Normalized for 50,000+ users.** Purpose-built indexes on every collection. No unbounded embedded arrays. All cross-entity relations use ObjectId references.

### 4.1 Customer (`customers`) — All Roles

```
{
  // Identity
  role:           CUSTOMER | WORKER | ADMIN | SHOP   [required]
  phone:          String  [required]
  email:          String  [sparse]
  password:       String  [bcrypt, never selected]
  isVerified:     Boolean [default: false]
  isBlocked:      Boolean [default: false]
  name, profileImage, bio

  // Wallet (all roles)
  wallet: {
    balance:      Number [default: 0]
    bankDetails:  { accountNumber, ifscCode, bankName }
    upiId:        String
  }

  // KYC (WORKER, SHOP)
  kyc: {
    status:          PENDING | APPROVED | REJECTED
    rejectionReason: String
    documents: [{ type, url, uploadedAt }]
    reviewedBy:      ObjectId → Customer [admin]
    reviewedAt:      Date
  }

  // Subscription (WORKER, SHOP)
  subscription: {
    planId, planName, expiryDate, isTrial, trialEndDate
  }

  // Location (2dsphere indexed)
  activeLocation: {
    type: 'Point', coordinates: [lng, lat]
    addressDetails: { city, pincode, area, landmark }
    googlePlaceId, formattedAddress, updatedAt
  }

  // Addresses (CUSTOMER)
  addresses: [{
    isPrimary, label, street, city, area, pincode, landmark
    googlePlaceId, formattedAddress
    location: { type: 'Point', coordinates: [lng, lat] }
  }]

  // WORKER-specific
  serviceRadius:    Number [km, default: 10]
  services: [{
    category:        ObjectId → Category
    subcategories:   [String]
    isActive:        Boolean
    yearsOfExp:      Number
    basePriceFrom:   Number
  }]
  isOnline:         Boolean [default: false]
  jobsCompleted:    Number  [denormalized counter]
  rating:           { average, count }
  availability:     { mon..sun: Boolean, startTime, endTime }
  languages:        [String]

  // Push Notifications
  fcmToken:         String  [Firebase device token]
  notificationPreferences: { jobUpdates, promotions, payments, chat }

  // Referral
  referralCode:     String  [unique auto-generated]
  referredBy:       ObjectId → Customer
  referralCount:    Number

  city:             String  [indexed]
  createdAt, updatedAt
}

INDEXES:
  { phone, role } unique compound
  { email, role } unique partial (where email exists)
  { role }
  { 'kyc.status' }
  { isVerified, isBlocked }
  { activeLocation } 2dsphere
  { city, role, isOnline }
  { referralCode } unique
  { 'subscription.expiryDate' }
```

### 4.2 Job (`jobs`)

```
{
  customerId, workerId
  category, subcategory, description, media: [String]
  preferredDate, timeSlot: urgent|morning|afternoon|evening

  status: BROADCASTING → QUOTES_RECEIVED → ALLOCATED →
          ARRIVING → IN_PROGRESS → COMPLETED → PAID → CLOSED | CANCELLED

  location: { type: 'Point', coordinates: [lng, lat] }
  addressDetails, googlePlaceId, formattedAddress

  payment: {
    amount, platformFee, workerPayout, status,
    taxes: { platformGst: Number, orderTax: Number } [for legal compliance]
    method: WALLET|CASH|UPI|CARD
    razorpayOrderId, razorpayPaymentId
  }
  promoCode: String
  promoDiscount: Number [platform bears this cost]

  security: {
    arrivalOtp, completionOtp
  }

  completionDetails: { media, report, completedAt }

  rating: {
    customerRating: { score, review }
    workerRating:   { score, review }
    createdAt
  }

  cancellation: { cancelledBy, reason, cancelledAt, refundAmount }
  adminNote
  createdAt, updatedAt
}

INDEXES:
  { location } 2dsphere
  { customerId, createdAt: -1 }
  { workerId, createdAt: -1 }
  { status, createdAt: -1 }
  { 'payment.status' }
  { category, status }
```

### 4.3 Quote (`quotes`)

```
{
  jobId, workerId
  amount, description
  timeToReach, distanceKm
  workerLocation: { type: 'Point', coordinates: [lng, lat] }
  status: PENDING | ACCEPTED | REJECTED | WITHDRAWN
  respondedAt
  createdAt, updatedAt
}

INDEXES:
  { jobId, status }
  { workerId, status }
  { jobId, workerId } unique partial
```

### 4.4 Shop (`shops`)

```
{
  ownerId:          ObjectId → Customer [unique]
  name, category, description, logoUrl, bannerUrl, tags: [String]

  subscription:     { planId, planName, validUntil }

  address, googlePlaceId, formattedAddress
  location:         { type: 'Point', coordinates: [lng, lat] }

  businessHours: {
    mon|tue|wed|thu|fri|sat|sun: { open, close, isOpen }
    isAlwaysOpen: Boolean
  }

  delivery: {
    radiusKm, fee, freeAbove, minOrder, estimatedMinutes
  }

  kyc: {
    status, rejectionReason, documents, reviewedBy, reviewedAt
  }

  payoutMethods: [{ type: BANK|UPI, label, detail, isPrimary, isVerified }]

  wallet:           { balance: Number }

  isOnline, rating, ratingCount, totalOrders
  isFeatured, featuredUntil

  createdAt, updatedAt
}

INDEXES:
  { ownerId } unique
  { location } 2dsphere
  { 'kyc.status' }
  { category, isOnline }
  { name } text
  { isFeatured, featuredUntil }
```

### 4.5 Product (`products`)

```
{
  shopId:          ObjectId → Shop [required]
  name, description, price, originalPrice
  category, subcategory
  images:          [String] [multiple CDN URLs]
  stock, unit, sku
  isActive, isFeatured
  adBoostActive, adBoostExpiry   [for ads integration]
  rating, ratingCount, soldCount
  createdAt, updatedAt
}

INDEXES:
  { shopId, isActive }
  { category, isActive }
  { name } text
  { isFeatured }
```

### 4.6 ShopOrder (`shoporders`)

```
{
  orderNumber:      String [ORD-YYYY-NNNN, unique]
  shopId, customerId

  items: [{ productId, name, price, qty, image, unit }]
  subtotal, deliveryFee, discount, total

  deliveryAddress, googlePlaceId, formattedAddress
  deliveryLocation: { type: 'Point', coordinates: [lng, lat] }
  deliveryOtp:      String [4-digit]

  payment: { amount, status, method, razorpayOrderId, razorpayPaymentId }
  taxes: { platformGst: Number, orderTax: Number } [for legal compliance]
  promoCode, promoDiscount

  status: NEW → CONFIRMED → PACKING → ASSIGNED →
          OUT_FOR_DELIVERY → DELIVERED | CANCELLED | REJECTED

  statusHistory: [{ status, timestamp, note, updatedBy }]
  deliveryStaffId: ObjectId → Customer
  adminNote
  createdAt, updatedAt
}

INDEXES:
  { shopId, createdAt: -1 }
  { customerId, createdAt: -1 }
  { status, createdAt: -1 }
  { orderNumber } unique
```

### 4.7 WalletTransaction (`wallettxns`)

```
{
  userId:           ObjectId → Customer
  shopId:           ObjectId → Shop

  type: TOPUP | JOB_CREDIT | JOB_DEBIT | ORDER_PAYMENT | ORDER_CREDIT |
        WITHDRAWAL | REFUND | ADJUSTMENT | SUBSCRIPTION | COMMISSION |
        CASHBACK | REFERRAL_BONUS | AD_PAYMENT

  amount:           Number [always positive]
  direction:        CREDIT | DEBIT
  balance:          Number [running balance AFTER this transaction]

  refId:            String [Job._id | Order._id | etc.]
  refModel:         String [Job | ShopOrder | Payout | Subscription]

  status:           COMPLETED | PENDING | FAILED | REVERSED
  description:      String
  performedBy:      ObjectId → Customer [admin for adjustments]
  adminNote:        String
  adminWalletTxnId: ObjectId → AdminWalletTxn

  createdAt  [indexed]
}

INDEXES:
  { userId, createdAt: -1 }
  { shopId, createdAt: -1 }
  { type, createdAt: -1 }
  { refId }
  { status }
```

### 4.8 AdminWallet & AdminWalletTxn

```
// AdminWallet (singleton document)
{
  balance:        Number [platform treasury]
  totalCollected: Number [lifetime commissions]
  totalDisbursed: Number [lifetime payouts]
  updatedAt
}

// AdminWalletTxn
{
  type: COMMISSION_COLLECTED | SHOP_PAYOUT | WORKER_PAYOUT |
        TOPUP | REFUND | ADJUSTMENT | AD_REVENUE | SUBSCRIPTION_REVENUE

  amount, balanceAfter, description
  referenceId, referenceModel
  meta: { performedBy, jobId, orderId, workerId, shopId, customerId }
  createdAt
}
```

### 4.9 Payout (`payouts`)

```
{
  workerId, shopId, requestedBy
  amount, paymentMethod: UPI|BANK|RAZORPAY_PAYOUT
  paymentDetails, status: PENDING|PROCESSING|COMPLETED|REJECTED
  processedBy, processedAt, rejectionReason
  txnReference, walletTxnId
  createdAt, updatedAt
}
```

### 4.10 Settlement (`settlements`)

```
{
  type: PRODUCT_ORDER | SERVICE_JOB
  orderId, shopId, workerId, customerId
  totalAmount, platformCommission, shopEarning
  status: PENDING | SETTLED | DISPUTED | CANCELLED
  settledAt, settledBy, note
  disputeId, reversedAt, reversalReason
  createdAt
}
```

### 4.11 Banner (`banners`)

```
{
  title, subtitle, imageUrl
  linkType: SHOP|PRODUCT|CATEGORY|EXTERNAL|NONE
  linkValue, position: HOME_TOP|HOME_MIDDLE|SHOP_PAGE|CATEGORY_PAGE
  targetRole: ALL|CUSTOMER|WORKER|SHOP
  isActive, priority, startAt, endAt
  createdBy
  impressions, clicks, ctr
}

INDEXES:
  { isActive, position, priority: -1 }
  { startAt, endAt }
```

### 4.12 Promotion (`promotions`)

```
{
  code:             String [unique, uppercase]
  title, description
  type: FLAT_DISCOUNT|PERCENTAGE_DISCOUNT|FREE_DELIVERY|FIRST_ORDER|CASHBACK
  value, maxDiscountCap, minOrderAmount
  maxUsesTotal, maxUsesPerUser, usesCount, usedBy: [ObjectId]
  appliesTo, appliesToIds, applicableRoles
  isActive, startAt, endAt, createdBy
}
```

### 4.13 Ad (`ads`) — Future

```
{
  advertiserId, advertiserType: SHOP|WORKER|EXTERNAL
  title, description, imageUrl, videoUrl, ctaText, ctaLink

  placement: HOME_BANNER|SEARCH_RESULTS|CATEGORY_PAGE|
             WORKER_LIST|SHOP_LISTING|NOTIFICATION_AD

  targetRoles: [String]
  targeting: { cities, categories, ageRange, gender, minOrders, isNewUser }

  billingType: CPC|CPM|FLAT_FEE
  budgetTotal, budgetSpent, bidAmount

  isActive, isApproved, status: DRAFT|PENDING_REVIEW|ACTIVE|PAUSED|COMPLETED|REJECTED
  startAt, endAt, reviewNote, reviewedBy

  impressions, clicks, conversions, ctr, conversionRate, revenueGenerated
  createdAt, updatedAt
}

INDEXES:
  { advertiserId }
  { placement, isActive, isApproved }
  { status }
  { startAt, endAt }
  { 'targeting.cities' }
```

### 4.14 AppSettings (Singleton)

```
{
  isSingleton: 'CONFIG' [unique]

  fees: {
    serviceJob: { fixedThreshold: 500, fixedAmount: 50, percentage: 10 }
    shopOrder:  { percentage: 10 }
  }

  wallet: {
    workerMinimumBalance: 100
    shopMinimumBalance:   0
    topupPresets:         [100, 200, 500, 1000]
    maxTopupPerDay:       Number
  }

  radius: {
    defaultKm: 15
    rounds: [{ minKm, maxKm, waitMinutes }]
  }

  otp: {
    validityMinutes: 5, maxAttempts: 5
    resendCooldownSeconds: 60, blockDurationHours: 1
  }

  subscription: {
    workerTrialDays: 90, shopTrialDays: 30
    plans: [{
      id, label, price, durationDays, features
      isActive, applicableTo, walletCredit, badgeLabel
    }]
  }

  maintenance: { mode: Boolean, message, allowedIPs }

  branding: {
    appName, logoUrl, iconUrl, primaryColor
    tagline, supportEmail, supportPhone
    playStoreUrl, appStoreUrl
  }

  maps: {
    googleMapsApiKey, defaultCenterLat, defaultCenterLng, defaultZoom
  }

  ads: {
    isEnabled: Boolean, minBudget, reviewRequired, categories: [String]
  }

  referral: {
    isEnabled: Boolean, referrerBonus, refereeBonus, minOrderForBonus
  }

  disputeCategories: [String]
  paymentMethods: { qrExpiry, cashEnabled, upiEnabled, cardEnabled }
}
```

---

## 5. REDIS CACHING ARCHITECTURE

> **Target:** Serve 85%+ of reads from Redis (sub-millisecond). DB used only for writes and cache misses. This reduces DB query load by **~70–80%** under normal traffic.

### Cache Key Schema & TTLs

```
┌─────────────────────────────────┬──────────┬──────────────────────────────┐
│  KEY PATTERN                    │   TTL    │  WHAT IT STORES              │
├─────────────────────────────────┼──────────┼──────────────────────────────┤
│  session:{userId}               │ 24 hours │ Full Customer document (auth) │
│  otp:{phone}                    │ 5 min    │ OTP code                     │
│  reset_otp:{phone}              │ 5 min    │ Password reset OTP           │
│  otp_attempts:{phone}           │ 1 hour   │ Failed attempt count         │
│  blacklist:{token}              │ Token TTL│ Blacklisted JWT tokens       │
│  rate_limit:{ip}:{route}        │ 15 min   │ Request count (rate limit)   │
├─────────────────────────────────┼──────────┼──────────────────────────────┤
│  app_settings                   │ 10 min   │ AppSettings singleton        │
│  categories_all                 │ 1 hour   │ All active categories        │
│  category:{id}                  │ 1 hour   │ Single category + subs       │
├─────────────────────────────────┼──────────┼──────────────────────────────┤
│  shops_list:{role}:{filters}    │ 5 min    │ Paginated shop list          │
│  shop:{shopId}                  │ 5 min    │ Single shop detail           │
│  shop:{shopId}:products         │ 5 min    │ Shop product catalog         │
├─────────────────────────────────┼──────────┼──────────────────────────────┤
│  banners:{position}:{role}      │ 5 min    │ Active banners by slot/role  │
│  ads:{placement}:{city}         │ 10 min   │ Active ads by placement      │
│  promotions_active              │ 5 min    │ All active promo codes       │
├─────────────────────────────────┼──────────┼──────────────────────────────┤
│  user:{id}:wallet               │ 2 min    │ Wallet balance               │
│  admin_wallet                   │ 1 min    │ Admin wallet balance         │
│  admin_stats_{range}            │ 5 min    │ Dashboard stats              │
│  admin_badge_counts             │ 1 min    │ KYC/payout pending counts    │
│  admin_ledger_{page}            │ 5 min    │ Ledger paginated data        │
├─────────────────────────────────┼──────────┼──────────────────────────────┤
│  jobs:available:{city}          │ 30 sec   │ Available jobs for workers   │
│  worker:{id}:profile            │ 5 min    │ Worker public profile        │
│  worker:{id}:eligibility        │ 1 min    │ Bid eligibility result       │
│  worker:{id}:location           │ 60 sec   │ Live location (active job)   │
└─────────────────────────────────┴──────────┴──────────────────────────────┘
```

### Cache-Through Read Pattern

```javascript
// Standard pattern used throughout all modules:
const getCachedOrFetch = async (key, ttl, fetchFn) => {
  const cached = await getCache(key);
  if (cached) return cached;          // sub-millisecond return
  const data = await fetchFn();       // DB fallback (cache miss)
  if (data) await setCache(key, data, ttl);
  return data;
};

// Example — Settings (called on EVERY job/quote operation):
const getSettings = () => getCachedOrFetch(
  'app_settings', 600,
  () => AppSettings.findOne({ isSingleton: 'CONFIG' }).lean()
);

// Example — Worker Eligibility (called before every bid):
const getWorkerEligibility = async (workerId) => {
  return getCachedOrFetch(`worker:${workerId}:eligibility`, 60, async () => {
    const worker = await Customer.findById(workerId)
      .select('kyc.status isOnline subscription wallet.balance').lean();
    const settings = await getSettings();
    const elig = {
      kycApproved: worker.kyc?.status === 'APPROVED',
      isOnline: worker.isOnline,
      subscriptionValid: worker.subscription?.isTrial ||
        (worker.subscription?.expiryDate > new Date()),
      hasSufficientBalance: (worker.wallet?.balance || 0) >=
        (settings.wallet?.workerMinimumBalance || 100)
    };
    elig.canBid = Object.values(elig).every(Boolean);
    return elig;
  });
};
```

### Cache Invalidation Rules

```
ON WRITE → Invalidate related cache keys:

User profile change     → del session:{userId}, worker:{id}:profile
Shop updated            → del shop:{shopId}, shops_list:*
Product updated         → del shop:{shopId}:products
Settings changed        → del app_settings, categories_all
Category changed        → del categories_all, category:{id}
Banner changed          → del banners:* (all positions)
Ad changed              → del ads:*
Job created             → del jobs:available:*
Job status changed      → del session:{workerId} + {customerId}
Wallet changed          → del user:{id}:wallet, admin_wallet
Admin stats event       → del admin_stats_*, admin_badge_counts
Promotion changed       → del promotions_active

PIPELINE BATCH INVALIDATION (atomic):
const pipeline = redis.pipeline();
pipeline.del('app_settings');
pipeline.del('admin_stats_week');
pipeline.del('admin_badge_counts');
await pipeline.exec();

RESPONSE TIME TARGETS:
  Cache HIT:   < 1ms (Redis memory lookup)
  Cache MISS:  < 30ms (DB query + Redis SET)
  P95 target:  < 50ms end-to-end API response
  Cache ratio: > 85% hits under normal load
```

---

## 6. WALLET SYSTEM

### Architecture: Admin Wallet First — Always

```
╔═══════════════════════════════════════════════════════════╗
║        KWICKLY CENTRALIZED WALLET FLOW                    ║
║                                                           ║
║  RULE: Every rupee entering/leaving the platform MUST     ║
║  pass through the Admin Wallet first. No direct           ║
║  peer-to-peer transfers ever.                             ║
╚═══════════════════════════════════════════════════════════╝

SERVICE JOB — Online Payment (₹800 job):
─────────────────────────────────────────
  Customer Wallet    −₹800   ← atomic deduction
        │
        ▼
  Admin Wallet       +₹800   ← full amount received
        │  platformFee = ₹80 (10% of ₹800)
        ├──── Admin Wallet  retains  ₹80  (commission)
        └──── Admin Wallet releases ₹720  → Worker Wallet +₹720

SERVICE JOB — Cash Payment (₹800 job):
───────────────────────────────────────
  Worker collects ₹800 cash from customer (offline)
  Admin Wallet   +₹80  ← collect commission only
  Worker Wallet  −₹80  ← deduct commission from wallet
  (Worker keeps ₹800 physical cash)

SHOP ORDER (₹500 order, 10% commission):
─────────────────────────────────────────
  [At order placement]
  Customer Wallet  −₹500  ← deducted atomically
  Admin Wallet     +₹500  ← holds pending settlement

  [Admin settles after delivery]
  Admin Wallet     −₹450  → Shop Wallet +₹450  (90% to shop)
  Admin Wallet     retains ₹50  (10% commission)

WALLET TOPUP (customer adds ₹500 via Razorpay):
────────────────────────────────────────────────
  Razorpay captures ₹500
  Admin Wallet   +₹500  ← platform receives
  Customer Wallet +₹500  ← credited back to customer
  Net Admin:       ₹0    (topup is pass-through; revenue from fees)

WORKER SUBSCRIPTION (₹299/month):
───────────────────────────────────
  Razorpay captures ₹299
  Admin Wallet   +₹299  ← subscription revenue booked
  Worker Wallet  +₹299  ← credited as wallet recharge
  (Worker earns ₹299 credit + 30-day validity)
  Admin earns per-job commissions on wallet balance usage
```

### Four Separate Wallets

```
1. CUSTOMER WALLET  (Customer.wallet.balance)
   Credits IN:  TOPUP, REFUND, CASHBACK, REFERRAL_BONUS
   Debits OUT:  ORDER_PAYMENT, JOB_PAYMENT, ADJUSTMENT

2. WORKER WALLET  (Customer.wallet.balance for WORKER role)
   Credits IN:  JOB_CREDIT, TOPUP (subscription), REFUND, ADJUSTMENT
   Debits OUT:  JOB_DEBIT (cash job commission), WITHDRAWAL, ADJUSTMENT

3. SHOP WALLET  (Shop.wallet.balance)
   Credits IN:  ORDER_CREDIT (settlements), ADJUSTMENT
   Debits OUT:  WITHDRAWAL, ADJUSTMENT

4. ADMIN WALLET  (AdminWallet.balance — Platform Treasury)
   Credits IN:  ALL customer payments, commissions, subscriptions, ad revenue
   Debits OUT:  Worker payouts, shop settlements, refunds, adjustments
```

### Atomic Transaction Guards

```javascript
// Prevents negative balance — ALWAYS used for deductions:
const atomicDeduct = async (userId, amount, session) => {
  const updated = await Customer.findOneAndUpdate(
    { _id: userId, 'wallet.balance': { $gte: amount } }, // ← guard
    { $inc: { 'wallet.balance': -amount } },
    { new: true, session }
  );
  if (!updated) throw new Error('Insufficient balance'); // ← rollback
  return updated;
};

// Full MongoDB transaction wrapping all financial operations:
const session = await mongoose.startSession();
session.startTransaction();
try {
  await atomicDeduct(customerId, amount, session);  // 1. Deduct customer
  await creditAdminWallet(amount, session);          // 2. Credit admin
  await creditWorkerWallet(payout, session);         // 3. Credit worker
  await createWalletTxns(..., session);              // 4. Record all txns
  await session.commitTransaction();
} catch(e) {
  await session.abortTransaction(); // ← ALL steps rolled back on failure
  throw e;
}
```

---

## 7. API ROUTES REFERENCE

### Base URL: `/api/v1`

| Module | Path | Notes |
|--------|------|-------|
| Auth | `/auth` | check-status, send-otp, verify-otp, login, logout, set-password, forgot/reset-password, /me, /fcm-token |
| Jobs | `/jobs` | CRUD + start, complete, pay, rate, reassign, export |
| Quotes | `/quotes` | place, list-by-job, worker-list, accept, withdraw |
| Workers | `/workers` | profile, kyc, bank, services, location, online, addresses, earnings, withdraw |
| Shops | `/shops` | CRUD + kyc, toggle, payout-methods, withdraw, delivery-config |
| Products | `/products` | CRUD + toggle, stock-update, bulk-stock |
| Shop Orders | `/shoporders` | place, customer-list, shop-list, detail, cancel, status-update, invoice |
| Wallet | `/wallet` | balance, topup, withdraw, transactions, admin-adjust |
| Payments | `/payments` | create-order, verify, webhook, refund, history |
| Subscriptions | `/subscriptions` | subscribe, my, plans-list (admin CRUD via settings) |
| Notifications | `/notifications` | list, mark-read, mark-all-read, send-broadcast (admin) |
| Chat | `/chat` | history (Socket.io for real-time) |
| Categories | `/categories` | CRUD |
| Promotions | `/promotions` | CRUD + validate |
| Banners | `/banners` | CRUD + by-position + impression/click tracking |
| Ads | `/ads` | create, list, detail, pause, admin-approve/reject |
| Payouts | `/payouts` | admin list + process (complete/reject) |
| Settlements | `/settlements` | list, settle, bulk-settle |
| Admin | `/admin` | dashboard, users, workers, shops, jobs, KYC, finance, settings, banners, ads, reports |
| Admin Wallet | `/admin/admin-wallet` | balance, transactions, manual topup |
| Disputes | `/disputes` | list, respond, admin-resolve |
| Settings | `/settings` | get, update (admin), branding (public) |
| Audit | `/audit` | admin activity log |

---

## 8. USER ROLES & PERMISSION MATRIX

```
ACTION                      | CUSTOMER | WORKER | SHOP | ADMIN
────────────────────────────┼──────────┼────────┼──────┼──────
Create job                  │    ✅    │   ❌   │  ❌  │  ✅
View own jobs               │    ✅    │   ❌   │  ❌  │  ❌
View available jobs         │    ❌    │   ✅   │  ❌  │  ❌
Place quote                 │    ❌    │   ✅   │  ❌  │  ❌
Accept quote                │    ✅    │   ❌   │  ❌  │  ❌
Start job (arrivalOTP)      │    ❌    │   ✅   │  ❌  │  ❌
Complete job                │    ❌    │   ✅   │  ❌  │  ❌
Pay for job                 │    ✅    │   ❌   │  ❌  │  ❌
Rate worker                 │    ✅    │   ❌   │  ❌  │  ❌
Cancel job                  │    ❌    │   ❌   │  ❌  │  ✅
────────────────────────────┼──────────┼────────┼──────┼──────
Place shop order            │    ✅    │   ❌   │  ❌  │  ✅
Update order status         │    ❌    │   ❌   │  ✅  │  ✅
Confirm delivery (OTP)      │    ❌    │   ❌   │  ✅  │  ✅
────────────────────────────┼──────────┼────────┼──────┼──────
Create/manage shop          │    ❌    │   ❌   │  ✅  │  ✅
Manage products             │    ❌    │   ❌   │  ✅  │  ✅
────────────────────────────┼──────────┼────────┼──────┼──────
Wallet topup                │    ✅    │   ✅   │  ❌  │  ✅
Wallet withdraw             │    ❌    │   ✅   │  ✅  │  ❌
Wallet adjustment (admin)   │    ❌    │   ❌   │  ❌  │  ✅
────────────────────────────┼──────────┼────────┼──────┼──────
Create/edit banners         │    ❌    │   ❌   │  ❌  │  ✅
Create/edit promotions      │    ❌    │   ❌   │  ❌  │  ✅
Configure subscriptions     │    ❌    │   ❌   │  ❌  │  ✅
Configure platform settings │    ❌    │   ❌   │  ❌  │  ✅
Approve/reject KYC          │    ❌    │   ❌   │  ❌  │  ✅
Process payouts             │    ❌    │   ❌   │  ❌  │  ✅
Process settlements         │    ❌    │   ❌   │  ❌  │  ✅
Impersonate user            │    ❌    │   ❌   │  ❌  │  ✅
```

---

## 9. AUTHENTICATION FLOW

```
APP LAUNCH → SplashScreen
├── Check AsyncStorage for JWT token
├── If found → POST /auth/me → validate not blacklisted
│   ├── Valid → route to role tabs (Redis session:{userId})
│   └── Invalid → clear storage → RoleSelection
└── No token → RoleSelection

ROLE SELECTION
└── Choose CUSTOMER | WORKER | SHOP → LoginScreen

LOGIN (OTP Mode):
1. POST /auth/send-otp { phone }
   ├── [Mitigation: OTP Bombing] Check Redis rate limit (max 3 req/15min)
   ├── Check Redis: otp_attempts:{phone} >= 5 → 429 (blocked 1hr)
   ├── SMS service sends OTP code
   ├── Redis SET otp:{phone} {code} EX 300 (5 min)
   └── Redis INCR otp_attempts:{phone} EX 3600

2. POST /auth/verify-otp { phone, code, role }
   ├── Redis GET otp:{phone} → compare
   ├── Match: DEL otp:{phone}, DEL otp_attempts:{phone}
   ├── Find or CREATE Customer { phone, role }
   ├── Generate JWT: { id, role } exp 30d
   ├── Redis SET session:{userId} {user} EX 86400
   └── Return { token, user, isNew }

LOGIN (Password Mode):
POST /auth/login { phone, password, role }
├── DB lookup Customer { phone, role }
├── bcrypt.compare(password, hash)
├── Generate JWT, cache session
└── Return { token, user }

ROUTING after login:
├── CUSTOMER → CustomerTabs (5 main tabs)
├── WORKER   → WorkerTabs (5 main tabs)
└── SHOP     → ShopTabs (5 main tabs)

AUTH MIDDLEWARE (every protected request):
├── Extract Bearer token
├── Redis: GET blacklist:{token} → if exists: 401 Unauthorized
├── JWT.verify(token, JWT_SECRET)
├── Redis: GET session:{userId} → fast path (no DB)
├── If not cached: Customer.findById → re-cache
└── Set req.user = userDoc

LOGOUT:
├── POST /auth/logout
├── Redis SET blacklist:{token} 1 EX {remaining_ttl}
├── Redis DEL session:{userId}
└── Client: clear AsyncStorage

PASSWORD MANAGEMENT:
├── PATCH /auth/set-password → bcrypt hash + save
├── POST /auth/forgot-password → send reset OTP
└── POST /auth/reset-password { phone, code, newPassword }
```

---

## 10. CUSTOMER FLOW

### Mobile Tabs: Home | Shop | Book (FAB) | Wallet | Profile

### A. Registration & Setup
```
1. Register via OTP (phone + CUSTOMER role)
2. Profile completion: name, photo, email
3. Add address via Google Places Autocomplete
   → googlePlaceId + coordinates saved
4. First address auto-set as primary (syncs activeLocation)
5. Optional: set password for future logins
```

### B. Booking a Service Job

```
STEP 1: Home → category grid (Redis cached 1h)
STEP 2: Category → SubCategories → DescribeJob

STEP 3: DescribeJobScreen
├── Problem description + photo upload
├── Preferred date + time slot
├── Address: saved list | GPS | Google Places search
└── POST /jobs { category, subcategory, description, media,
                 preferredDate, timeSlot, location, addressDetails, googlePlaceId }

STEP 4: Backend creates job
├── Status: BROADCASTING
├── Query eligible workers (geospatial + filters):
│   role=WORKER + isVerified + kyc.APPROVED + isOnline +
│   subscription_valid + wallet.balance >= minimum +
│   activeLocation $geoWithin radiusKm
├── Socket.io: emitToAll('NEW_JOB_ALERT', jobData)
└── FCM push to eligible workers

STEP 5: Live Bids (LiveBidsScreen)
├── Socket: JOIN_CUSTOMER_ROOM + JOIN_JOB_ROOM
├── Real-time: NEW_QUOTE events update list
├── GET /quotes/job/:jobId → sorted by amount (cheapest first)
├── Each card: worker photo, name, rating, amount (₹), ETA, distance
├── [Mitigation: Quote Sniping] Sealed Bids: Workers can only see their own quote; they cannot see competitor prices.
└── Tap worker → WorkerProfileScreen (services, reviews, past jobs)

STEP 6: Accept Quote (atomic)
├── PATCH /quotes/:quoteId/accept
├── findOneAndUpdate Job with status guard → ALLOCATED
├── Sets: workerId, payment.amount, arrivalOtp, completionOtp
├── [Mitigation: Bait & Switch] The accepted quote amount is locked. The worker cannot arbitrarily increase the price offline; they must submit a revised quote via the app which the customer must explicitly accept.
├── Rejects all other PENDING quotes
├── Socket/FCM: worker receives QUOTE_ACCEPTED
└── Customer sees: worker name, ETA, address confirmation

STEP 7: Live Worker Tracking (LiveTrackingScreen)
├── Google Maps MapView with Google provider
├── Worker marker moves: WORKER_LOCATION_UPDATE → WORKER_LOCATION events
├── Google Directions API: route polyline on map
├── Google Distance Matrix API: live ETA string
├── Customer sees: arrivalOtp displayed (show to worker)
└── In-app chat available: ChatScreen

STEP 7.5: [Mitigation: Stuck Jobs / Ghosting]
└── Auto-Timeout: If the worker does not start the job within (ETA + 15 minutes), the backend auto-cancels the allocation, penalizes the worker, and rebroadcasts the job.

STEP 8: Worker Starts (arrivalOtp)
├── Worker enters OTP → PATCH /jobs/:id/start { arrivalOtp }
├── [Mitigation: GPS Spoofing] Backend validates worker's live location is within 200m of job.location
├── Job: IN_PROGRESS, timer starts
└── Socket: customer sees "Work in Progress"

STEP 9: Job Completed
├── Worker marks complete → PATCH /jobs/:id/complete { media, report }
├── Socket: JOB_COMPLETED → customer
└── WorkCompletedScreen: view worker's photos + report

STEP 10: Payment
├── Customer applies promo code (optional) → checks validity, calculates `promoDiscount`
├── Enter completionOtp + select method: WALLET | UPI | CARD | CASH
├── PATCH /jobs/:id/pay { method, completionOtp, amountReceived, promoCode }
├── Backend (MongoDB transaction):
│   ├── Validate completionOtp and Promo Code
│   ├── ONLINE: [Mitigation: Double-Spend] Atomic $inc deduction (Customer −₹(800-discount)) → Admin +(800-discount) → Worker +₹720. Platform absorbs the promo discount from its commission.
│   └── CASH: Admin +₹80 commission, Worker −₹80 from wallet
│       ├── [Mitigation: Cash Payment Evasion] If Worker wallet drops < ₹0, their `isOnline` is forced to false until debt is cleared.
│       └── [Mitigation: Worker Short-Changing] If customer pays less than quoted, worker reports "Partial Payment". Job status becomes DISPUTED and automatic commission deduction is frozen pending Admin review.
├── Job status: PAID (or DISPUTED)
└── Proceed to rating

STEP 11: Rate Worker
├── POST /jobs/:id/rate { score: 1-5, review }
└── [Mitigation: Rating Extortion] Double-blind system: Reviews are hidden until both parties rate each other or 3 days pass.

STEP 12: History
└── GET /jobs/my → PastJobDetailsScreen (timeline, invoice download)
```

### C. Shopping from Shops
```
ShopScreen → featured shops (isFeatured) + nearby (geospatial)
ShopDetailScreen → products by category → Add to Cart
CartScreen → apply promo code → select address → checkout
POST /shoporders 
├── [Mitigation: Inventory Race Condition] Atomic stock update: `updateOne({_id, stock: {$gte: qty}}, {$inc: {stock: -qty}})`
OrderTrackingScreen → live status (Socket.io) → show deliveryOtp to rider
Cancel (only if NEW status) → stock restored + wallet refunded
```

### D. Wallet
```
CustomerWalletScreen:
├── Balance + transaction history (all types)
└── Topup: WalletTopupScreen → Razorpay → POST /wallet/topup
```

---

## 11. WORKER FLOW

### Mobile Tabs: Jobs | Quotes | Earnings | Services | Profile

### A. Onboarding
```
1. Register (OTP → WORKER role)
2. Complete profile: name, city, bio, languages, photo
3. Upload KYC: AADHAR/PAN/LICENSE → admin reviews
4. Set services: categories + subcategories + experience
5. Set location: GPS → Google Geocoding → activeLocation
6. Trial period auto-starts (admin-configured days, default 90)
```

### B. Subscription (Admin Configured Plans)
```
GET /subscriptions/plans → plan cards from AppSettings.subscription.plans
Select plan → Razorpay checkout → POST /subscriptions/subscribe { planId, paymentId }
Backend:
  ├── Extend subscription.expiryDate
  ├── Credit Worker Wallet +walletCredit (recharge model)
  ├── Admin Wallet +plan.price (revenue)
  └── Create history record + WalletTxn: TOPUP

Plans admin configures:
  Trial: Free, 90 days (no wallet credit)
  Monthly: ₹299, 30d, +₹299 wallet credit
  Quarterly: ₹799, 90d, +₹879 wallet credit (10% bonus)
  Yearly: ₹2499, 365d, +₹3124 wallet credit (25% bonus)
```

### C. Going Online & Bidding
```
Toggle online: PATCH /workers/online { isOnline: true }
GET /jobs/available → backend validates (cached eligibility):
  KYC APPROVED + isOnline + subscription_valid + wallet.balance >= minimum

Real-time: Socket NEW_JOB_ALERT events
Place quote: POST /quotes { jobId, amount, description, workerLocation }
  ├── ETA: Haversine or Google Distance Matrix
  ├── Job status: BROADCASTING → QUOTES_RECEIVED
  └── Customer gets NEW_QUOTE socket event
```

### D. Job Execution
```
QUOTE_ACCEPTED socket → WorkerNavigateJobScreen
Google Maps navigation to customer location
Share live location: WORKER_LOCATION_UPDATE (every 10-15 sec)

WorkerArrivalOTPScreen: enter customer's 4-digit arrivalOtp
PATCH /jobs/:id/start → Job: IN_PROGRESS

WorkerActiveJobScreen → do work → chat with customer
WorkerJobCompleteScreen: upload photos, write report
PATCH /jobs/:id/complete → customer gets JOB_COMPLETED
[Mitigation: Customer Non-Payment] If a job is COMPLETED but not PAID within 24 hours, the worker can raise a Dispute. Admin reviews chat/photos to force-deduct from customer or suspend them.

On JOB_PAID socket:
  Online: Wallet +payout
  Cash: Wallet -commission (worker keeps physical cash)
WorkerRateCustomerScreen → done
```

### E. Earnings (WorkerEarningsScreen)
```
Summary (Redis 2 min): Total earned, This Month, This Week, Avg/job, Total jobs
Chart: GET /workers/earnings/chart?period=week|month
Transactions: JOB_CREDIT, JOB_DEBIT, TOPUP, WITHDRAWAL
Withdraw: POST /workers/earnings/withdraw { amount, payoutMethod }
  → Atomic deduction → PENDING Payout → admin processes
```

---

## 12. SHOP FLOW

### Mobile Tabs: Dashboard | Orders | Products | Wallet | Settings

### A. Registration & KYC
```
Register (OTP → SHOP role) → CreateShopScreen
POST /shops { name, category, address, location, delivery, businessHours }
Upload KYC: Business Reg, GST, Owner ID → admin approves
On APPROVED: shop visible to customers
```

### B. Subscription (Admin Configured)
```
GET /subscriptions/plans (filtered applicableTo=SHOP)
Plans: FREE_TRIAL → MONTHLY → QUARTERLY → YEARLY
Purchase → visibility extension + features
```

### C. Products
```
List: GET /products?shopId=:id (Redis 5 min)
Add: POST /products { name, description, price, images, stock, unit }
Edit: PATCH /products/:id
Toggle: PATCH /products/:id/toggle
Bulk stock: PATCH /products/bulk-stock [{ productId, stock }]
```

### D. Order Processing
```
New order → Socket NEW_ORDER → FCM push → badge count
CONFIRMED → PACKING → OUT_FOR_DELIVERY → DELIVERED
Delivery: PATCH /shoporders/:id/status { status:'DELIVERED', otp:'XXXX' }
  ├── OTP validated against deliveryOtp
  ├── [Mitigation: COD Evasion] If order is CASH on Delivery, Admin's 10% commission is atomically deducted from Shop Wallet. If balance drops < ₹0, shop is locked (isOnline=false) until debt is cleared.
  ├── Settlement created (PENDING): { shopEarning: 90%, platformCommission: 10% }
  ├── Order: DELIVERED
  └── Customer: ORDER_DELIVERED socket + FCM

Cancel (any status before DELIVERED):
  ├── Stock restored
  └── Customer refunded if already paid (wallet)
```

### E. Shop Wallet & Withdrawals
```
Balance: GET /wallet/balance
Add payout method: POST /shops/my/payout-methods { type: UPI|BANK, detail }
Withdraw: POST /shops/my/withdraw { amount, payoutMethod }
  → Atomic deduction → PENDING Payout → admin processes → bank/UPI transfer
```

### F. Delivery Config
```
PATCH /shops/my/delivery-config
{ deliveryRadiusKm, minOrderAmount, freeDeliveryAbove, deliveryCharge,
  estimatedMinutes, sameDayDelivery, deliverySlots }
```

---

## 13. ADMIN FLOW

### Admin Panel: 25 Modules

### A. Dashboard
```
GET /admin/stats?range=today|week|month|quarter|year (Redis 5 min)
Returns: totalCustomers, totalWorkers, totalShops, activeJobs, totalRevenue,
         connectedClients (Socket.io), chartData 7-day, activities, topWorkers

GET /admin/badges (Redis 1 min)
Returns: kyc, shopKyc, payouts, disputes, suggestions counts

Socket: admin_dashboard room receives DASHBOARD_UPDATE on every major event
[Mitigation: Rogue Admin] All sensitive admin actions (wallet adjustments, setting changes, payouts) are locked behind SUPER_ADMIN role and emit an immutable Audit log entry to the `audits` collection.
```

### B. Subscription Configuration
```
Admin owns ALL subscription plan definitions:
PATCH /admin/settings {
  subscription: {
    workerTrialDays: 90,
    shopTrialDays: 30,
    plans: [
      { id:'monthly', label:'Monthly Pro', price:299, durationDays:30,
        features:['Unlimited bids','Priority listing'], isActive:true,
        applicableTo:['WORKER'], walletCredit:299, badgeLabel:'' },
      { id:'quarterly', label:'Quarterly', price:799, durationDays:90,
        features:[...], isActive:true, applicableTo:['WORKER'],
        walletCredit:879, badgeLabel:'POPULAR' },
      { id:'shop_monthly', label:'Shop Monthly', price:499, durationDays:30,
        features:['Featured listing','Analytics'], isActive:true,
        applicableTo:['SHOP'], walletCredit:0, badgeLabel:'' }
    ]
  }
}
Mobile reads plans from: GET /subscriptions/plans (Redis cached 10 min)
```

### C. Banner Management
```
POST /admin/banners {
  title, subtitle, imageUrl,
  linkType: SHOP|PRODUCT|CATEGORY|EXTERNAL|NONE,
  linkValue, position: HOME_TOP|HOME_MIDDLE|SHOP_PAGE|CATEGORY_PAGE,
  targetRole: ALL|CUSTOMER|WORKER|SHOP,
  isActive, priority, startAt, endAt
}

Mobile fetches: GET /banners?position=HOME_TOP (Redis 5 min)
Returns: sorted by priority DESC, only active + within schedule

Admin can schedule, target by role, track CTR
```

### D. Promotion Management
```
POST /admin/promotions {
  code: 'FIRST50', title, type: PERCENTAGE_DISCOUNT,
  value: 50, maxDiscountCap: 200, minOrderAmount: 299,
  maxUsesTotal: 1000, maxUsesPerUser: 1,
  applicableRoles: ['CUSTOMER'], isActive: true,
  startAt, endAt
}

Types: FLAT_DISCOUNT | PERCENTAGE_DISCOUNT | FREE_DELIVERY | FIRST_ORDER | CASHBACK
Mobile validates: POST /promotions/validate { code, shopId, subtotal }
```

### E. Financial Management
```
Admin Wallet Dashboard:
  GET /admin/admin-wallet/balance → { balance, totalCollected, totalDisbursed }
  GET /admin/admin-wallet/transactions → all AdminWalletTxn records

Payout Processing:
  GET /admin/payouts → pending withdrawal requests (workers + shops)
  PATCH /admin/payouts/:id/status { status: COMPLETED, txnReference: 'UTR123' }
  (Admin manually transfers via bank/UPI, then marks completed)

Settlement Processing:
  GET /admin/settlements?status=PENDING
  PATCH /admin/settlements/:id/settle { shopAmount, commissionAmount, note }
    → Shop Wallet +shopEarning
    → Admin Wallet retains commission
    → Settlement: SETTLED

Wallet Adjustments:
  POST /wallet/credit { userId, amount, description, debit: false }
    → Admin Wallet −amount, User Wallet +amount (credit)
  POST /wallet/credit { userId, amount, debit: true }
    → User Wallet −amount, Admin Wallet +amount (debit)
```

### F. KYC Review
```
GET /admin/pending-kyc → unified list (workers + shops)
PATCH /admin/workers/:id/kyc { status: 'APPROVED'|'REJECTED', reason }
  → worker.isVerified = true (on APPROVED)
  → Notification sent (in-app + socket + FCM)
  → admin_badge_counts cache invalidated

PATCH /admin/shops/:id/kyc { status: 'APPROVED'|'REJECTED' }
  → shop visible to customers (on APPROVED)
```

### G. Analytics & Reports
```
/admin/reports:
  Customer CSV: ID, name, phone, city, orders, wallet, join date
  Worker CSV:   ID, name, phone, city, category, KYC, jobs, earnings
  Shop CSV:     ID, name, category, orders, revenue, wallet, KYC
  Jobs CSV:     ID, category, worker, customer, amount, fee, status, date
  Finance CSV:  all wallet transactions

Financial Summary:
  Total GMV, Platform Revenue, Pending Liabilities, Monthly P&L
```

---

## 14. JOB LIFECYCLE

```
Customer posts job
      │
 ┌────▼──────────┐
 │  BROADCASTING  │← emitToAll NEW_JOB_ALERT + FCM push
 └────┬──────────┘  Workers see job, submit quotes
      │
 ┌────▼──────────┐
 │QUOTES_RECEIVED │← First quote arrives
 └────┬──────────┘  Customer reviews bids on LiveBidsScreen
      │ Customer accepts (atomic update)
 ┌────▼──────────┐
 │   ALLOCATED    │← workerId set, OTPs generated
 └────┬──────────┘  Other quotes REJECTED
      │              QUOTE_ACCEPTED → worker + FCM
      │ Worker navigates (Google Maps live tracking)
 ┌────▼──────────┐
 │   ARRIVING     │← (optional intermediate)
 └────┬──────────┘
      │ arrivalOtp verified
 ┌────▼──────────┐
 │  IN_PROGRESS   │← PATCH /jobs/:id/start { arrivalOtp }
 └────┬──────────┘  JOB_STARTED → customer socket
      │ Work done
 ┌────▼──────────┐
 │   COMPLETED    │← PATCH /jobs/:id/complete { media, report }
 └────┬──────────┘  JOB_COMPLETED → customer socket
      │ completionOtp + payment
 ┌────▼──────────┐
 │     PAID       │← Wallets updated atomically through Admin
 └────┬──────────┘  JOB_PAID → worker socket
      │ Customer rates
 ┌────▼──────────┐
 │    CLOSED      │← Archived
 └───────────────┘

Admin override at any point:
 ┌───────────────┐
 │  CANCELLED    │← admin only
 └───────────────┘

PLATFORM FEE:(configur by admin)
  amount <= ₹500 → platformFee = ₹50 (fixed)
  amount >  ₹500 → platformFee = amount × 10%
  workerPayout    = amount − platformFee
  [Mitigation: Delivery Fairness] For shop orders, the platform fee % is strictly applied ONLY to the `subtotal`. The `deliveryFee` goes 100% untouched to the entity executing the delivery (the Shop).
```

---

## 15. SHOP ORDER LIFECYCLE

```
POST /shoporders → atomic stock reservation
      │
 ┌────▼──────┐
 │    NEW    │← shop notified (socket + FCM)
 └────┬──────┘
      │ Shop confirms
 ┌────▼──────────┐
 │  CONFIRMED    │
 └────┬──────────┘
      │
 ┌────▼──────────┐
 │   PACKING     │
 └────┬──────────┘
      │ (optional)
 ┌────▼──────────┐
 │   ASSIGNED    │← delivery staff assigned
 └────┬──────────┘
      │
 ┌────▼─────────────┐
 │ OUT_FOR_DELIVERY  │← Google Maps tracking (delivery staff)
 └────┬─────────────┘
      │ deliveryOtp verified
 ┌────▼──────────┐
 │   DELIVERED   │← Settlement created (PENDING)
 └───────────────┘   Admin settles → Shop Wallet credited

Cancel (by customer if NEW):
  Stock restored + wallet refunded

Cancel (by shop, before OUT_FOR_DELIVERY):
  Stock restored + customer refunded if paid
```

---

## 16. PAYMENT & FINANCIAL FLOWS

### All flows through Admin Wallet

```
JOB ONLINE PAYMENT (₹800):
  Customer −₹800 → Admin +₹800 → Worker +₹720 (admin retains ₹80 fee)

JOB CASH PAYMENT (₹800):
  Worker has ₹800 cash → Admin +₹80 commission → Worker −₹80 from wallet

SHOP ORDER (₹500):
  [Checkout] Customer −₹500 → Admin +₹500 (holds)
  [Settlement] Admin −₹450 → Shop +₹450 (admin retains ₹50)

TOPUP (₹500 via Razorpay):
  Razorpay → Admin +₹500 → Customer +₹500 (pass-through)

SUBSCRIPTION (₹299):
  Razorpay → Admin +₹299 (revenue) → Worker +₹299 (wallet recharge)
```

### Razorpay Flow
```
POST /payments/create-order { amount, purpose }
→ Razorpay.orders.create({ amount: amount*100, currency:'INR' })
→ Payment record: status=CREATED

Client: Razorpay SDK checkout

POST /payments/verify { razorpayOrderId, razorpayPaymentId, signature }
→ HMAC-SHA256 signature verification (server-side)
→ Payment.status = CAPTURED
→ Wallet updated

POST /payments/webhook (Razorpay server-to-server):
  payment.captured → update payment + order
  payment.failed → restore stock + cancel order
  refund.created → credit customer wallet
```

---

## 17. REAL-TIME EVENTS

### Socket Authentication
```
JWT required in socket handshake: socket.handshake.auth.token
Server: verifies JWT, sets socket.isAuthenticated, socket.userId, socket.userRole
```

### Room Joins
| Event | Guard |
|-------|-------|
| `JOIN_CUSTOMER_ROOM { userId }` | Auth + own room |
| `JOIN_WORKER_ROOM { userId }` | Auth + own room |
| `JOIN_SHOP_ROOM { shopId }` | SHOP or ADMIN role |
| `JOIN_JOB_ROOM { jobId }` | Any authenticated |
| `JOIN_ADMIN` | ADMIN role only |

### Server → Client Events
| Event | Target Room | When |
|-------|-------------|------|
| `NEW_JOB_ALERT` | All sockets | Customer creates job |
| `NEW_QUOTE` | `customer_{id}` | Worker places quote |
| `QUOTE_ACCEPTED` | `worker_{id}` | Customer accepts quote |
| `JOB_TAKEN` | `job_{id}` | Job allocated (other bidders) |
| `JOB_STARTED` | `customer_{id}` | Worker starts (arrivalOTP) |
| `JOB_COMPLETED` | `customer_{id}` | Worker completes |
| `REQUEST_PAYMENT` | `customer_{id}` | After completion |
| `JOB_PAID` | `worker_{id}` | Customer pays |
| `WORKER_LOCATION` | `customer_{id}` | Worker GPS update |
| `NEW_ORDER` | `shop_{id}` | Customer places order |
| `ORDER_STATUS` | `customer_{id}` | Shop updates status |
| `DASHBOARD_UPDATE` | `admin_dashboard` | Any major event |
| `NEW_NOTIFICATION` | `customer/worker_{id}` | Admin sends |
| `SYNC_STATE_REQUIRED` | `worker_{id}` | Worker reconnects |

### Client → Server Events
| Event | Who | Payload |
|-------|-----|---------|
| `WORKER_LOCATION_UPDATE` | WORKER | `{ jobId, customerId, coords }` |
| `SEND_MESSAGE` | Any | `{ jobId, senderId, message }` |
| `OTP_VERIFIED` | Any | `{ jobId, customerId, workerId }` |
| `WORK_COMPLETED` | Any | `{ jobId, customerId }` |

---

## 18. GOOGLE MAPS INTEGRATION

### APIs Used

| API | Where Used |
|-----|-----------|
| Maps SDK (iOS+Android) | LiveTrackingScreen, WorkerNavigateJobScreen, ShopDetailScreen, address picker |
| Places API | Address autocomplete in all forms, shop registration |
| Geocoding API | GPS coordinates → formatted address |
| Directions API | Route polyline, turn-by-turn navigation for worker |
| Distance Matrix API | Live ETA (quote time, delivery ETA) |
| Maps JS API | Admin panel: worker/shop location heatmaps |

### Mobile Implementation
```javascript
// react-native-maps with Google provider
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

// LiveTrackingScreen
<MapView provider={PROVIDER_GOOGLE}>
  <Marker coordinate={customerLocation} title="You" />
  <Marker coordinate={workerLocation} title="Worker" image={workerPhoto} />
  <Polyline coordinates={routePolyline} strokeColor="#0E9AA7" strokeWidth={3} />
</MapView>

// Google Places Autocomplete for address input
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
<GooglePlacesAutocomplete
  query={{ key: GOOGLE_MAPS_API_KEY, language:'en', components:'country:in' }}
  onPress={(data, details) => {
    saveAddress(data.place_id, details.formatted_address,
                details.geometry.location);  // { lat, lng }
  }}
  fetchDetails={true}
/>
```

### Backend Geospatial
```javascript
// Find workers near job (MongoDB 2dsphere):
Customer.find({
  role: 'WORKER',
  activeLocation: {
    $geoWithin: {
      $centerSphere: [[jobLng, jobLat], radiusKm / 6371]
    }
  }
});

// Google Distance Matrix for quote ETA:
const res = await axios.get('https://maps.googleapis.com/maps/api/distancematrix/json', {
  params: {
    origins: `${workerLat},${workerLng}`,
    destinations: `${jobLat},${jobLng}`,
    mode: 'driving',
    key: process.env.GOOGLE_MAPS_API_KEY
  }
});
const etaMinutes = res.data.rows[0].elements[0].duration.value / 60;
```

---

## 19. KYC & VERIFICATION

### Worker KYC
```
1. Worker uploads: AADHAR|PAN|LICENSE|OTHER → CDN
2. PATCH /workers/kyc → status: PENDING, badge count increments
3. Admin reviews in /kyc panel → view document photos
4. APPROVE: worker.kyc.status=APPROVED, isVerified=true
           In-app + socket + FCM notification: "KYC Approved!"
5. REJECT: worker.kyc.status=REJECTED, rejectionReason recorded
           Notification: "KYC Rejected. Reason: [reason]. Resubmit."
6. Worker re-uploads on rejection
```

### Shop KYC
```
Documents: Business Reg, GST, Owner Aadhar/PAN
PATCH /admin/shops/:id/kyc { status, reason }
APPROVED: shop appears to customers
REJECTED: shop owner notified with reason
```

---

## 20. SUBSCRIPTION SYSTEM

### Admin Configures Everything
```
All plan data lives in: AppSettings.subscription.plans[]
Admin updates via PATCH /admin/settings { subscription: { plans: [...] } }
Cache del: app_settings → fresh data served on next request

Worker Trial:
  subscription.isTrial = true on registration
  trialEndDate = registration + workerTrialDays (admin sets, default 90)
  After trial: must subscribe to continue

Shop Trial:
  shopTrialDays: admin sets (default 30)
  After trial: must subscribe for continued features

Subscription Purchase:
  GET /subscriptions/plans → plan cards
  Select plan → Razorpay → POST /subscriptions/subscribe { planId }
  Backend:
    Extend expiryDate by durationDays
    Credit Worker Wallet +walletCredit (recharge model)
    Admin Wallet +price (revenue)
    Create WorkerSubscription history record
```

---

## 21. BANNER & PROMOTION SYSTEM

### Banners (Admin-Created, App-Displayed)
```
Admin creates banner → stored in banners collection
App fetches: GET /banners?position=HOME_TOP (Redis cached 5 min)
Returns: isActive + within startAt/endAt + sorted by priority DESC

Banner positions in mobile:
  HOME_TOP       → Carousel at top of HomeScreen
  HOME_MIDDLE    → Banner below category grid
  SHOP_PAGE      → Top of ShopScreen
  CATEGORY_PAGE  → Top of SubCategoriesScreen

Link actions on tap:
  SHOP      → ShopDetailScreen { shopId }
  PRODUCT   → ProductDetailScreen { productId }
  CATEGORY  → SubCategoriesScreen { category }
  EXTERNAL  → in-app browser
  NONE      → no action

Analytics: impressions + clicks tracked → CTR displayed in admin
```

### Promotions (Admin-Created, Customer-Applied)
```
Admin creates: POST /admin/promotions { code, type, value, ... }
Customer applies at cart: POST /promotions/validate { code, shopId, subtotal }
  → Redis: check promotions_active
  → Validate: active, within dates, usage limits, min amount, user role
  → Return discount amount

Types:
  FLAT_DISCOUNT       → ₹X off
  PERCENTAGE_DISCOUNT → X% off (capped at maxDiscountCap)
  FREE_DELIVERY       → deliveryFee = 0
  FIRST_ORDER         → only for users with 0 orders
  CASHBACK            → ₹X credited to wallet after delivery
```

---

## 22. ADS SYSTEM

### Overview
```
Phase 1 (Current): Admin-managed banners (free for all shops)
Phase 2 (Near-term): Self-serve ads for shops/workers
Phase 3 (Future): Programmatic/third-party advertisers

Ad Placements:
  HOME_BANNER      → top carousel (promoted slot)
  SEARCH_RESULTS   → between organic results
  CATEGORY_PAGE    → when browsing a service category
  WORKER_LIST      → promoted worker card
  SHOP_LISTING     → promoted shop card
  NOTIFICATION_AD  → in notification feed
```

### Ad Billing Model
```
CPC (Cost Per Click):
  advertiser bids ₹X per click
  budget exhausted when budgetSpent = budgetTotal

CPM (Cost Per 1000 Impressions):
  advertiser pays ₹X per 1000 views

FLAT_FEE:
  fixed ₹ for ad period (admin negotiated)
```

### Ad Revenue Flow
```
User clicks Shop ad (CPC bid: ₹5):
  Advertiser (Shop) Wallet   −₹5   [atomic deduction]
  Admin Wallet               +₹5   [ad revenue]
  AdminWalletTxn: type=AD_REVENUE
  WalletTxn (shop): type=AD_PAYMENT
```

### Ad Admin Flow
```
Advertiser creates ad → status: PENDING_REVIEW
Admin reviews: GET /admin/ads?status=PENDING_REVIEW
PATCH /admin/ads/:id/approve → status: ACTIVE

Ad served: GET /ads?placement=SHOP_LISTING&city=Bangalore
  → Redis: ads:SHOP_LISTING:Bangalore TTL 10 min
  → Filter: active + approved + within budget + within schedule
  → Sort: bidAmount DESC (highest bidder shown first)

Analytics per ad: impressions, clicks, conversions, CTR, revenue attributed
Admin ad dashboard: total ad revenue, active campaigns, top performers
```

---

## 23. NOTIFICATION SYSTEM

### Delivery Channels
```
1. IN-APP:     stored in Notification collection, NotificationsScreen
2. SOCKET.IO:  NEW_NOTIFICATION event to user's room (real-time)
3. FCM PUSH:   Firebase Cloud Messaging (device tray notification)
               Token: Customer.fcmToken (updated on each login)
               PATCH /auth/fcm-token { token }
```

### Key Auto-Notifications
| Trigger | Message | Channels |
|---------|---------|---------|
| KYC Approved | "KYC approved! Start accepting jobs." | In-app + Socket + FCM |
| KYC Rejected | "KYC rejected. [reason]. Resubmit." | In-app + Socket + FCM |
| Shop KYC Approved | "Your shop is now live!" | In-app + Socket + FCM |
| Quote Accepted | "Your quote was accepted. Navigate to customer." | In-app + Socket + FCM |
| Job Paid | "₹720 credited to your wallet!" | In-app + Socket + FCM |
| New Order | "New order #ORD-2026-0042 received!" | Socket + FCM |
| Order Delivered | "Your order has been delivered!" | In-app + Socket + FCM |
| Settlement | "₹4,500 settled to your wallet." | In-app + FCM |
| Subscription Expiry | "Plan expires in 7 days. Renew now." | FCM (scheduled) |

### Admin Broadcast
```
POST /admin/notifications/send {
  title, message, targetRole: ALL|CUSTOMER|WORKER|SHOP,
  imageUrl, deepLink: 'kwickly://shop'
}

Backend:
  Create Notification records (bulk insert)
  Socket: emit NEW_NOTIFICATION to role-specific rooms
  FCM: batch send to all fcmTokens (500 per batch, chunked for 50k users)
```

---

## 24. CHAT SYSTEM

### Real-time In-App Chat
```
Both parties join: JOIN_JOB_ROOM { jobId }

Worker sends: SEND_MESSAGE { jobId, senderId, senderRole, message, timestamp }
Server validates: socket.userId === senderId
Server broadcasts: NEW_MESSAGE → job_{jobId} room

Persistence:
  Messages stored in Message collection: { jobId, senderId, senderRole, message, timestamp }
  GET /chat/:jobId → history for job

Features:
  ├── Bubble layout (customer left, worker right)
  ├── Typing indicator (TYPING socket event)
  ├── Timestamp labels
  └── Image sharing (future)
```

---

## 25. ADMIN PANEL MODULES

| # | Route | Purpose |
|---|-------|---------|
| 1 | `/` | Dashboard: real-time stats, 7-day chart, activity feed, top workers |
| 2 | `/users` | Customer CRUD, job history, wallet, orders, impersonate, CSV export |
| 3 | `/workers` | Worker CRUD, KYC review, docs, earnings, wallet adjust |
| 4 | `/shops` | Shop CRUD, KYC, wallet credit/debit, product view, featured toggle |
| 5 | `/jobs` | All jobs, cancel, reassign, status filter, CSV export |
| 6 | `/kyc` | Unified KYC queue (workers + shops), one-click approve/reject |
| 7 | `/categories` | Service category CRUD, subcategories, display order |
| 8 | `/payouts` | Pending withdrawal requests, process with UTR reference |
| 9 | `/wallets` | All wallets, credit/debit adjustments, balance view |
| 10 | `/admin-wallet` | Platform treasury: balance, full txn history, P&L |
| 11 | `/subscriptions` | Subscription history, plan analytics |
| 12 | `/ledger` | Complete financial audit trail |
| 13 | `/orders` | All shop orders, cancel, issue refund |
| 14 | `/settlements` | Pending settlements, single/bulk settle |
| 15 | `/promotions` | Promo code CRUD, usage analytics, revenue impact |
| 16 | `/banners` | Banner CRUD, position, schedule, CTR analytics |
| 17 | `/ads` | Campaign review, approve/reject, revenue analytics |
| 18 | `/disputes` | Dispute queue, resolution workflow, refund trigger |
| 19 | `/notifications` | Broadcast push notifications, delivery stats |
| 20 | `/reports` | CSV exports: customers, workers, jobs, orders, finance |
| 21 | `/admin-users` | Admin account management, activity log |
| 22 | `/settings` | Platform config: fees, wallet limits, subscriptions, maps, ads, branding, maintenance |
| 23 | `/analytics` | GMV trends, funnel analysis, cohort, revenue by city |
| 24 | `/map-view` | Live worker/shop locations on Google Maps |
| 25 | `/audit` | All admin actions with actor/action/timestamp |

---

## 26. MOBILE APP SCREENS

### Auth (Common)
SplashScreen → RoleSelection → LoginScreen → OTPVerifyScreen → SetPasswordScreen

### Customer (28 Screens)
| Screen | Purpose |
|--------|---------|
| HomeScreen | Active jobs, shop banner, categories, past jobs |
| BookServiceScreen | Category browser |
| SubCategoriesScreen | Service subcategory list |
| DescribeJobScreen | Job form + Google Places address |
| LiveBidsScreen | Real-time quotes view & accept |
| LiveTrackingScreen | Google Maps: worker moving to customer |
| WorkCompletedScreen | Pay (OTP + method) |
| RateExperienceScreen | 1-5 star rating |
| PastJobDetailsScreen | Job history + invoice |
| WorkerProfileScreen | Worker public profile |
| ShopScreen | Browse shops (map + list) |
| ShopDetailScreen | Products catalog + add to cart |
| CartScreen | Cart + promo + checkout |
| ShopOrderDetailsScreen | Order tracking (live) |
| CustomerShopOrdersScreen | All shop orders |
| OrderTrackingScreen | Google Maps order status |
| OrderHistoryScreen | Past orders + invoice download |
| CustomerWalletScreen | Balance, transactions, topup |
| WalletTopupScreen | Razorpay topup flow |
| ProfileScreen | Settings menu |
| EditProfileScreen | Name, photo, email |
| SavedAddressesScreen | Google Places address management |
| PaymentMethodsScreen | Saved cards/UPI |
| ReferEarnScreen | Referral code share |
| HelpSupportScreen | FAQ + ticket |
| PrivacyScreen | Privacy policy |
| NotificationsScreen | In-app notifications |
| ChatScreen | Real-time job chat |

### Worker (13 Screens)
| Screen | Purpose |
|--------|---------|
| WorkerDashboard | Available jobs + online toggle |
| WorkerMyQuotesScreen | Quote history |
| WorkerEarningsScreen | Summary, chart, transactions, withdraw |
| WorkerManageServicesScreen | Service categories setup |
| WorkerProfileScreen | Profile, KYC, bank, subscription |
| WorkerJobDetailsScreen | Job detail before quoting |
| WorkerNavigateJobScreen | Google Maps navigation to customer |
| WorkerArrivalOTPScreen | Enter 4-digit arrival OTP |
| WorkerActiveJobScreen | In-progress dashboard + chat |
| WorkerJobCompleteScreen | Mark complete + upload media |
| WorkerRateCustomerScreen | Rate customer |
| WorkerJobCanceledScreen | Cancellation notice |
| ChatScreen | Job chat |

### Shop (10 Screens)
| Screen | Purpose |
|--------|---------|
| ShopDashboardScreen | Orders summary, wallet, notifications |
| ShopOrdersScreen | Order list with status filter |
| ShopProductsScreen | Product CRUD + stock |
| ShopWalletScreen | Balance, transactions, withdrawal |
| ShopSettingsScreen | Profile, delivery, payout methods |
| CreateShopScreen | New shop registration |
| ShopOrderDetailScreen | Order management + delivery OTP |
| ShopDeliveryConfigScreen | Radius, fees, slots |
| ShopNotificationsScreen | Order + KYC notifications |

---

## 27. SECURITY ARCHITECTURE

### Defense in Depth Layers

```
LAYER 1: Network
  HTTPS/TLS · CORS whitelist · Helmet.js (XSS, HSTS, CSP)
  Rate limiting (Redis-backed):
    Global: 100 req/15min per IP
    Auth:   20 req/15min
    OTP:    5 req/hour per phone (block 1hr after 5 fails)

LAYER 2: Authentication
  JWT tokens (30-day) + Redis blacklist on logout
  Redis session cache (no DB hit per request)
  OTP: 5-min expiry, rate-limited, attempts counted in Redis
  bcrypt cost factor 12 for passwords

LAYER 3: Authorization
  authMiddleware: JWT verify + session cache
  authorize(role): role-based route guard
  Socket.io: role guards on every room join event
  Owner guards: can only access own resources

LAYER 4: Data Integrity
  Atomic wallet ops: findOneAndUpdate + $gte balance guard
  MongoDB transactions: multi-step financial operations
  Job acceptance: findOneAndUpdate with status guard (race prevention)
  Stock reservation: per-item atomic $inc (prevents overselling)
  Razorpay: HMAC-SHA256 signature verification
  Webhook: secret-based signature validation

LAYER 5: Input Validation
  Joi schemas on all endpoints
  express-mongo-sanitize (NoSQL injection prevention)
  Body size limit: 10kb
  File upload: type check + size limit + CDN storage

LAYER 6: Admin Security
  ADMIN role required for all /admin/* routes
  All admin actions logged in AuditLog
  Impersonation: 1h token, logged, flagged as isImpersonated
  Maintenance mode: IP whitelist bypass

LAYER 7: Infrastructure
  Fail-fast: JWT_SECRET, MONGO_URI checked at startup
  Graceful shutdown on SIGTERM
  Structured logging (Winston, log levels)
  No secrets in code (env vars only)
```

---

## 28. SCALABILITY & PERFORMANCE

### Database Optimization

```
ALL QUERIES USE INDEXES:
  Geospatial:    2dsphere on activeLocation, shop.location
  User lists:    { role, kyc.status, isOnline, city } compound
  Job feed:      { status, createdAt:-1 } + { category, status }
  Transactions:  { userId, createdAt:-1 }
  Order lists:   { shopId, createdAt:-1 } + { customerId, createdAt:-1 }
  Search:        Text indexes on shop.name, product.name

AGGREGATION CACHING:
  Admin stats: cached 5 min (most expensive query)
  Badge counts: cached 1 min
  Earnings summary: cached 2 min
  Top workers: computed in background, cached 10 min

DENORMALIZATION (controlled for performance):
  Customer.jobsCompleted → updated on each JOB_PAID event
  Shop.totalOrders → updated on each DELIVERED event
  Worker.rating.average → running average (no aggregation needed)
  Category.activeWorkers → background job updates periodically

PAGINATION:
  All list APIs: page + limit parameters
  Large datasets (>10k): cursor-based pagination
  Count queries: cached separately
```

### Redis Optimization Impact

```
BEFORE Redis:
  Auth middleware → DB query × every request → ~200-300ms avg

AFTER Redis:
  Auth middleware → Redis GET session:{userId} → < 1ms
  Settings lookup → Redis GET app_settings → < 1ms
  Categories → Redis GET categories_all → < 1ms
  P95 response time → < 50ms

CACHE HIT RATIO TARGETS: > 85%
REDIS MEMORY (50k users): ~100MB (compressed JSON)
REDIS PERSISTENCE: RDB snapshots every 5 minutes
```

### Horizontal Scaling

```
Production architecture:
  [Nginx Load Balancer] → sticky sessions
       ├── [Node.js #1 :5000]
       ├── [Node.js #2 :5001]
       └── [Node.js #3 :5002]
            │
  ┌─────────┼─────────────┐
  │         │             │
[MongoDB  [Redis        [Socket.io
 Replica   Cluster]      Redis Adapter]
  Set]     3 nodes       (shared pub/sub
  3 nodes               across instances)

CAPACITY ESTIMATES:
  50,000 registered users
  5,000 concurrent users (10% concurrency)
  1,500 socket connections (3 instances)
  2,000+ API requests/minute
  MongoDB: ~10GB/year
```

### Worker Location Updates (Real-time Performance)
```
OPTIMIZATION:
  Throttle: emit every 10 seconds (not every GPS ping)
  Store in Redis ONLY while job active:
    SET worker:{id}:location {coords} EX 60
  On job complete: persist final snapshot to DB
  Never write every GPS update to MongoDB

RESULT: ~1000 active workers × 1 update/10sec = 100 writes/sec to Redis
        vs 1000 writes/sec to MongoDB (10x reduction)
```

---

## 29. MISSING PARTS & RECOMMENDATIONS

### Currently Missing — Should Be Added

1. **FCM Push Integration** — Store `fcmToken` per user (PATCH /auth/fcm-token), batch send via `firebase-admin` SDK

2. **Referral System** — Auto-generate `referralCode` on signup, apply referral bonus (from AppSettings.referral) to both referrer and referee via Admin Wallet

3. **Background Location** — For workers with active jobs: `react-native-background-geolocation` to continue GPS updates even when app is backgrounded

4. **Deep Linking** — Scheme `kwickly://`: `/job/{id}`, `/shop/{id}`, `/order/{id}`, `/wallet`, `/notifications` — used in FCM notifications, banners, emails

5. **Expanded Dispute Resolution** — Structured workflow: customer initiates → worker responds → admin mediates → auto-refund on decision → timer-based escalation

6. **Worker Scheduling/Availability** — Calendar-based availability, customer can book future slots, reminder notifications

7. **Two-Way Rating System** — Workers rate customers (currently one-way); customers rate shops; admin can flag/remove reviews

8. **GST Invoice Generation** — Worker GST invoices, shop B2B invoices, PDF export (server-side Puppeteer), email delivery

9. **Multi-Language Support (i18n)** — Hindi, Kannada, Tamil, Telugu, Bengali via i18next in mobile app

10. **Delivery Staff Module** — Full delivery staff app login, today's deliveries, navigation, OTP input for delivery confirmation

11. **Advanced Analytics** — User growth chart, job conversion funnel, revenue per city heatmap, CLV, churn rate, ad performance

12. **Maintenance Mode in App** — App checks `AppSettings.maintenance.mode` at launch — shows maintenance screen if true, with admin's custom message

---

## 30. COMPLETE MONEY FLOW SUMMARY

```
ALL MONEY FLOWS THROUGH ADMIN WALLET — NO EXCEPTIONS
═════════════════════════════════════════════════════

INFLOWS TO ADMIN WALLET:           OUTFLOWS FROM ADMIN WALLET:
┌───────────────────────────┐      ┌────────────────────────────┐
│ ✅ Customer job payments  │      │ ❌ Worker net payouts       │
│ ✅ Customer order payments│      │ ❌ Shop settlements         │
│ ✅ Worker subscriptions   │      │ ❌ Customer refunds         │
│ ✅ Shop subscriptions     │      │ ❌ Wallet credit bonuses    │
│ ✅ Ad campaign budgets    │      │ ❌ Referral bonuses         │
│    (future)               │      │    (future)                │
│ ✅ Platform top-ups       │      │                            │
└───────────────────────────┘      └────────────────────────────┘

NET PLATFORM PROFIT = Job Commissions + Order Commissions + Ad Revenue

EXAMPLE MONTH (simplified):
  100 jobs × ₹500 avg × 10% = ₹5,000 job commission
  50 orders × ₹300 avg × 10% = ₹1,500 order commission
  Workers subscriptions × 20 = ₹5,980
  Ads (future) = ₹2,000
  ─────────────────────────────
  Total Platform Revenue = ₹14,480/month
```

## 31. CRITICAL LOOPHOLES & MITIGATION STRATEGIES

To ensure the platform operates smoothly at scale (50,000+ users), the following loopholes have been identified along with their architectural mitigations:

### 31.1 Cash Payment Evasion (The "Off-Platform" Loophole)
* **Risk:** Worker completes the job, takes cash, but leaves their wallet balance negative if the platform fee is higher than their available balance, then abandons the app.
* **Mitigation:** 
  1. **Minimum Bidding Balance:** Workers MUST have a minimum balance (e.g., ₹100) to receive job broadcasts.
  2. **Negative Balance Lock:** If a cash job drops their wallet below ₹0, the backend automatically flags `isOnline = false` and locks them from receiving new jobs until they top-up.
  3. **Debt Tracking:** The `wallettxns` schema supports negative balances. The debt is automatically recovered from their next online payment.

### 31.2 Wallet Double-Spending (Concurrency Race Conditions)
* **Risk:** A user initiates a withdrawal while simultaneously booking a job, tricking the system into spending the same balance twice.
* **Mitigation:**
  1. All financial deductions MUST use MongoDB Atomic Operators: `$inc: { 'wallet.balance': -amount }`.
  2. The query MUST include a guard clause: `{ _id: userId, 'wallet.balance': { $gte: amount } }`.
  3. MongoDB Sessions/Transactions are used for multi-document financial updates (e.g., Customer → Admin Wallet).

### 31.3 GPS Spoofing (Fake Worker Locations)
* **Risk:** Workers use GPS spoofing apps to appear closer to lucrative jobs or mark jobs as "Arrived" when they aren't at the location.
* **Mitigation:**
  1. **Arrival Geofence Verification:** When `PATCH /api/v1/jobs/:id/start` is called, the backend calculates the distance between the worker's current coordinates and the `job.location`. It must be $\le$ 200 meters.
  2. **Arrival OTP:** Even if spoofed, the worker needs the customer's physical `arrivalOtp`.

### 31.4 SMS Cost Exhaustion (OTP Bombing)
* **Risk:** Malicious bots spam the `/send-otp` endpoint, incurring massive SMS gateway costs for the platform.
* **Mitigation:**
  1. Redis Rate Limiting is strictly enforced on the OTP route (e.g., max 3 requests per phone number per 15 minutes).
  2. CAPTCHA or App Attestation required for new device registrations.

### 31.5 Shop Inventory Race Conditions
* **Risk:** Two customers order the last remaining product at the exact same millisecond.
* **Mitigation:**
  1. The cart checkout API uses atomic `$inc` checks: `ShopOrder` creation only succeeds if `Product.updateOne({ _id: prodId, stock: { $gte: qty } }, { $inc: { stock: -qty } })` returns modifiedCount > 0.

### 31.6 Quote Sniping & Bidding Wars
* **Risk:** Workers wait until the last second to undercut others, leading to poor quality service.
* **Mitigation:** The quoting system hides other workers' bids from the worker. It is a "sealed bid" system. Customers see all quotes, but workers only see their own.

### 31.7 Tax Compliance & GST (Legal Loophole)
* **Risk:** Platform charges commission without accounting for GST, leading to legal non-compliance and massive fines.
* **Mitigation:** The `payment` sub-schema in both `jobs` and `shoporders` tracks explicit `taxes: { platformGst, orderTax }` fields. Platform commission (e.g., 10%) must be clearly split into Base Fee + 18% GST (in India) during invoicing and settlement.

### 31.8 The "Delivery Fee" Commission Unfairness
* **Risk:** If a customer orders ₹500 of products + ₹100 delivery fee, and the platform blindly takes 10% of the ₹600 Total, the shop is unfairly penalized on delivery costs.
* **Mitigation:** Platform commission logic is strictly applied **only to the `subtotal`** (product value). The `deliveryFee` is passed 100% to the entity handling the delivery (the Shop).

### 31.9 Worker Short-Changing (Partial Cash Payments)
* **Risk:** A customer only hands the worker ₹500 for an ₹800 cash job. If the worker marks it PAID, the platform automatically deducts ₹80 (10% of 800) from the worker's wallet, unfairly taxing them on money they never received.
* **Mitigation:** During the Cash collection flow, the worker has a **"Report Partial Payment"** option. This instantly shifts the job to a `DISPUTED` status, freezing the automatic commission deduction and alerting the Admin to mediate.

---

*📄 Document generated from complete code analysis of the Kwickly platform codebase.*  
*📁 Mobile: `mobile/src/` · Backend: `backend/src/` · Admin: `admin/src/`*  
*🔄 Update whenever major features are added or modified.*
