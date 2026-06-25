# KWICKLY PLATFORM — Complete Codebase Analysis

## Overview

Kwickly is a multi-role service marketplace platform with **4 distinct user roles**:
1. **CUSTOMER** — End users who book services / order products
2. **WORKER** — Service providers who bid on and complete jobs
3. **SHOP** — Product sellers with inventory management
4. **ADMIN** (Super Admin) — Platform operator managing everything

The platform consists of 3 codebases:
- **Backend** (`backend/`) — Node.js/Express + MongoDB + Socket.io + Redis + Razorpay
- **Mobile App** (`mobile/`) — React Native (iOS + Android)
- **Admin Panel** (`admin/`) — React (Vite) web dashboard

---

## 1. BACKEND ARCHITECTURE

### Tech Stack
- **Runtime**: Node.js with Express 5
- **Database**: MongoDB with Mongoose ODM
- **Caching**: Redis (session cache, OTP store, rate limiting, settings cache)
- **Auth**: JWT (JSON Web Tokens) with token blacklisting
- **Real-time**: Socket.io (WebSocket + polling)
- **Payments**: Razorpay integration
- **SMS**: Twilio/Fast2SMS for OTP
- **Security**: Helmet, rate limiting, CORS whitelist

### Core Files Structure (`backend/src/`)

| Path | Purpose |
|------|---------|
| `app.js` | Express app setup: CORS, helmet, compression, routes registration |
| `server.js` | Entry point: loads env, connects DB, initializes socket, starts HTTP |
| `config/db.js` | MongoDB connection with connection pooling (min:5, max:20) |
| `middleware/auth.middleware.js` | JWT verification + Redis session cache (24h TTL) + token blacklist |
| `middleware/role.middleware.js` | Role-based access control (authorize(...roles)) |
| `middleware/rateLimit.middleware.js` | Redis-backed rate limiting per route |
| `middleware/validate.middleware.js` | Joi schema validation middleware |
| `helpers/socket.helper.js` | Socket.io initialization with JWT auth for real-time events |
| `helpers/razorpay.helper.js` | Razorpay API wrapper (create order, verify, capture, refund) |
| `helpers/redis.helper.js` | Redis client wrapper (getCache, setCache, delCache, etc.) |

### API Routes (All registered in `app.js`)

```
/api/v1/auth              → Authentication & OTP
/api/v1/admin             → Super Admin operations
/api/v1/customers         → Customer profile & management
/api/v1/categories        → Service categories
/api/v1/jobs              → Job CRUD, broadcasting, lifecycle
/api/v1/payouts           → Worker/Shop payout requests
/api/v1/settings          → Platform settings
/api/v1/notifications     → Push notifications
/api/v1/quotes            → Worker bidding on jobs
/api/v1/shops             → Shop management
/api/v1/products          → Shop product inventory
/api/v1/shoporders        → Shop order processing
/api/v1/subscriptions     → Worker subscription plans
/api/v1/wallet            → Wallet operations (top-up, transactions)
/api/v1/workers           → Worker profile, KYC, earnings
/api/v1/chat              → Real-time messaging
/api/v1/cart              → Customer shopping cart
/api/v1/delivery-staff    → Delivery personnel
/api/v1/promotions        → Promo codes & campaigns
/api/v1/payments          → Razorpay payment processing
/api/v1/admin/admin-wallet → Admin revenue wallet
```

---

## 2. DATABASE SCHEMA

### `Customer` Model (Unified user model for CUSTOMER, WORKER, ADMIN)
- **Shared fields**: `role` (enum), `phone`, `email`, `password`, `name`, `profileImage`, `isVerified`
- **Worker-only fields**: `wallet` (balance, bankDetails, upiId), `kyc` (status, documents), `subscription` (planId, expiryDate, isTrial), `activeLocation` (GeoJSON), `serviceRadius`, `services[]` (categories they offer), `isOnline`, `rating`
- **Indexes**: Phone+role unique index, 2dsphere on location, composite indexes for worker queries

### `Job` Model (Service jobs lifecycle)
- **Status flow**: `BROADCASTING → QUOTES_RECEIVED → ALLOCATED → ARRIVING → IN_PROGRESS → COMPLETED → PAID → CLOSED / CANCELLED`
- Fields: `customerId`, `workerId`, `category`, `subcategory`, `description`, `location` (GeoJSON), `broadcast` (round, radiusKm), `payment` (amount, platformFee, gst, workerPayout, razorpay details), `security` (arrivalOtp, completionOtp), `completionDetails`, `rating`
- **Indexes**: 2dsphere on location, customerId+createdAt, workerId+createdAt, status+createdAt

### `Quote` Model (Worker bids on jobs)
- Fields: `jobId`, `workerId`, `amount`, `description`, `timeToReach`, `status` (PENDING/ACCEPTED/REJECTED/WITHDRAWN), `workerLocation`
- One worker can place only ONE active quote per job (unique constraint enforced)

### `Shop` Model (Separate from Customer model)
- Fields: `ownerId` (ref to Customer with role SHOP), `name`, `category`, `description`, `logoUrl`, `subscription` (plan, validUntil), `address`, `location` (GeoJSON), `businessHours`, `delivery` (radiusKm, fee, freeAbove), `kyc`, `payoutMethods`, `wallet` (balance), `isOnline`, `rating`, `totalOrders`

### `ShopOrder` Model (Product orders from shops)
- **Status flow**: `NEW → CONFIRMED → PACKING → OUT_FOR_DELIVERY → DELIVERED / CANCELLED`
- Fields: `orderNumber`, `shopId`, `customerId`, `items[]`, `subtotal`, `deliveryFee`, `discount`, `total`, `deliveryAddress`, `deliveryLocation`, `deliveryOtp`, `payment`, `promoCode`

### `Payment` Model (Razorpay transactions)
- Fields: `razorpayOrderId`, `razorpayPaymentId`, `razorpaySignature`, `amount`, `userId`, `orderId` (link to shop order), `jobId` (link to job), `status` (CREATED/AUTHORIZED/CAPTURED/REFUNDED/FAILED), `method`

### `WalletTxn` Model (Wallet transactions)
- Fields: `userId`, `type` (CREDIT/DEBIT), `amount`, `balanceBefore`, `balanceAfter`, `reference` (jobId/orderId), `description`, `status`, `razorpayPaymentId`

---

## 3. ROLE-BASED FLOWS

### 3A. CUSTOMER FLOW (Mobile App)

**Navigation**: `RootNavigator → CustomerTabs (Home | Shop | Book | Wallet | Profile)`

#### Authentication Flow:
1. User opens app → **SplashScreen** → **RoleSelection** (pick CUSTOMER)
2. **LoginScreen** → Enter phone number → Send OTP
3. **OTPVerifyScreen** → Verify OTP → JWT token issued
4. **SetPasswordScreen** (optional) → Set password for future email login
5. Token + role stored in AsyncStorage → `RootNavigator` routes to `CustomerTabs`

#### Job Booking Flow (Service Hiring):
1. **HomeScreen**: Browse categories, view featured services, search
2. **BookServiceScreen** → Pick category → **SubCategoriesScreen**
3. **DescribeJobScreen**: Enter job details, prefered date/time, location on map
4. Job created → Status: `BROADCASTING` → Workers notified via Socket.io
5. **LiveBidsScreen**: View quotes from workers in real-time (sealed bids)
6. Accept a quote → Job status: `ALLOCATED`
7. **LiveTrackingScreen**: Track worker location when status is `ARRIVING`
8. Worker starts job → `IN_PROGRESS` → **LiveTrackingScreen** shows progress
9. Worker completes → **RateExperienceScreen**: Rate & review the worker
10. Payment triggered via Razorpay (optional: cash on completion)

#### Shop Order Flow (Product Ordering):
1. **ShopScreen**: Browse shops/products, search by category
2. **ShopDetailScreen**: View products, add to cart
3. **CartScreen**: Review cart, apply promo codes
4. Checkout → Create Razorpay order → Payment verification
5. **OrderTrackingScreen**: Track order through NEW → CONFIRMED → PACKING → OUT_FOR_DELIVERY → DELIVERED
6. **OrderHistoryScreen**: View past orders

#### Wallet & Profile:
- **CustomerWalletScreen**: View balance, top-up via Razorpay, transaction history
- **ProfileScreen**: Edit profile, saved addresses, payment methods
- **ReferEarnScreen**: Referral program
- **QuotesScreen**: View quotes received for jobs

---

### 3B. WORKER FLOW (Mobile App)

**Navigation**: `RootNavigator → WorkerTabs (Jobs | Quotes | Earnings | Services | Profile)`

#### Onboarding Flow:
1. Register as WORKER via OTP
2. Complete profile: Name, profile image, bio
3. **WorkerManageServicesScreen**: Select service categories they offer
4. **Upload KYC documents**: Aadhaar, PAN, License
5. Wait for **Admin KYC approval** → Status: `APPROVED`
6. Set wallet minimum balance (₹100 required)
7. Go online (`isOnline: true`)

#### Job Discovery & Bidding:
1. **WorkerDashboard** (Jobs tab): See available jobs matching their categories within their service radius
2. Jobs filtered by 8 eligibility criteria:
   - Role=WORKER, isVerified, KYC approved, isOnline
   - Valid subscription (trial OR paid)
   - Wallet balance ≥ minimum (₹100)
   - Has matching active service category
   - Job is within worker's OWN serviceRadius (not global)
3. **WorkerJobDetailsScreen**: View job details, customer info, distance, ETA
4. **Place quote** (sealed bid): Worker submits amount + description + time to reach
5. Wait for customer to accept/reject quote

#### Job Execution Flow:
1. Customer accepts quote → Job status: `ALLOCATED`
2. **WorkerNavigateJobScreen**: Get directions to customer location
3. Worker arrives → Enter **Arrival OTP** (from customer) → Status: `IN_PROGRESS`
4. **WorkerActiveJobScreen**: Track job progress, complete tasks
5. **WorkerJobCompleteScreen**: Upload completion photos, report
6. **WorkerRateCustomerScreen**: Rate the customer
7. Payment processed: Platform fee deducted, worker payout calculated

#### Earnings & Wallet:
- **WorkerEarningsScreen**: Summary, charts, transaction history
- Request withdrawal to bank account/UPI
- **Wallet**: View balance, top-up history

---

### 3C. SHOP FLOW (Mobile App)

**Navigation**: `RootNavigator → ShopTabs (Dashboard | Orders | Products | Wallet | Settings)`

#### Onboarding:
1. Register as SHOP via OTP
2. **CreateShopScreen**: Fill shop details:
   - Shop name, category, description
   - Logo image upload
   - Address with map pin
   - Business hours (Mon-Fri, Sat, Sun)
   - Delivery configuration (radius, fee, free-above amount)
3. Upload KYC documents → Wait for admin approval

#### Product Management:
1. **ShopProductsScreen**: Add/edit/delete products
   - Product name, description, price, stock quantity
   - Category assignment, images
2. Inventory management with stock tracking

#### Order Management:
1. **ShopOrdersScreen**: View incoming orders in real-time
2. **ShopOrderDetailScreen**: 
   - View order items, customer details
   - Update status: CONFIRMED → PACKING → OUT_FOR_DELIVERY → DELIVERED
   - Generate delivery OTP
   - Assign delivery staff
3. View order history

#### Shop Wallet:
- **ShopWalletScreen**: View earnings, settlement history
- Payout methods (Bank account / UPI) management
- Withdrawal requests

---

### 3D. ADMIN FLOW (Web Panel)

**Tech**: React (Vite) with React Router v6

#### Admin Auth:
- **Login** (`/login`): Email + password authentication
- Token stored in localStorage: `kwickly_admin_token`
- All routes wrapped in `AppLayout` which checks authentication

#### Admin Dashboard Modules:

| Module | Route | Functionality |
|--------|-------|---------------|
| **Dashboard** | `/` | Platform stats: users, jobs, revenue, charts |
| **Users** | `/users` | CRUD customer accounts, impersonate, export |
| **Workers** | `/workers` | View/filter workers, KYC management, export |
| **Shops** | `/shops` | Full shop management, KYC, wallet, payout methods |
| **Jobs** | `/jobs` | All jobs, filter by status, view details, create job on behalf |
| **KYC** | `/kyc` | Pending KYC approvals for workers & shops |
| **Categories** | `/categories` | Manage service categories |
| **Payouts** | `/payouts` | Approve/reject worker & shop payout requests |
| **Wallets** | `/wallets` | View all user wallets, force credit/debit |
| **Admin Wallet** | `/admin-wallet` | Platform revenue wallet |
| **Subscriptions** | `/subscriptions` | Worker subscription plan management |
| **Orders** | `/orders` | Shop orders management |
| **Settlements** | `/settlements` | Shop settlement cycles |
| **Promotions** | `/promotions` | Promo codes, campaigns |
| **Disputes** | `/disputes` | Handle reported disputes |
| **Ledger** | `/ledger` | Financial ledger (all transactions) |
| **Reports** | `/reports` | Analytics reports |
| **Notifications** | `/notifications` | Send push notifications to users |
| **Admin Users** | `/admin-users` | Manage other admin accounts |
| **Settings** | `/settings` | Platform config (radius, fees, maintenance, branding) |

#### Admin Backend Routes (`/api/v1/admin`):
- **Dashboard**: GET `/stats`, `/badges`, `/health`, `/ledger`
- **Users**: CRUD, toggle status, delete, impersonate, view jobs/orders
- **Workers**: View, KYC approval (`PATCH /workers/:id/kyc`), document management
- **Shops**: Full CRUD, wallet credit/debit, payout methods, KYC docs
- **Jobs**: View all, export, create/update admin-side
- **Payouts**: View, approve/reject (`PATCH /payouts/:id/status`)
- **Categories**: Standard CRUD
- **Disputes**: View, update status
- **Settings**: All platform settings

---

## 4. REAL-TIME COMMUNICATION (Socket.io)

### Socket Events Flow:

```
User connects → JWT auth middleware on socket handshake
  ├── Authenticated: socket.userId + socket.userRole set
  └── Unauthenticated: allowed only for admin dashboard

Rooms (joined by client code):
  ├── `worker_{userId}`       → Workers receive new job alerts
  ├── `customer_{userId}`     → Customers get quote updates, job status
  ├── `admin_dashboard`       → Admin gets live dashboard updates
  ├── Chat rooms              → Real-time messaging

Key Events:
  ├── NEW_JOB_ALERT           → Emitted to eligible workers when job created
  ├── NEW_QUOTE               → Emitted to customer when worker places quote
  ├── QUOTE_UPDATED           → Customer quotes list refresh
  ├── QUOTE_ACCEPTED          → Notify worker their quote was accepted
  ├── JOB_STARTED             → Customer notified when worker starts
  ├── JOB_COMPLETED           → Notify customer job is done
  ├── JOB_CANCELLED           → Both parties notified
  ├── DASHBOARD_UPDATE        → Admin panel live updates
  ├── OTP_SENT                → Admin monitoring (non-production)
  ├── ORDER_STATUS_UPDATED    → Shop order tracking updates
  └── Chat messages           → Direct messaging between parties
```

---

## 5. PAYMENT SYSTEM

### Payment Flows:

#### Job Payment:
1. Customer accepts quote → `payment.amount` = quote amount
2. Payment computed: `workerPayout = quote amount - platformFee - GST`
3. Customer pays via Razorpay (online) OR cash (upon completion)
4. On payment capture: `$inc: { 'wallet.balance': +workerPayout }` → Worker wallet
5. Commission: Platform fee (configurable %) + 18% GST on platform fee

#### Shop Order Payment:
1. Customer adds items to cart → Checkout
2. `POST /api/v1/payments/create-order` → Razorpay order created
3. `POST /api/v1/payments/verify` → Signature verified → Payment captured
4. Shop wallet credited with subtotal (delivery fee excluded from commission)
5. Platform takes commission only on subtotal, NOT delivery fee

#### Wallet System:
- **Workers**: Wallet balance from completed jobs. Minimum ₹100 to receive jobs.
- **Shops**: Wallet balance from completed orders. Payout method configured.
- **Customers**: Can top-up wallet for faster payments.
- **Admin Wallet**: Platform revenue from commissions.

#### Payouts:
- Workers request withdrawal → Admin approves/rejects
- Shops request settlement → Admin processes
- Payout methods: Bank transfer (account + IFSC) or UPI

---

## 6. PLATFORM LOOPHOLES & MITIGATIONS (From Architecture Doc)

| Loophole | Mitigation |
|----------|------------|
| Cash payment evasion | Minimum wallet balance, negative balance lock, debt tracking |
| Wallet double-spending | MongoDB atomic `$inc` operations |
| GPS spoofing | Geofence verification (≤200m), Arrival OTP |
| SMS cost exhaustion | Redis rate limiting (3/15min), CAPTCHA |
| Inventory race conditions | Atomic `$inc` stock check |
| Quote sniping | Sealed-bid system (workers can't see other bids) |
| Tax compliance | Explicit GST tracking in payment schema |
| Delivery fee commission unfairness | Commission on subtotal only, delivery fee 100% to shop |
| Partial cash payment | "Report Partial Payment" → DISPUTED status |

---

## 7. KEY DESIGN PATTERNS

### Caching Strategy:
- **Redis caches**: User sessions (24h), app settings (10min), OTPs (5min), token blacklist, eligible worker lists (30min), admin dashboard stats
- **Cache-aside pattern**: Read from cache → miss → read DB → populate cache

### Worker Eligibility (8 Criteria):
All 8 must be true for a worker to see/bid on a job:
1. Role = WORKER
2. isVerified = true
3. KYC status = APPROVED
4. isOnline = true
5. Subscription valid (trial OR paid OR 180-day fallback)
6. Wallet balance ≥ ₹100 (configurable)
7. Has matching category in active services
8. Within worker's own serviceRadius (not global)

### Broadcast Expansion:
- Jobs start broadcasting at initial radius (e.g., 15km)
- If no worker accepts, broadcast expands in configurable rounds
- Each round: larger radius, re-notifying eligible workers

### Security:
- Passwords hashed with bcrypt (12 rounds)
- JWT tokens with 30-day expiry
- Token blacklist on logout
- Rate limiting on auth routes (5 attempts per 15min for login, 3 per 15min for OTP)
- OTP max attempts: 5 per hour per phone number
- CORS whitelist
- MongoDB injection protection via Joi validation
- 10kb body size limit

---

## 8. PROJECT FILE STRUCTURE (High Level)

```
kwickly-app/
├── backend/
│   └── src/
│       ├── app.js, server.js
│       ├── config/        (DB connection)
│       ├── constants/     (Messages)
│       ├── helpers/       (Response, Redis, Razorpay, Socket, Logger)
│       ├── middleware/    (Auth, Role, RateLimit, Upload, Validate, Error)
│       ├── modules/       (18 modules: auth, admin, job, worker, shop, etc.)
│       ├── services/      (SMS service)
│       ├── sockets/       (Socket event handlers)
│       ├── validators/    (Joi schemas)
│       ├── workers/       (Cron jobs)
│       └── __tests__/     (22 test files)
│
├── mobile/
│   └── src/
│       ├── app/           (Navigation: RootNavigator, AuthStack, CustomerTabs, WorkerTabs, ShopTabs)
│       ├── components/    (Reusable UI: AppBar, common components)
│       ├── config/        (App configs)
│       ├── constants/     (Theme, colors)
│       ├── context/       (Auth, Cart, Theme contexts)
│       ├── features/      (Screen by role: auth, customer, worker, shop, chat, shared)
│       ├── hooks/         (useSocket)
│       ├── services/      (API clients: api.js, auth, job, worker, shop, wallet, chat)
│       └── utils/         (Utilities)
│
└── admin/
    └── src/
        ├── App.jsx, main.jsx
        ├── components/    (Badge, Modal, Toast, Pagination, FormInput, etc.)
        ├── contexts/      (ThemeContext)
        ├── layouts/       (AppLayout with sidebar)
        ├── modules/       (21 modules matching admin routes)
        └── services/      (API client)
```

---

## 9. COMPLETE ROLE FLOW SUMMARY

### CUSTOMER → Service Request Flow
```
Splash → Role Selection → Login (OTP) → 
HomeScreen [Browse categories] →
BookService [Select category → Subcategory → Describe job → Set location → Set time] →
Job Created (BROADCASTING) →
LiveBidsScreen [View worker quotes in real-time] →
Accept Quote (ALLOCATED) →
LiveTrackingScreen [Track worker arrival] →
Worker Arrives → Verify OTP →
In-Progress → Worker completes →
RateExperienceScreen →
Payment → Transaction done
```

### WORKER → Job Execution Flow
```
Register → Complete Profile → Select Services →
Upload KYC → Wait for Admin Approval →
Go Online →
WorkerDashboard [See available jobs matching categories] →
WorkerJobDetails [View job details, distance, ETA] →
Place Quote (sealed bid) →
Wait for Customer to Accept →
Job Allocated → Navigate to Customer →
Enter Arrival OTP →
Start Job (IN_PROGRESS) →
Complete Job → Upload Photos →
Rate Customer →
Payment to Wallet
```

### SHOP → Product Selling Flow
```
Register → Create Shop (name, logo, address, hours, delivery config) →
Upload KYC → Wait for Admin Approval →
ShopProductsScreen [Add products with stock] →
Receive Orders →
ShopOrdersScreen [View orders] →
Update Order Status (CONFIRMED → PACKING → OUT_FOR_DELIVERY → DELIVERED) →
ShopWalletScreen [View earnings] →
Request Settlement
```

### ADMIN → Platform Management Flow
```
Login to Admin Panel →
Dashboard [View platform stats, charts, health] →
Manage Users [CRUD, impersonate, export] →
Manage Workers [KYC approval, details] →
Manage Shops [Full control, wallet operations] →
Manage Jobs [View all, create/admin jobs] →
Categories [Maintain service categories] →
Payouts [Approve/reject withdrawals] →
Disputes [Handle complaints] →
Settings [Configure platform] →
Reports [Analytics]