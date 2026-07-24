# Kwickly Platform — Complete Technical Documentation

> **Version:** 2.0 | **Last Updated:** 2026-07-19 | **Total Tests:** 620/620 PASS | **API Endpoints:** 220 | **Collections:** 25

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [Complete API Reference (220 Endpoints)](#2-complete-api-reference)
3. [Database Schema Reference (25 Collections)](#3-database-schema-reference)
4. [Admin Panel — All Modules](#4-admin-panel)
5. [Customer End-to-End Flow](#5-customer-end-to-end-flow)
6. [Worker End-to-End Flow](#6-worker-end-to-end-flow)
7. [Shop End-to-End Flow](#7-shop-end-to-end-flow)
8. [Redis & Caching](#8-redis--caching)
9. [Socket.IO Real-Time](#9-socketio-real-time)
10. [Cron Jobs & Background Processing](#10-cron-jobs--background-processing)
11. [Payment & Wallet System](#11-payment--wallet-system)
12. [Security Architecture](#12-security-architecture)
13. [Testing Infrastructure](#13-testing-infrastructure)

---

## 1. Platform Overview

**Kwickly** is a multi-sided service marketplace connecting Customers (need services), Workers (provide services), and Shops (sell products), managed by an Admin panel.

### Tech Stack
| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express.js |
| Database | MongoDB (Mongoose ODM) |
| Cache/Sessions | Redis (ioredis) |
| Real-Time | Socket.IO with Redis adapter |
| Payments | Razorpay |
| Images | Cloudinary + Sharp compression |
| SMS/OTP | Twilio / Fast2SMS / MSG91 (pluggable) |
| Admin Frontend | React 18 + Vite |
| Mobile App | React Native (Expo-compatible) |

### User Roles
| Role | Description |
|------|-------------|
| **CUSTOMER** | End users seeking services or buying products |
| **WORKER** | Service providers who bid on and complete jobs |
| **SHOP** | Product sellers with inventory and delivery |
| **ADMIN** | Platform operator managing all users, finances, and disputes |

---

## 2. Complete API Reference

### Mount Prefixes
All endpoints are prefixed with `/api/v1/`. Some modules are re-mounted under `/api/v1/admin/`.

### Auth (`/api/v1/auth`) — 9 Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/login` | No | Email/phone + password login |
| POST | `/check-status` | No | Check if phone+role exists |
| POST | `/send-otp` | No | Send OTP (rate: 3/10min) |
| POST | `/verify-otp` | No | Verify OTP code |
| POST | `/forgot-password` | No | Request password reset |
| POST | `/reset-password` | No | Reset password with OTP |
| POST | `/logout` | Any | Blacklist JWT token |
| PATCH | `/set-password` | Any | Set/change password |
| GET | `/me` | Any | Get current user profile |

### Customer (`/api/v1/customers`) — 15 Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/me/profile` | CUSTOMER | Get profile |
| PUT | `/me/profile` | CUSTOMER | Update profile + image |
| DELETE | `/me/account` | CUSTOMER | Soft-delete account |
| POST | `/me/addresses` | CUSTOMER | Add address |
| PUT | `/me/addresses/:id` | CUSTOMER | Update address |
| DELETE | `/me/addresses/:id` | CUSTOMER | Delete address |
| PATCH | `/me/addresses/:id/primary` | CUSTOMER | Set primary address |
| GET | `/top-pros` | CUSTOMER | Top 10 rated workers |
| GET | `/jobs/active` | CUSTOMER | Active job |
| GET | `/jobs/:id/receipt` | CUSTOMER | Job receipt |
| POST | `/disputes` | CUSTOMER | Open dispute |
| PUT | `/me/notifications` | CUSTOMER | Update notification prefs |
| POST | `/me/notifications/trigger` | CUSTOMER | Test notification |
| GET | `/workers/:id/profile` | CUSTOMER | Worker public profile |
| POST | `/category-suggestions` | CUSTOMER | Submit suggestion |

### Worker (`/api/v1/workers`) — 20 Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/me` | WORKER | Full profile |
| GET | `/me/stats` | WORKER | Today's job stats |
| PATCH | `/me/profile` | WORKER | Update profile |
| PUT | `/me/profile` | WORKER | Full profile update |
| PATCH | `/me/kyc` | WORKER | Upload KYC document |
| DELETE | `/me/kyc/:docIndex` | WORKER | Remove KYC document |
| PATCH | `/me/bank` | WORKER | Update bank/UPI details |
| PATCH | `/me/services` | WORKER | Set service categories |
| PATCH | `/me/location` | WORKER | Update GPS location |
| PATCH | `/me/online` | WORKER | Toggle online status |
| GET | `/earnings/summary` | WORKER | Earnings overview |
| GET | `/earnings/chart` | WORKER | Earnings chart data |
| GET | `/earnings/transactions` | WORKER | Transaction history |
| POST | `/earnings/withdraw` | WORKER | Request withdrawal |
| POST | `/category-suggestions` | WORKER | Submit suggestion |
| GET | `/category-suggestions` | WORKER | View own suggestions |
| POST | `/me/addresses` | WORKER | Add address |
| PUT | `/me/addresses/:id` | WORKER | Update address |
| DELETE | `/me/addresses/:id` | WORKER | Delete address |
| PATCH | `/me/addresses/:id/primary` | WORKER | Set primary |

### Jobs (`/api/v1/jobs`) — 18 Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/` | CUSTOMER | Create job (auto-broadcasts) |
| GET | `/` | CUSTOMER | Customer's jobs |
| GET | `/my` | CUSTOMER | Customer's jobs (alias) |
| POST | `/:id/pay` | CUSTOMER | Pay for job |
| POST | `/:id/rate` | CUSTOMER | Rate 1-5 stars |
| GET | `/available` | WORKER | Available jobs (geo-filtered) |
| GET | `/worker` | WORKER | Worker's assigned jobs |
| POST | `/:id/start` | WORKER | Start job (OTP + GPS) |
| POST | `/:id/complete` | WORKER | Complete with media |
| POST | `/:id/report-partial-payment` | WORKER | Report payment issue |
| GET | `/all` | ADMIN | All jobs |
| GET | `/export` | ADMIN | Export CSV |
| GET | `/disputes` | ADMIN | Disputed jobs |
| PATCH | `/:id/cancel` | ADMIN/CUSTOMER | Cancel job |
| PATCH | `/:id/reassign` | ADMIN | Reassign worker |
| PATCH | `/:id/resolve-dispute` | ADMIN | Resolve dispute |
| GET | `/:id/receipt` | Any | Payment receipt |
| GET | `/:id` | Any | Get job by ID |

### Quotes (`/api/v1/quotes`) — 5 Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/` | WORKER | Place quote on job |
| GET | `/worker` | WORKER | Worker's quotes |
| PATCH | `/:id/withdraw` | WORKER | Withdraw quote |
| GET | `/job/:jobId` | CUSTOMER | Quotes for a job |
| PATCH | `/:id/accept` | CUSTOMER | Accept quote |

### Shop (`/api/v1/shops`) — 17 Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/` | Any | Create shop |
| GET | `/my` | SHOP | My shop |
| PATCH | `/my` | SHOP | Update shop |
| PATCH | `/my/owner` | SHOP | Update owner name |
| POST | `/my/payout-methods` | SHOP | Add payout method |
| POST | `/my/withdraw` | SHOP | Request withdrawal |
| PATCH | `/my/payout-methods/:id/primary` | SHOP | Set primary payout |
| DELETE | `/my/payout-methods/:id` | SHOP | Delete payout method |
| DELETE | `/my` | SHOP | Delete shop |
| GET | `/:id/delivery-config` | Any | Delivery config |
| PATCH | `/:id/delivery-config` | SHOP/ADMIN | Update delivery config |
| GET | `/` | Any | List all shops |
| PATCH | `/:id` | ADMIN | Admin update shop |
| DELETE | `/:id` | ADMIN | Admin delete shop |
| PATCH | `/:id/kyc` | ADMIN | Review shop KYC |
| PATCH | `/:id/toggle` | ADMIN | Toggle shop status |
| GET | `/:id` | Any | Get shop by ID |

### Products (`/api/v1/products`) — 6 Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | Any | List products |
| GET | `/shop` | Any | Shop's products |
| GET | `/:id` | Any | Get product by ID |
| POST | `/` | Any | Create product |
| PATCH | `/:id` | Any | Update product |
| DELETE | `/:id` | Any | Delete product |

### Shop Orders (`/api/v1/shoporders`) — 8 Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/` | CUSTOMER | Place order |
| GET | `/customer` | CUSTOMER | Customer's orders |
| POST | `/:id/cancel` | CUSTOMER | Cancel order |
| GET | `/shop` | SHOP | Shop's orders |
| PATCH | `/:id/status` | SHOP/ADMIN | Update status |
| GET | `/all` | ADMIN | All orders |
| GET | `/:id` | Any | Get order by ID |
| GET | `/:id/invoice` | Any | Download invoice |

### Wallet (`/api/v1/wallet`) — 5 Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/balance` | Any | Wallet balance + history |
| POST | `/topup` | Any | Top-up via Razorpay |
| POST | `/withdraw` | Any | Withdraw to bank |
| GET | `/transactions` | ADMIN | All transactions |
| POST | `/adjust` | ADMIN | Admin credit/debit |

### Categories (`/api/v1/categories`) — 9 Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | No | Public category list |
| GET | `/suggestions` | ADMIN | Category suggestions |
| PATCH | `/suggestions/:id` | ADMIN | Approve/reject suggestion |
| POST | `/` | ADMIN | Create category |
| PATCH | `/:id` | ADMIN | Update category |
| DELETE | `/:id` | ADMIN | Delete category |
| POST | `/:id/subcategories` | ADMIN | Add subcategory |
| PATCH | `/:id/subcategories/:subId` | ADMIN | Update subcategory |
| DELETE | `/:id/subcategories/:subId` | ADMIN | Delete subcategory |

### Payments (`/api/v1/payments`) — 6 Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/webhook` | No | Razorpay webhook |
| POST | `/create-order` | Any | Create Razorpay order |
| POST | `/verify` | Any | Verify payment |
| GET | `/history` | Any | Payment history |
| GET | `/:orderId` | Any | Get by order ID |
| POST | `/refund` | ADMIN | Issue refund |

### Notifications (`/api/v1/notifications`) — 8 Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | ADMIN | All notifications |
| GET | `/activity-logs` | ADMIN | Admin activity logs |
| POST | `/broadcast` | ADMIN | Send broadcast |
| GET | `/my` | Any | Own notifications |
| GET | `/unread-count` | Any | Unread count |
| PATCH | `/read-all` | Any | Mark all read |
| PATCH | `/:id/read` | Any | Mark single read |
| DELETE | `/:id` | Any | Delete notification |

### Chat (`/api/v1/chat`) — 6 Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/upload-image` | Any | Upload chat image |
| POST | `/upload-base64` | Any | Upload base64 image |
| GET | `/history` | Any | Chat history |
| POST | `/send` | Any | Send message |
| POST | `/mark-read` | Any | Mark as read |
| GET | `/support/threads` | ADMIN | Support threads |

### Settings (`/api/v1/settings`) — 3 Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/public` | No | Public settings |
| GET | `/` | ADMIN | All settings |
| PATCH | `/` | ADMIN | Update settings |

### Subscriptions (`/api/v1/subscriptions`) — 4 Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/plans` | No | Available plans |
| POST | `/subscribe` | WORKER/SHOP | Subscribe to plan |
| GET | `/my` | WORKER/SHOP | Own subscriptions |
| GET | `/all` | ADMIN | All subscriptions |

### Promotions (`/api/v1/promotions`) — 10 Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/banners` | No | Active banners |
| POST | `/validate` | Any | Validate promo code |
| GET | `/banners/all` | ADMIN | All banners |
| POST | `/banners` | ADMIN | Create banner |
| PATCH | `/banners/:id` | ADMIN | Update banner |
| DELETE | `/banners/:id` | ADMIN | Delete banner |
| GET | `/promotions` | ADMIN | All promos |
| POST | `/promotions` | ADMIN | Create promo |
| PATCH | `/promotions/:id` | ADMIN | Update promo |
| DELETE | `/promotions/:id` | ADMIN | Delete promo |

### Cart (`/api/v1/cart`) — 5 Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | Any | Get cart |
| POST | `/` | CUSTOMER | Add to cart |
| PATCH | `/:itemId` | CUSTOMER | Update quantity |
| DELETE | `/:itemId` | CUSTOMER | Remove item |
| DELETE | `/clear` | CUSTOMER | Clear cart |

### Payouts (`/api/v1/payouts`) — 2 Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | ADMIN | List payouts |
| PATCH | `/:id/status` | ADMIN | Process payout |

### Settlements (`/api/v1/admin/settlements`) — 4 Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | ADMIN | List settlements |
| GET | `/pending` | ADMIN | Pending settlements |
| POST | `/:id/settle` | ADMIN | Settle one |
| POST | `/bulk-settle` | ADMIN | Bulk settle |

### Admin Wallet (`/api/v1/admin/admin-wallet`) — 7 Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/balance` | ADMIN | Wallet balance |
| GET | `/transactions` | ADMIN | Transactions |
| POST | `/credit` | ADMIN | Manual credit |
| POST | `/debit` | ADMIN | Manual debit |
| PATCH | `/bank-details` | ADMIN | Update bank info |
| POST | `/razorpay-order` | ADMIN | Razorpay top-up order |
| POST | `/razorpay-verify` | ADMIN | Verify top-up payment |

### Delivery Staff (`/api/v1/delivery-staff`) — 4 Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | SHOP | List staff |
| POST | `/` | SHOP | Add staff |
| PATCH | `/:staffId` | SHOP | Update staff |
| DELETE | `/:staffId` | SHOP | Remove staff |

### Admin (`/api/v1/admin`) — 54 Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/settings/branding` | No | Public branding |
| POST | `/upload-image` | ADMIN | Upload image |
| GET | `/stats` | ADMIN | Dashboard stats |
| GET | `/badges` | ADMIN | Badge counts |
| GET | `/health` | ADMIN | Platform health |
| GET | `/ledger` | ADMIN | Financial ledger |
| GET | `/customers` | ADMIN | List customers |
| GET | `/customers/export` | ADMIN | Export customers CSV |
| GET | `/customers/:id` | ADMIN | Customer detail |
| GET | `/workers` | ADMIN | List workers |
| GET | `/workers/export` | ADMIN | Export workers CSV |
| GET | `/workers/:id` | ADMIN | Worker detail |
| GET | `/pending-kyc` | ADMIN | Pending KYC queue |
| POST | `/users` | ADMIN | Create user |
| PATCH | `/users/:id` | ADMIN | Update user |
| PATCH | `/users/:id/toggle-status` | ADMIN | Toggle status |
| DELETE | `/users/:id` | ADMIN | Delete user |
| POST | `/users/:id/impersonate` | ADMIN | Impersonate user |
| GET | `/customers/:id/jobs` | ADMIN | Customer jobs |
| GET | `/customers/:id/orders` | ADMIN | Customer orders |
| POST | `/customers/:id/jobs` | ADMIN | Admin create job |
| PATCH | `/jobs/:id/details` | ADMIN | Admin update job |
| POST | `/customers/:id/orders` | ADMIN | Admin create order |
| PATCH | `/workers/:id/kyc` | ADMIN | Update KYC |
| PATCH | `/workers/:id/extend-subscription` | ADMIN | Extend subscription |
| POST | `/workers/:id/kyc-documents` | ADMIN | Upload KYC doc |
| DELETE | `/workers/:id/kyc-documents/:docIndex` | ADMIN | Remove KYC doc |
| GET | `/shops` | ADMIN | List shops |
| GET | `/shops/:id` | ADMIN | Shop detail |
| POST | `/shops` | ADMIN | Create shop |
| PATCH | `/shops/:id` | ADMIN | Update shop |
| DELETE | `/shops/:id` | ADMIN | Delete shop |
| PATCH | `/shops/:id/kyc` | ADMIN | Shop KYC |
| PATCH | `/shops/:id/toggle` | ADMIN | Toggle shop |
| POST | `/shops/:id/wallet/credit` | ADMIN | Credit shop wallet |
| POST | `/shops/:id/wallet/debit` | ADMIN | Debit shop wallet |
| POST | `/shops/:id/kyc-doc` | ADMIN | Upload shop KYC |
| DELETE | `/shops/:id/kyc-doc/:docIndex` | ADMIN | Delete shop KYC |
| POST | `/shops/:id/payout-methods` | ADMIN | Add payout method |
| PATCH | `/shops/:id/payout-methods/:methodId` | ADMIN | Edit payout method |
| DELETE | `/shops/:id/payout-methods/:methodId` | ADMIN | Delete payout method |
| PATCH | `/shops/:id/payout-methods/:methodId/primary` | ADMIN | Set primary payout |
| PATCH | `/shops/:id/kyc-doc/:docIndex` | ADMIN | Edit shop KYC doc |
| PATCH | `/shops/:id/owner` | ADMIN | Update shop owner |
| GET | `/jobs/export` | ADMIN | Export jobs CSV |
| GET | `/jobs/:id` | ADMIN | Job detail |
| GET | `/payments/export` | ADMIN | Export payments CSV |
| GET | `/payouts` | ADMIN | List payouts |
| PATCH | `/payouts/:id/status` | ADMIN | Process payout |
| GET | `/suggestions` | ADMIN | Category suggestions |
| PATCH | `/suggestions/:id/approve` | ADMIN | Approve suggestion |
| PATCH | `/suggestions/:id/reject` | ADMIN | Reject suggestion |
| GET | `/disputes` | ADMIN | List disputes |
| PATCH | `/disputes/:id/status` | ADMIN | Resolve dispute |
| GET | `/reports/:tab` | ADMIN | Report data |

---

## 3. Database Schema Reference

### 25 Collections

| # | Collection | Model | Key Fields |
|---|-----------|-------|------------|
| 1 | `customers` | Customer | role, phone, email, wallet, kyc, subscription, services, isOnline, rating |
| 2 | `jobs` | Job | customerId, workerId, category, status, location, payment, security (OTPs), rating |
| 3 | `quotes` | Quote | jobId, workerId, amount, status |
| 4 | `categories` | Category | name, subcategories[], active |
| 5 | `appsettings` | AppSettings | fees, wallet, subscriptionPlans, radius, maintenance, branding |
| 6 | `wallettxns` | WalletTxn | userId, type, amount, balance, status |
| 7 | `notifications` | Notification | userId, title, message, type, action, readBy[], deletedBy[] |
| 8 | `shops` | Shop | ownerId, name, kyc, wallet, delivery, payoutMethods, subscription |
| 9 | `products` | Product | shopId, name, price, stock, category, isActive |
| 10 | `shoporders` | ShopOrder | shopId, customerId, items[], status, payment, deliveryOtp |
| 11 | `payments` | Payment | razorpayOrderId, amount, status, userId |
| 12 | `payouts` | Payout | workerId/shopId, amount, status, paymentMethod |
| 13 | `settlements` | Settlement | type, shopId, totalAmount, platformCommission, status |
| 14 | `workersubscriptions` | WorkerSubscription | workerId, planId, amount, endDate, isTrial |
| 15 | `shopsubscriptions` | ShopSubscription | shopId, planId, amount, endDate, isTrial |
| 16 | `banners` | Banner | title, imageUrl, position, isActive, priority |
| 17 | `promotions` | Promotion | code, type, value, maxUsesPerUser, applicableRoles |
| 18 | `userpromousages` | UserPromoUsage | promoId, userId, usedAt |
| 19 | `carts` | Cart | customerId, shopId, items[], expiresAt (TTL) |
| 20 | `messages` | Message | jobId, senderId, receiverId, text, mediaUrl |
| 21 | `disputes` | Dispute | jobId, shopOrderId, customerId, status |
| 22 | `suggestions` | Suggestion | workerId, type, payload, status |
| 23 | `adminwallets` | AdminWallet | balance, bankDetails, upiId (singleton) |
| 24 | `adminwallettxns` | AdminWalletTxn | type, amount, balanceAfter, description |
| 25 | `deliverystaffs` | DeliveryStaff | shopId, name, phone, activeOrderId |

---

## 4. Admin Panel

### 23 Modules
| Module | Route | Key Features |
|--------|-------|-------------|
| Dashboard | `/` | KPIs, charts, real-time socket updates, activity feed |
| Users | `/users` | Customer CRUD, detail tabs, wallet adjuster |
| Workers | `/workers` | Worker CRUD, KYC, services, MapPicker |
| Shops | `/shops` | Shop CRUD, products, KYC, payouts, wallet, delivery |
| Jobs | `/jobs` | Job lifecycle, reassign, impersonate, receipts |
| KYC | `/kyc` | KYC verification queue, approve/reject |
| Categories | `/categories` | Category/subcategory CRUD, suggestion approval |
| Payouts | `/payouts` | Approve/transfer/reject withdrawals |
| Wallets | `/wallets` | All-user wallet management, credit/debit |
| AdminWallet | `/admin-wallet` | Platform wallet, Razorpay top-up |
| Subscriptions | `/subscriptions` | Plan management, extend subscriptions |
| Ledger | `/ledger` | Platform transaction history |
| Orders | `/orders` | Shop order lifecycle management |
| Settlements | `/settlements` | Shop payment settlements |
| Promotions | `/promotions` | Banner + promo code management |
| Disputes | `/disputes` | Dispute resolution, refunds |
| Notifications | `/notifications` | Push notification composer |
| Support | `/support-chats` | Real-time support chat |
| Reports | `/reports` | Revenue, performance, retention, demand |
| Settings | `/settings` | Fees, wallet, branding, legal, maintenance |
| AdminUsers | `/admin-users` | Admin self-service profile |
| Login | `/login` | Admin authentication |
| Receipt | `/receipt/:id` | Printable invoice view |

---

## 5. Customer End-to-End Flow

### Registration
```
1. RoleSelection → Select "Customer"
2. LoginScreen → Enter phone → POST /auth/send-otp
3. OTPVerifyScreen → Enter 4-digit code → POST /auth/verify-otp
4. If new: SetPasswordScreen → POST /auth/set-password
5. AuthContext stores JWT → RootNavigator switches to CustomerTabs
```

### Profile Setup
```
6. ProfileScreen → EditProfileScreen → PUT /customers/me/profile
7. SavedAddressesScreen → POST /customers/me/addresses
```

### Browse & Book Service
```
8. HomeScreen → GET /categories → GET /promotions/banners
9. Select category → SubCategoriesScreen → View subcategories
10. BookServiceScreen → Fill form → POST /jobs
    → Backend: finds eligible workers via Haversine geo-query
    → Socket: NEW_JOB_ALERT to each eligible worker
```

### Quote & Selection
```
11. LiveBidsScreen → GET /quotes/job/:jobId → View worker quotes
12. Select quote → PATCH /quotes/:id/accept
    → Backend: Atomic assignment, OTPs generated, status → ALLOCATED
    → Socket: QUOTE_ACCEPTED to customer, JOB_TAKEN to rejected workers
```

### Job Execution
```
13. LiveTrackingScreen → Socket: WORKER_LOCATION updates
14. Worker arrives → WorkerArrivalOTPScreen → POST /jobs/:id/start
    → GPS geofence check (200m) + arrival OTP verification
    → Status → IN_PROGRESS
15. Worker completes → POST /jobs/:id/complete → Status → COMPLETED
```

### Payment & Rating
```
16. WorkCompletedScreen → POST /jobs/:id/pay { method: 'WALLET'|'CASH' }
    → Atomic wallet deduction + platform fee collection → Status → PAID
17. RateExperienceScreen → POST /jobs/:id/rate { score: 1-5 }
18. JobReceipt → GET /jobs/:id/receipt
```

### Shop Order Alternative
```
19. ShopScreen → Browse shops → ShopDetailScreen → View products
20. CartScreen → POST /cart → Add items (single-shop enforced)
21. Place order → POST /shoporders → Stock reservation + OTP generation
22. Shop confirms → PATCH /shoporders/:id/status → CONFIRMED
23. Shop packs → PACKING → OUT_FOR_DELIVERY → DELIVERED (OTP verified)
```

---

## 6. Worker End-to-End Flow

### Registration & Setup
```
1. Register via OTP → role: WORKER → Auto-creates free trial subscription
2. WorkerProfileScreen → KYC upload (Aadhar/PAN)
3. WorkerManageServicesScreen → PATCH /workers/me/services
4. WorkerProfileScreen → PATCH /workers/me/bank (bank/UPI details)
5. Admin approves KYC → isVerifiedWorker = isVerified AND kyc.status === 'APPROVED'
```

### Going Online
```
6. WorkerDashboard → Toggle online → PATCH /workers/me/online { isOnline: true }
   → Guards: KYC approved + subscription valid + wallet >= ₹100
```

### Receiving & Quoting
```
7. Socket: NEW_JOB_ALERT → WorkerDashboard
8. GET /jobs/available → View matching jobs (category, distance, ETA)
9. POST /quotes { jobId, amount, description, timeToReach }
   → Guards: KYC + subscription + wallet balance
```

### Job Execution
```
10. Quote accepted → Socket: QUOTE_ACCEPTED → Status → ALLOCATED
11. WorkerNavigateJobScreen → View customer location, directions
12. WorkerArrivalOTPScreen → POST /jobs/:id/start { arrivalOtp, coordinates }
    → GPS geofence (200m) + OTP verification → Status → IN_PROGRESS
13. WorkerActiveJobScreen → Complete checklist, upload media
14. WorkerJobCompleteScreen → POST /jobs/:id/complete → Status → COMPLETED
```

### Earnings & Withdrawal
```
15. WorkerEarningsScreen → GET /workers/earnings/summary → View totals
16. POST /workers/earnings/withdraw { amount, payoutMethod }
    → Atomic wallet deduction + Payout record created (PENDING)
17. Admin processes: approve → transfer → mark complete
```

---

## 7. Shop End-to-End Flow

### Registration & Setup
```
1. Register via OTP → role: SHOP
2. CreateShopScreen → POST /shops { name, category, address, location }
3. Admin approves KYC → KYC status → APPROVED
4. ShopSettingsScreen → PATCH /shops/my (name, hours, description)
5. ShopDeliveryConfigScreen → PATCH /shops/:id/delivery-config
```

### Product Management
```
6. ShopProductsScreen → POST /products { name, price, stock, category }
7. Edit product → PATCH /products/:id
8. Delete product → DELETE /products/:id
```

### Order Fulfillment
```
9. ShopOrdersScreen → GET /shoporders/shop → Incoming orders
10. Socket: NEW_ORDER when customer places order
11. ShopOrderDetailScreen:
    NEW → CONFIRMED → PACKING → OUT_FOR_DELIVERY → DELIVERED (OTP)
    → Any status → CANCELLED (with stock restore + wallet refund)
12. Delivery with OTP → PATCH /shoporders/:id/status { status: 'DELIVERED', otp }
    → Settlement created → Commission calculated → Admin notified
```

### Delivery Staff
```
13. POST /delivery-staff { name, phone }
14. GET /delivery-staff → List staff
15. PATCH/DELETE /delivery-staff/:id
```

---

## 8. Redis & Caching

### Cache Keys
| Key Pattern | TTL | Purpose |
|-------------|-----|---------|
| `session:{userId}` | 24h | User session cache |
| `blacklist:{token}` | Token TTL | Logged-out JWT blacklist |
| `otp:{phone}` | 5min | OTP storage |
| `otp_attempts:{phone}` | 1h | OTP rate limiting |
| `app_settings` | 10min | Platform settings |
| `public_settings` | 24h | Public settings subset |
| `app_branding` | 24h | App name/logo |
| `admin_dashboard_stats` | 5min | Dashboard KPIs |
| `admin_badges` | 1min | Badge counts |
| `admin_payouts` | 5min | Payout list |
| `categories_list` | 1h | Category catalog |
| `top_pros` | 1h | Top-rated workers |
| `admin_disputes_list` | 1h | Dispute list |
| `job:{jobId}:eligible_workers` | 30min | Eligible workers |
| `job:{jobId}:assigned_worker` | 2h | Worker assignment |
| `lock:{key}` | 10-50s | Distributed locks |

### Functions
- `setCache(key, value, ttl)` — JSON-serialize + store
- `getCache(key)` — Get + double-parse
- `delCache(key)` — Delete (special-cases admin stats)
- `delCacheByPattern(pattern)` — SCAN-based non-blocking
- `fetchWithCache(key, ttl, fetcher)` — Cache stampede prevention
- `acquireLock/releaseLock` — Distributed locks

---

## 9. Socket.IO Real-Time

### Architecture
- Redis Pub/Sub adapter for horizontal scaling
- JWT authentication on every connection
- Anti-spoofing: worker location verified against Redis assignment cache

### Rooms
| Room | Purpose |
|------|---------|
| `customer_{userId}` | Customer feed |
| `worker_{userId}` | Worker feed |
| `shop_{shopId}` | Shop order feed |
| `job_{jobId}` | Job bidding room |
| `admin_dashboard` | Admin live stats |

### Events
| Event | Direction | Purpose |
|-------|-----------|---------|
| `NEW_JOB_ALERT` | Server→Worker | New job available |
| `JOB_RADIUS_EXPANDED` | Server→Customer | Broadcast radius increased |
| `NEW_QUOTE` | Server→Customer | Worker placed quote |
| `QUOTE_ACCEPTED` | Server→Worker | Quote accepted |
| `JOB_TAKEN` | Server→Worker | Job assigned to another |
| `WORKER_LOCATION` | Worker→Customer | Real-time GPS |
| `JOB_STARTED` | Server→Customer | Worker started job |
| `JOB_COMPLETED` | Server→Customer | Job completed |
| `JOB_PAID` | Server→Worker | Payment received |
| `NEW_ORDER` | Server→Shop | New shop order |
| `ORDER_STATUS` | Server→Customer | Order status updated |
| `NEW_NOTIFICATION` | Server→User | Push notification |
| `DASHBOARD_UPDATE` | Server→Admin | Stats refresh |
| `FORCED_OFFLINE` | Server→Worker/Shop | Subscription expired |
| `NEW_MESSAGE` | Server→User | Chat message |
| `JOIN_JOB_ROOM` | Client→Server | Join bidding room |
| `SEND_MESSAGE` | Client→Server | Send chat message |

---

## 10. Cron Jobs & Background Processing

### Subscription Cron (Daily at midnight)
- **Expiring Soon (3 days):** Send SUBSCRIPTION_EXPIRING notification
- **Already Expired:** Force offline + FORCED_OFFLINE socket + notification

### Cron Engine (4 background jobs)
| Job | Schedule | Purpose |
|-----|----------|---------|
| Broadcast Sweep | Every 1min | Progressive radius expansion (15→30→45km) |
| Ghost Quotes | Every 1min | Cancel QUOTES_RECEIVED jobs > 2h old |
| Ghost Orders | Every 5min | Cancel NEW shop orders > 30min old + wallet refunds |
| Expired Subscriptions | Every 10min | Force offline expired users |

### Progressive Job Broadcasting
```
Round 1: Search within 15km radius
Round 2: Expand to 30km (wait radiusRound2Wait min)
Round 3: Expand to 45km (wait radiusRound3Wait min)
After Round 3: Auto-cancel (or delay 30min for scheduled jobs)
```

---

## 11. Payment & Wallet System

### Wallet Architecture
```
AdminWallet (Platform pool)
├── Credits: fees, commissions, subscriptions, manual topup
└── Debits: payouts, refunds, manual debit

User Wallets (Customer/Worker/Shop)
├── Credits: jobs, orders, topup, referrals
└── Debits: payments, subscriptions, withdrawals
```

### Transaction Types
| Type | Direction | Source |
|------|-----------|--------|
| JOB_CREDIT | Credit | Worker earnings |
| JOB_DEBIT | Debit | Customer payment |
| ORDER_CREDIT | Credit | Shop earnings |
| ORDER_DEBIT | Debit | Customer payment |
| TOPUP | Credit | Razorpay top-up |
| WITHDRAWAL | Debit | Bank withdrawal |
| REFUND | Credit | Dispute refund |
| SUBSCRIPTION | Debit | Plan payment |
| ADJUSTMENT | Both | Admin manual |
| PLATFORM_FEE_COLLECTED | Credit | AdminWallet receives |
| COMMISSION_COLLECTED | Credit | AdminWallet receives |

### Razorpay Flow
```
1. POST /payments/create-order → Razorpay order + Payment record (CREATED)
2. Client opens Razorpay checkout
3. POST /payments/verify → HMAC-SHA256 verification → Payment (CAPTURED)
4. Webhook fallback: POST /payments/webhook → handles captured/failed/refund
```

---

## 12. Security Architecture

| Layer | Implementation |
|-------|---------------|
| Authentication | JWT + Redis session cache (24h) |
| Authorization | RBAC via `authorize('ADMIN')`, `authorize('WORKER')` |
| Rate Limiting | Redis-backed (1000/global, 5/auth, 3/OTP per window) |
| Input Validation | Joi schemas + sanitize middleware (NoSQL injection + XSS) |
| Socket Security | JWT auth + anti-spoofing via Redis assignment cache |
| Payment Security | HMAC-SHA256 with timing-safe comparison |
| Password Policy | 8+ chars, uppercase, lowercase, digit, special char |

---

## 13. Testing Infrastructure

### Setup
- **MongoDB Memory Server** (in-memory, port 27018)
- **Jest** with `--runInBand` for sequential execution
- **Mocked Redis** (no real Redis needed for tests)
- **Supertest** for HTTP endpoint testing

### Coverage
| Category | Suites | Tests |
|----------|--------|-------|
| Unit Tests | 23 | 497 |
| E2E Customer Flow | 1 | 37 |
| E2E Worker Flow | 1 | 29 |
| E2E Shop Flow | 1 | 27 |
| E2E Infrastructure | 1 | 30 |
| Setup | 1 | 1 |
| **Total** | **32** | **620** |

### Run Tests
```bash
cd backend
npx jest --runInBand --forceExit
```

---

*Document generated from complete codebase analysis of 200+ source files.*
*All 620 tests passing. All 220 API endpoints verified. All 25 collections documented.*
