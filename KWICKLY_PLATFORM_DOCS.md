# Kwickly Platform - Complete Documentation

> Multi-Sided On-Demand Service Marketplace

---

## TABLE OF CONTENTS
1. [System Architecture](#1-system-architecture)
2. [Tech Stack](#2-tech-stack)
3. [Backend Modules & APIs](#3-backend-modules--apis)
4. [Database Schema (MongoDB)](#4-database-schema-mongodb)
5. [Redis Implementation](#5-redis-implementation)
6. [Socket.IO Real-Time System](#6-socketio-real-time-system)
7. [Mobile App - Complete Screens](#7-mobile-app---complete-screens)
8. [Admin Panel - Complete Pages](#8-admin-panel---complete-pages)
9. [Complete Flow: Customer](#9-complete-flow-customer)
10. [Complete Flow: Worker](#10-complete-flow-worker)
11. [Complete Flow: Shop](#11-complete-flow-shop)
12. [Complete Flow: Admin](#12-complete-flow-admin)
13. [Environment Variables](#13-environment-variables)
14. [Infrastructure & Deployment](#14-infrastructure--deployment)

---

## 1. SYSTEM ARCHITECTURE

```
┌──────────────────────────────────────────────────────────────────────┐
│                          CLIENTS                                     │
│  ┌──────────────┐   ┌──────────────┐   ┌─────────────────────────┐  │
│  │ Mobile App    │   │ Mobile App   │   │ Admin Panel             │  │
│  │ (Customer)    │   │ (Worker)     │   │ (React + Vite)          │  │
│  │ React Native  │   │ React Native │   │ /workspace/admin/       │  │
│  │ /mobile/src/  │   │ /mobile/src/ │   │                         │  │
│  └──────┬───────┘   └──────┬───────┘   └────────────┬────────────┘  │
│         │                  │                          │               │
│  ┌──────┴──────────────────┴──────────────────────────┴──────┐       │
│  │              Mobile App (Shared Codebase)                   │       │
│  │  /workspace/mobile/src/  |  Role-based Navigation          │       │
│  └──────────────────────────┬─────────────────────────────────┘       │
└─────────────────────────────┼────────────────────────────────────────┘
                              │
                     HTTPS / WebSocket
                              │
┌─────────────────────────────┼────────────────────────────────────────┐
│                   BACKEND API (Node.js + Express)                     │
│  ┌──────────────────────────┴───────────────────────────────────┐   │
│  │                    /workspace/backend/                        │   │
│  │  ┌─────────┐ ┌───────────┐ ┌──────────┐ ┌────────────────┐  │   │
│  │  │ Auth    │ │ Jobs      │ │ Shops    │ │ Payments       │  │   │
│  │  │ Module  │ │ Module    │ │ Module   │ │ Module         │  │   │
│  │  ├─────────┤ ├───────────┤ ├──────────┤ ├────────────────┤  │   │
│  │  │ Wallet  │ │ Quotes    │ │ Products │ │ Subscriptions  │  │   │
│  │  │ Module  │ │ Module    │ │ Module   │ │ Module         │  │   │
│  │  ├─────────┤ ├───────────┤ ├──────────┤ ├────────────────┤  │   │
│  │  │ Chat    │ │ Disputes  │ │ Cart     │ │ Settlements    │  │   │
│  │  │ Module  │ │ Module    │ │ Module   │ │ Module         │  │   │
│  │  ├─────────┤ ├───────────┤ ├──────────┤ ├────────────────┤  │   │
│  │  │ Payouts │ │ Promotions│ │ Categories│ │ Notifications │  │   │
│  │  │ Module  │ │ Module    │ │ Module   │ │ Module         │  │   │
│  │  ├─────────┤ └───────────┘ └──────────┘ └────────────────┘  │   │
│  │  │ 7x Middleware  │ 12x Helpers  │ 2x Services │ Cron Jobs │   │
│  │  └────────────────┴──────────────┴─────────────┴───────────┘   │
│  └────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        v                     v                     v
┌──────────────┐    ┌──────────────┐    ┌──────────────────┐
│   MongoDB    │    │    Redis     │    │   Cloudinary     │
│  (Mongoose)  │    │  (ioredis)   │    │  (Image Hosting) │
│  Primary DB  │    │ Cache/Locks  │    │  + Sharp (WEBP)  │
└──────────────┘    └──────────────┘    └──────────────────┘
        │
        v
┌──────────────┐    ┌──────────────┐
│   Razorpay   │    │  SMS Gateway │
│  (Payments)  │    │  (OTP Auth)  │
└──────────────┘    └──────────────┘
```

**Server Stack:** Node.js 22 | Express 5 | MongoDB 7 (Mongoose 9) | Redis 7 (ioredis 5) | Socket.IO 4 | PM2 (cluster mode)

---

## 2. TECH STACK

### Backend (`/workspace/backend/`)
| Category | Technology | Purpose |
|----------|-----------|---------|
| Runtime | Node.js | JavaScript server |
| Framework | Express 5.x | HTTP framework |
| Database | MongoDB + Mongoose 9 | Primary data store |
| Cache | Redis + ioredis 5 | Session, cache, pub/sub, locks |
| Real-time | Socket.IO 4 + Redis adapter | Bidirectional events |
| Auth | JWT + bcrypt | Stateless authentication |
| Payments | Razorpay SDK | Payment gateway |
| Images | Cloudinary + Sharp | Upload, compress, serve |
| SMS | Twilio / Fast2SMS / MSG91 | OTP dispatch |
| Validation | Joi 18 | Request validation |
| Security | Helmet, CORS, hpp, xss | Security headers/sanitization |
| Rate Limit | express-rate-limit + rate-limit-redis | Rate limiting |
| Logging | Winston + Morgan | Structured logging |
| Testing | Jest + Supertest + MongoDB Memory Server | Unit/integration tests |
| Process | PM2 (cluster mode) | Process management |

### Mobile App (`/workspace/mobile/`)
| Category | Technology | Purpose |
|----------|-----------|---------|
| Framework | React Native 0.85 | Cross-platform mobile |
| Language | TypeScript | Type-safe development |
| Navigation | React Navigation 7 | Stack + Bottom Tabs |
| HTTP | Axios | API client |
| Real-time | socket.io-client 4 | WebSocket events |
| Payments | react-native-razorpay | Payment checkout |
| Maps | react-native-maps + Leaflet WebView | GPS/maps |
| Location | @react-native-community/geolocation | Device GPS |
| Images | react-native-image-picker | Camera/gallery |
| Storage | @react-native-async-storage | Token persistence |
| Icons | lucide-react-native | UI icons |
| UI | react-native-linear-gradient, react-native-svg | Visual effects |
| Network | @react-native-community/netinfo | Online/offline detection |

### Admin Panel (`/workspace/admin/`)
| Category | Technology | Purpose |
|----------|-----------|---------|
| Framework | React 18 | UI framework |
| Bundler | Vite 5 | Dev/build tool |
| Navigation | react-router-dom 6 | Client-side routing |
| HTTP | Axios | API client |
| Real-time | socket.io-client 4 | WebSocket events |
| Charts | Recharts 3 | Data visualization |
| Maps | Leaflet | Geolocation picker |
| Icons | Lucide React | UI icons |
| Theming | CSS custom properties + ThemeContext | Light/dark mode |
| Payments | Razorpay Checkout (CDN) | Payment gateway |

---

## 3. BACKEND MODULES & APIs

**Source:** `/workspace/backend/src/modules/`

### Module Structure Pattern
Each module follows this pattern:
```
modules/<name>/
  ├── <name>.model.js       # Mongoose schema + indexes
  ├── <name>.controller.js  # Request handlers (catchAsync wrapped)
  ├── <name>.routes.js      # Express router (auth + role middleware)
  └── <name>.validator.js   # Joi validation schemas (in /validators/)
```

### 3.1 Auth Module
**Model:** Customer (shared by all roles)
**Endpoints:**
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/v1/auth/check-status | No | Check if user exists by phone+role |
| POST | /api/v1/auth/send-otp | No | Send 4-digit OTP via SMS |
| POST | /api/v1/auth/verify-otp | No | Verify OTP, return JWT + user |
| POST | /api/v1/auth/login | No | Password-based login |
| POST | /api/v1/auth/logout | Yes | Invalidate JWT (blacklist) |
| PATCH | /api/v1/auth/set-password | Yes | Set password for new users |
| GET | /api/v1/auth/me | Yes | Get current user profile |
| POST | /api/v1/auth/forgot-password | No | Request password reset OTP |
| POST | /api/v1/auth/reset-password | No | Reset password with OTP |

### 3.2 Customer Module
**Endpoints:**
| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| GET | /customers/top-pros | No | - | Top-rated workers |
| GET | /customers/me/profile | Yes | CUSTOMER | Customer profile |
| PUT | /customers/me/profile | Yes | CUSTOMER | Update profile |
| DELETE | /customers/me/account | Yes | CUSTOMER | Soft delete account |
| GET | /customers/jobs/active | Yes | CUSTOMER | Active job |
| GET | /customers/workers/:id/profile | Yes | CUSTOMER | Worker public profile |
| PUT | /customers/me/notifications | Yes | CUSTOMER | Notification preferences |
| POST | /customers/disputes | Yes | CUSTOMER | Open dispute |
| POST | /customers/me/addresses | Yes | CUSTOMER | Add address |
| PUT | /customers/me/addresses/:id | Yes | CUSTOMER | Update address |
| DELETE | /customers/me/addresses/:id | Yes | CUSTOMER | Delete address |
| PATCH | /customers/me/addresses/:id/primary | Yes | CUSTOMER | Set primary address |

### 3.3 Worker Module
**Endpoints:**
| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| GET | /workers/me | Yes | WORKER | Worker profile |
| GET | /workers/me/stats | Yes | WORKER | Today's job stats |
| PATCH | /workers/me/profile | Yes | WORKER | Update profile |
| PUT | /workers/me/profile | Yes | WORKER | Full profile update |
| PATCH | /workers/me/online | Yes | WORKER | Toggle online status |
| PATCH | /workers/me/location | Yes | WORKER | Update GPS location |
| PATCH | /workers/me/services | Yes | WORKER | Update service categories |
| PATCH | /workers/me/kyc | Yes | WORKER | Upload KYC documents |
| DELETE | /workers/me/kyc/:index | Yes | WORKER | Remove KYC doc |
| PATCH | /workers/me/bank | Yes | WORKER | Update bank details |
| GET | /workers/earnings/summary | Yes | WORKER | Earnings summary |
| GET | /workers/earnings/chart | Yes | WORKER | Earnings chart data |
| GET | /workers/earnings/transactions | Yes | WORKER | Transaction history |
| POST | /workers/earnings/withdraw | Yes | WORKER | Request withdrawal |
| POST | /workers/category-suggestions | Yes | WORKER | Suggest category |
| GET | /workers/category-suggestions | Yes | WORKER | List my suggestions |
| POST | /workers/me/addresses | Yes | WORKER | Add address |
| PUT | /workers/me/addresses/:id | Yes | WORKER | Update address |
| DELETE | /workers/me/addresses/:id | Yes | WORKER | Delete address |
| PATCH | /workers/me/addresses/:id/primary | Yes | WORKER | Set primary address |

### 3.4 Job Module
**Endpoints:**
| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| POST | /jobs | Yes | CUSTOMER | Create new job |
| GET | /jobs | Yes | CUSTOMER | List jobs |
| GET | /jobs/my | Yes | CUSTOMER | My jobs |
| GET | /jobs/:id | Yes | CUST/WORKER | Job detail |
| GET | /jobs/available | Yes | WORKER | Available jobs nearby |
| GET | /jobs/worker | Yes | WORKER | Worker's assigned jobs |
| PATCH | /jobs/:id/cancel | Yes | CUST/ADMIN | Cancel job |
| POST | /jobs/:id/start | Yes | WORKER | Start job (verify arrival OTP) |
| POST | /jobs/:id/complete | Yes | WORKER | Complete job (verify completion OTP) |
| POST | /jobs/:id/pay | Yes | CUSTOMER | Pay for job |
| POST | /jobs/:id/rate | Yes | CUSTOMER | Rate worker |
| PATCH | /jobs/:id/reassign | Yes | ADMIN | Reassign job to new worker |
| POST | /jobs/:id/dispute | Yes | CUSTOMER | Report partial payment |
| PATCH | /jobs/:id/resolve-dispute | Yes | ADMIN | Resolve dispute |

### 3.5 Quote Module
**Endpoints:**
| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| POST | /quotes | Yes | WORKER | Place quote on job |
| GET | /quotes/job/:jobId | Yes | CUSTOMER | Get quotes for job |
| GET | /quotes/worker | Yes | WORKER | Get worker's quotes |
| PATCH | /quotes/:id/accept | Yes | CUSTOMER | Accept quote (atomic + Redis lock) |
| PATCH | /quotes/:id/withdraw | Yes | WORKER | Withdraw quote |

### 3.6 Shop Module
**Endpoints:**
| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| POST | /shops | Yes | SHOP | Create shop |
| GET | /shops | No | - | List public shops |
| GET | /shops/my | Yes | SHOP | Owner's shop |
| GET | /shops/:id | Yes | All | Shop detail |
| PATCH | /shops/my | Yes | SHOP | Update shop |
| DELETE | /shops/my | Yes | SHOP | Delete shop |
| PATCH | /shops/my/owner | Yes | SHOP | Update owner name |
| PATCH | /shops/:id/delivery-config | Yes | SHOP | Delivery settings |
| POST | /shops/my/payout-methods | Yes | SHOP | Add payout method |
| DELETE | /shops/my/payout-methods/:id | Yes | SHOP | Remove payout method |
| PATCH | /shops/my/payout-methods/:id/primary | Yes | SHOP | Set primary payout |

### 3.7 ShopOrder Module
**Endpoints:**
| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| POST | /shoporders | Yes | CUSTOMER | Place order (transactional) |
| GET | /shoporders/customer | Yes | CUSTOMER | Customer's orders |
| GET | /shoporders/shop | Yes | SHOP | Shop's orders |
| GET | /shoporders/:id | Yes | All | Order detail |
| PATCH | /shoporders/:id/status | Yes | SHOP | Update status (NEW->CONFIRMED->...->DELIVERED) |
| GET | /shoporders/:id/invoice | Yes | All | Download invoice |

### 3.8 Product Module
**Endpoints:**
| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| GET | /products | No | - | Public products list |
| GET | /products/shop | Yes | SHOP | Shop owner's products |
| GET | /products/:id | Yes | All | Product detail |
| POST | /products | Yes | SHOP | Create product |
| PATCH | /products/:id | Yes | SHOP | Update product |
| DELETE | /products/:id | Yes | SHOP | Delete product |

### 3.9 Cart Module
**Endpoints:**
| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| GET | /cart | Yes | CUSTOMER | Get cart (one per customer per shop) |
| POST | /cart | Yes | CUSTOMER | Add to cart |
| PATCH | /cart/:itemId | Yes | CUSTOMER | Update item qty |
| DELETE | /cart/:itemId | Yes | CUSTOMER | Remove item |
| DELETE | /cart/clear | Yes | CUSTOMER | Clear cart |

### 3.10 Category Module
**Endpoints:**
| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| GET | /categories | No | - | All categories + subcategories |
| GET | /categories/:id | No | - | Single category |
| POST | /categories | Yes | ADMIN | Create category |
| PATCH | /categories/:id | Yes | ADMIN | Update category |
| DELETE | /categories/:id | Yes | ADMIN | Delete category |
| POST | /categories/:id/subcategories | Yes | ADMIN | Add subcategory |
| PATCH | /categories/:id/subcategories/:subId | Yes | ADMIN | Update subcategory |
| DELETE | /categories/:id/subcategories/:subId | Yes | ADMIN | Delete subcategory |

### 3.11 Chat Module
**Endpoints:**
| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| POST | /chat/upload-image | Yes | All | Upload chat image (Multer+Cloudinary) |
| POST | /chat/upload-base64 | Yes | All | Upload base64 image |
| GET | /chat/history | Yes | All | Chat message history |
| POST | /chat/send | Yes | All | Send message |
| POST | /chat/mark-read | Yes | All | Mark messages read |
| GET | /chat/support/threads | Yes | ADMIN | Support chat threads |

### 3.12 Payment Module
**Endpoints:**
| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| POST | /payments/create-order | Yes | All | Create Razorpay order |
| POST | /payments/verify | Yes | All | Verify payment signature |
| POST | /payments/webhook | No (Razorpay) | - | Webhook handler |
| POST | /payments/refund | Yes | ADMIN | Process refund |
| GET | /payments/:orderId | Yes | All | Get payment by order |
| GET | /payments/history | Yes | All | Payment history |

### 3.13 Wallet Module
**Endpoints:**
| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| GET | /wallet/balance | Yes | All | Wallet balance + transactions |
| POST | /wallet/topup | Yes | All | Top up via Razorpay |
| POST | /wallet/withdraw | Yes | WORKER/SHOP | Request withdrawal |
| GET | /wallet/transactions | Yes | ADMIN | All transactions |
| POST | /wallet/adjust | Yes | ADMIN | Credit/debit user wallet |

### 3.14 Payout Module
**Endpoints:**
| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| GET | /payouts | Yes | ADMIN | All payouts |
| PATCH | /payouts/:id | Yes | ADMIN | Approve/reject/transfer payout |

### 3.15 Dispute Module
**Endpoints:**
| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| GET | /disputes | Yes | ADMIN | All disputes |
| POST | /disputes | Yes | CUSTOMER | Open dispute |
| PATCH | /disputes/:id | Yes | ADMIN | Resolve dispute |

### 3.16 Settlement Module
**Endpoints:**
| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| GET | /settlements | Yes | ADMIN | All settlements |
| PATCH | /settlements/:id/settle | Yes | ADMIN | Settle single |
| POST | /settlements/bulk-settle | Yes | ADMIN | Bulk settle |
| GET | /settlements/pending | Yes | ADMIN | Pending settlements |

### 3.17 Subscription Module
**Endpoints:**
| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| GET | /subscriptions/plans | No | - | Available plans |
| POST | /subscriptions/subscribe | Yes | WORKER/SHOP | Subscribe (requires payment) |
| GET | /subscriptions/my | Yes | WORKER/SHOP | My subscriptions |
| GET | /subscriptions | Yes | ADMIN | All subscriptions |

### 3.18 Promotion Module
**Endpoints:**
| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| GET | /promotions/banners | No | - | Active banners |
| GET | /promotions/banners/all | Yes | ADMIN | All banners |
| POST | /promotions/banners | Yes | ADMIN | Create banner |
| PATCH | /promotions/banners/:id | Yes | ADMIN | Update banner |
| DELETE | /promotions/banners/:id | Yes | ADMIN | Delete banner |
| POST | /promotions/validate | Yes | All | Validate promo code |
| GET | /promotions | Yes | ADMIN | All promotions |
| POST | /promotions | Yes | ADMIN | Create promotion |
| PATCH | /promotions/:id | Yes | ADMIN | Update promotion |
| DELETE | /promotions/:id | Yes | ADMIN | Delete promotion |

### 3.19 Notification Module
**Endpoints:**
| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| POST | /notifications/broadcast | Yes | ADMIN | Send broadcast |
| GET | /notifications | Yes | ADMIN | All notifications |
| GET | /notifications/my | Yes | All | My notifications |
| PATCH | /notifications/:id/read | Yes | All | Mark one read |
| PATCH | /notifications/read-all | Yes | All | Mark all read |
| DELETE | /notifications/:id | Yes | All | Soft-delete notification |
| GET | /notifications/unread-count | Yes | All | Unread count |

### 3.20 Settings Module
**Endpoints:**
| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| GET | /settings | Yes | ADMIN | All settings |
| GET | /settings/public | No | - | Public settings (ToS, plans) |
| GET | /settings/branding | No | - | Branding info |
| PATCH | /settings | Yes | ADMIN | Update settings |

### 3.21 Admin Module
**Endpoints (key ones):**
| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| GET | /admin/badges | Yes | ADMIN | KYC/payout/dispute counts |
| GET | /admin/stats | Yes | ADMIN | Dashboard stats |
| GET | /admin/customers | Yes | ADMIN | Customer list |
| GET | /admin/workers | Yes | ADMIN | Worker list |
| GET | /admin/shops | Yes | ADMIN | Shop list |
| GET | /admin/kyc/pending | Yes | ADMIN | Pending KYC |
| PATCH | /admin/kyc/:id | Yes | ADMIN | Approve/reject KYC |
| PATCH | /admin/users/:id | Yes | ADMIN | Update user |
| PATCH | /admin/users/:id/toggle | Yes | ADMIN | Toggle user status |
| DELETE | /admin/users/:id | Yes | ADMIN | Delete user |
| POST | /admin/users/impersonate | Yes | ADMIN | Impersonate user |
| PATCH | /admin/shops/:id/kyc | Yes | ADMIN | Shop KYC |
| PATCH | /admin/shops/:id/toggle | Yes | ADMIN | Toggle shop |
| POST | /admin/shops/:id/credit | Yes | ADMIN | Credit shop wallet |
| POST | /admin/shops/:id/debit | Yes | ADMIN | Debit shop wallet |
| GET | /admin/ledger | Yes | ADMIN | Full transaction ledger |
| GET | /admin/export/* | Yes | ADMIN | CSV exports |

### 3.22 Other Modules
| Module | Purpose |
|--------|---------|
| **AdminWallet** | Platform revenue pool, transactions |
| **Suggestion** | Worker-submitted category suggestions |
| **DeliveryStaff** | Shop delivery personnel |
| **Reports** | Admin analytics (revenue, performance, retention, demand) |

---

## 4. DATABASE SCHEMA (MongoDB)

### Collections & Models (25 collections)

```
┌────────────────────────────────────────────────────────────────────┐
│                        DATABASE SCHEMA                             │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Customer (single collection, 4 roles via `role` field)            │
│  ├── role: CUSTOMER | WORKER | ADMIN | SHOP                       │
│  ├── phone, email, name, password (bcrypt)                        │
│  ├── profileImage, addresses[], activeLocation (GeoJSON)          │
│  ├── wallet: { balance, bankDetails, upiId }                     │
│  ├── kyc: { status, documents[] }                                │
│  ├── subscription: { planId, expiryDate, isTrial, trialEndDate } │
│  ├── services[]: [{ category, subcategories[], isActive }]       │
│  ├── rating: { average, count }                                   │
│  ├── isOnline, serviceRadius, city, bio                           │
│  ├── fcmToken, notificationPreferences                            │
│  └── isDeleted, deletedAt (soft delete)                           │
│  Indexes: 13 (phone+role unique, email+role unique, 2dsphere,   │
│          worker availability compound, role compounds)            │
│                                                                    │
│  Job                                                               │
│  ├── customerId (ref Customer), workerId (ref Customer)           │
│  ├── category, subcategory, description, media[]                 │
│  ├── preferredDate, timeSlot (URGENT|MORNING|AFTERNOON|EVENING)   │
│  ├── status: BROADCASTING -> QUOTES_RECEIVED -> ALLOCATED         │
│  │          -> IN_PROGRESS -> COMPLETED -> PAID                   │
│  ├── location: GeoJSON Point (2dsphere index)                     │
│  ├── broadcast: { round, lastAttemptAt, radiusKm }               │
│  ├── payment: { amount, platformFee, gst, workerPayout, status } │
│  ├── security: { arrivalOtp, completionOtp }                     │
│  ├── rating: { score, review }                                    │
│  └── dispute: { reportedBy, reason, status, resolution }          │
│  Indexes: 5 (2dsphere, customer+date, worker+date, status+date)  │
│                                                                    │
│  Quote                                                             │
│  ├── jobId (ref Job), workerId (ref Customer)                    │
│  ├── amount, description, timeToReach, workerLocation              │
│  └── status: PENDING | ACCEPTED | REJECTED | WITHDRAWN            │
│  Indexes: 3 (job+status, worker+status, job+worker unique)       │
│                                                                    │
│  Shop                                                              │
│  ├── ownerId (ref Customer, unique)                               │
│  ├── name, category, description, logoUrl, address, location      │
│  ├── businessHours: { monFri, sat, sun }                         │
│  ├── deliveryConfig: { radiusKm, charge, freeAbove, minOrder }   │
│  ├── kyc: { status, documents[] }                                │
│  ├── payoutMethods[]: [{ type, label, detail, isPrimary }]       │
│  ├── wallet: { balance }                                          │
│  ├── subscription: { status, planId, expiryDate, isTrial }       │
│  └── rating, totalOrders, isOnline, isDeleted, deletedAt          │
│  Indexes: 3 (2dsphere, kyc.status, isDeleted)                     │
│                                                                    │
│  ShopOrder                                                         │
│  ├── orderNumber (unique), shopId, customerId                     │
│  ├── items[]: [{ productId, name, price, qty }]                  │
│  ├── subtotal, deliveryFee, discount, total                       │
│  ├── deliveryAddress, deliveryLocation (GeoJSON)                  │
│  ├── status: NEW -> CONFIRMED -> PACKING -> OUT_FOR_DELIVERY      │
│  │          -> DELIVERED | CANCELLED                               │
│  ├── deliveryOtp, deliveryStaffName/Phone (denormalized)          │
│  ├── payment: { amount, method, status, razorpayOrderId }        │
│  └── promoCode, promoDiscount, invoiceUrl                         │
│  Indexes: 4 (shop+status+date, customer+date, created, status+date)│
│                                                                    │
│  Product                                                           │
│  ├── shopId, name, price, imageUrl, category, brand, unit         │
│  ├── description, stock, minQty, isActive, attributes[]          │
│  Indexes: 3 (shopId, isActive, shop+category)                     │
│                                                                    │
│  Cart                                                              │
│  ├── customerId + shopId (unique compound)                        │
│  ├── items[]: [{ productId, name, price, qty, stockAtAdd }]      │
│  ├── subtotal, deliveryCharge, discount, totalAmount              │
│  └── expiresAt (TTL index: auto-delete)                           │
│  Indexes: 2 (TTL expiresAt, customer+shop unique compound)        │
│                                                                    │
│  Other Collections:                                                │
│  ├── Payment: { razorpayOrderId, amount, status, userId, refund } │
│  ├── WalletTxn: { userId, type, amount, balance, refId, desc }   │
│  ├── Notification: { userId, title, message, type, action,       │
│  │     entityType, entityId, readBy[], deletedBy[] }              │
│  ├── Dispute: { jobId, orderId, customerId, workerId, reason,    │
│  │     status, resolution }                                        │
│  ├── Settlement: { type, orderId, shopId, totalAmount,            │
│  │     platformCommission, shopEarning, status }                   │
│  ├── Payout: { workerId, shopId, amount, status, paymentMethod }  │
│  ├── WorkerSubscription: { workerId, planId, amount, endDate }   │
│  ├── ShopSubscription: { shopId, planId, amount, endDate }       │
│  ├── Message: { jobId, senderId, receiverId, text, mediaUrl }    │
│  ├── Category: { name, icon, color, subcategories[] }            │
│  ├── Promotion: { code, type, value, limits, applicable }         │
│  ├── Banner: { title, imageUrl, linkType, position, isActive }   │
│  ├── UserPromoUsage: { promoId, userId, usedAt }                 │
│  ├── AdminWallet: { balance, bankDetails, upiId }                │
│  ├── AdminWalletTxn: { type, amount, balanceAfter, reference }    │
│  ├── Suggestion: { workerId, type, payload, status }              │
│  ├── DeliveryStaff: { shopId, name, phone, activeOrderId }       │
│  └── AppSettings: { fees, wallet, subscription, radius, etc }     │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### Key Relationships
```
Customer (1) ─────< Job (M) as customerId
Customer (1) ─────< Job (M) as workerId
Customer (1) ─────< Shop (1) as ownerId
Shop (1) ──────────< ShopOrder (M)
Shop (1) ──────────< Product (M)
Shop (1) ──────────< DeliveryStaff (M)
Customer (1) ─────< Cart (1 per customer per shop)
Customer (1) ─────< WalletTxn (M)
Customer (1) ─────< Quote (M) as workerId
Job (1) ───────────< Quote (M)
Job (1) ───────────< Dispute (1)
ShopOrder (1) ────< Settlement (1)
ShopOrder (1) ────< Payment (1)
```

---

## 5. REDIS IMPLEMENTATION

**File:** `/workspace/backend/src/helpers/redis.helper.js`

### Cache Key Inventory (14 patterns)
| Key Pattern | TTL | Purpose | Set By | Invalidated By |
|------------|-----|---------|--------|----------------|
| `session:{userId}` | 24h | User session (full profile, no password) | auth middleware | logout, profile updates, wallet ops, KYC changes |
| `blacklist:{token}` | JWT remaining | JWT invalidation on logout | logout | Auto-expires |
| `reset_otp:{phone}` | 5min | Password reset OTP | forgot-password | Consumed on verify |
| `otp:{phone}` | 5min | Login OTP | sendOTP | verifyOTP |
| `otp_attempts:{phone}` | 1h | OTP rate limit counter | sendOTP | verifyOTP success |
| `app_settings` | 10min | Full platform settings | settings.get | settings.update |
| `categories_list` | 1h | All categories + subcategories | getCategories | Category CRUD (8 mutation points) |
| `admin_dashboard_stats_{range}` | 5min | Aggregated admin stats (5 ranges) | admin.getStats | Entity mutations (jobs, users, wallet, etc.) |
| `admin_badge_counts` | 1min | KYC/payout/dispute counts | admin.getBadgeCounts | Entity mutations |
| `admin_suggestions_list` | 1h | Pending suggestions | suggestion.get | Approve/reject |
| `admin_disputes_list` | 5min | All disputes | dispute.get | Open/close dispute |
| `admin_payouts_{status}` | 5min | Payouts | payout.get | Payout status update |
| `products_list_*` | 5min | Products (per shop/search) | product.get | Product CRUD |
| `shops_list_*` | 5min | Shops (search/paginated) | shop.getAllShops | Shop CRUD |
| `job:{jobId}:eligible_workers` | 30min | Worker IDs for job broadcast | job.createJob | Auto-expire |
| `job:{jobId}:assigned_worker` | 2h | Accepted worker for job | quote.acceptQuote | job.complete/pay/cancel |

### Distributed Locks (5 lock patterns)
| Lock Key | TTL | Used By | Description |
|----------|-----|---------|-------------|
| `lock:cron:broadcast_sweep` | 120s | Cron (1min) | Prevent duplicate broadcast expansion |
| `lock:cron:job_sweep` | 50s | Cron (1min) | Ghost job cleanup |
| `lock:cron:order_sweep` | 290s | Cron (5min) | Ghost order cleanup |
| `lock:cron:worker_sweep` | 590s | Cron (10min) | Expired subscription sweep |
| `lock:job_allocation_{jobId}` | 10s | quote.acceptQuote | Atomic job assignment (prevents double-booking) |
| `lock:{cacheKey}` | 10s | fetchWithCache | Cache stampede prevention |

### Connection Strategy
- **Retry:** Exponential backoff (50ms * attempts, max 2s), keeps retrying at longer intervals (max 60s)
- **Max retries per request:** 3
- **Graceful degradation:** Socket.IO adapter falls back to in-memory mode
- **Rate limiter behavior:** Uses rate-limit-redis with RedisStore

---

## 6. SOCKET.IO REAL-TIME SYSTEM

**Files:** `/workspace/backend/src/sockets/index.js`, `/workspace/backend/src/helpers/socket.helper.js`

### Authentication & Room Architecture
On connection, JWT-authenticated sockets auto-join:
- `user_{userId}` — personal notification feed (all roles)
- `customer_{userId}` — customer real-time events
- `worker_{userId}` — worker job alerts & updates
- `shop_{ownerId}` — shop order notifications
- `admin_dashboard` — admin live stats (ADMIN role only)

### Event Map
```
CLIENT -> SERVER (inbound):
  JOIN_JOB_ROOM       — Join job-specific chat room (auth + ownership check)
  WORKER_LOCATION_UPDATE — Stream GPS coords (server-verified via Redis assignment cache)
  SEND_MESSAGE        — In-app chat message (2KB limit, XSS sanitized)

SERVER -> CLIENT (outbound):
  NEW_JOB_ALERT       -> worker_{id}      — New job in worker's area
  NEW_QUOTE           -> customer_{id}    — Worker placed a quote
  QUOTE_ACCEPTED      -> worker_{id}      — Customer accepted quote
  JOB_TAKEN           -> job_{id}         — Job assigned (broadcast to all bidders)
  WORKER_LOCATION     -> customer_{id}    — Real-time GPS tracking
  START_TIMER         -> worker_{id}      — Start job timer
  JOB_STARTED         -> customer_{id}    — Worker arrived (OTP verified)
  JOB_COMPLETED       -> customer_{id}    — Work finished
  JOB_PAID            -> worker_{id}      — Payment received
  JOB_STATUS_CHANGED  -> cust*/worker*    — Status updates
  JOB_DISPUTED        -> customer_{id}    — Dispute filed
  DISPUTE_RESOLVED    -> cust*/worker*    — Dispute resolved
  FORCED_OFFLINE      -> worker_*         — Admin/cron forces offline
  JOB_RADIUS_EXPANDED -> customer_{id}    — Broadcast radius expanded
  NEW_ORDER           -> shop_{id}        — New shop order received
  ORDER_STATUS        -> cust*/shop*      — Order status change
  NEW_MESSAGE         -> job_{id}/user_{id} — Chat message
  NEW_NOTIFICATION    -> user_{id}/admin_dashboard — In-app notification
  DASHBOARD_UPDATE    -> admin_dashboard  — Admin panel refresh trigger
  ERROR               -> socket           — Error messages
```

### Redis Adapter Configuration
- Pub/Sub adapter for Socket.IO enables cross-node messaging in PM2 cluster mode
- pubClient + subClient (duplicated connection)
- Graceful fallback to in-memory mode if Redis unavailable

---

## 7. MOBILE APP - COMPLETE SCREENS

**Source:** `/workspace/mobile/src/`
**Total screens:** 56 across 6 feature categories

### 7.1 Auth Screens (6)
```
SplashScreen -> RoleSelection -> LoginScreen -> OTPVerifyScreen -> SetPasswordScreen
                                                              \-> ForgotPasswordScreen
```
- **SplashScreen**: Animated onboarding with brand value propositions
- **RoleSelection**: Pick CUSTOMER/WORKER/SHOP, enter phone + name
- **LoginScreen**: Phone + password or phone + OTP login, role switching
- **OTPVerifyScreen**: 4-digit OTP input with auto-focus, auto-navigation
- **SetPasswordScreen**: Password creation with strength meter (weak/fair/good/strong)
- **ForgotPasswordScreen**: 2-step flow: phone -> reset OTP -> new password

### 7.2 Customer Screens (26)
```
HomeScreen -> SubCategoriesScreen -> DescribeJobScreen -> LiveBidsScreen
         \-> ShopScreen -> ShopDetailScreen -> CartScreen
         \-> WorkerProfileScreen

BookServiceScreen -> SubCategoriesScreen -> DescribeJobScreen

WalletScreen -> WalletTopupScreen

ProfileScreen -> EditProfileScreen | SavedAddressesScreen | PaymentMethodsScreen
              -> OrderHistoryScreen | ReferEarnScreen | HelpSupportScreen
              -> PrivacyScreen | NotificationsScreen

QuotesScreen -> PastJobDetailsScreen
LiveTrackingScreen -> WorkCompletedScreen -> RateExperienceScreen
ChatScreen (from any tab)
```

### 7.3 Worker Screens (12)
```
WorkerDashboard -> WorkerJobDetailsScreen -> WorkerMyQuotesScreen
               -> WorkerNavigateJobScreen -> WorkerArrivalOTPScreen
               -> WorkerActiveJobScreen -> WorkerJobCompleteScreen
               -> WorkerRateCustomerScreen | WorkerJobCanceledScreen

WorkerEarningsScreen -> subscription plans / withdrawal
WorkerManageServicesScreen -> categories / radius
WorkerProfileScreen -> KYC / bank / profile / service management
NotificationsScreen
```

### 7.4 Shop Screens (10)
```
ShopDashboardScreen -> CreateShopScreen (if no shop)
                    -> ShopOrdersScreen -> ShopOrderDetailScreen
                    -> ShopProductsScreen (CRUD)
                    -> ShopWalletScreen
                    -> ShopSettingsScreen -> ShopDeliveryConfigScreen
                    -> ShopNotificationsScreen
```

### 7.5 Navigation Structure
```
RootNavigator (role-based)
├── AuthStack (unauthenticated)
├── CustomerTabs (5 tabs: Home | Shop | Book[FAB] | Wallet | Profile)
├── WorkerTabs (5 tabs: Dashboard | Jobs | Power[FAB] | Earnings | Profile)
├── ShopTabs (5 tabs: Dashboard | Orders | Products | Wallet | Settings)
└── ChatScreen (stack-level, all roles)
```

### 7.6 Context Providers (wrap order)
1. **AuthContext**: `{ userToken, userRole, user, signIn, signOut, isLoading }`
2. **ThemeContext**: `{ theme, isDarkMode, toggleTheme }` (Dark/Light as CSS variables)
3. **NotificationContext**: `{ unreadCount, refreshUnread }` (polls every 5min, socket listener)
4. **CartContext**: `{ cart, itemCount, subtotal, total, addToCart, updateItem, clearCart, validatePromo }`

---

## 8. ADMIN PANEL - COMPLETE PAGES

**Source:** `/workspace/admin/src/`
**Total pages:** 22 modules

### 8.1 Navigation Structure
```
AppLayout (sidebar + topbar)
├── Overview
│   └── Dashboard (KPIs, charts, top workers, activity feed)
├── Management
│   ├── Users (customer list, CRUD, impersonate)
│   ├── Workers (worker list, KYC filter, toggle online)
│   ├── Shops (shop list, wallet credit/debit, KYC)
│   ├── Jobs (all jobs, reassign, resolve disputes)
│   └── KYC (pending verification queue)
├── Platform
│   ├── Orders (shop orders, status management)
│   ├── Categories (CRUD with subcategories + fees)
│   ├── Promotions (banners CRUD + promo codes CRUD)
│   ├── Settlements (view, single settle, bulk settle)
│   └── Disputes (view, resolve, refund)
├── Finance
│   ├── Payouts (process payout: approve/transfer/complete/reject)
│   ├── Wallets (user wallet adjustment)
│   ├── Admin Wallet (platform revenue pool)
│   ├── Subscriptions (plan management)
│   └── Ledger (full transaction history)
├── Communication
│   ├── Notifications (send broadcast)
│   └── Support Chats (real-time chat with users)
├── Analytics
│   └── Reports (revenue, performance, retention, demand tabs)
└── System
    ├── Admin Users (profile + security)
    └── Settings (fees, wallet, subscription plans, radius, branding, legal, maintenance)
```

### 8.2 Shared Components
| Component | Purpose |
|-----------|---------|
| **Modal** | Generic overlay dialog |
| **ConfirmModal** | Confirmation with danger/primary variants |
| **Drawer** | Slide-in right panel for details/edit |
| **ToastContainer** | Global toast notification manager (success/error/warning/info) |
| **Table** | Reusable data table with loading/empty states |
| **Badge** | Status badge (color variants) |
| **Pagination** | Server-side pagination controls |
| **EmptyState** | Empty data placeholder |
| **FormInput** | Input components (text, select, textarea) + validators |
| **MapPicker** | Leaflet map with geolocation + address search |
| **WalletAdjuster** | Credit/debit wallet form |

### 8.3 Real-Time Features
- Dashboard auto-updates via `DASHBOARD_UPDATE` socket events
- Badge counts (KYC/payouts/disputes) refresh via socket
- Notification bell with dropdown + unread badge
- Support chat with real-time messaging

### 8.4 Routing (react-router-dom v6)
```
/login                  -> Login (public)
/receipt/:id            -> JobReceipt (public, printable invoice)
/*                      -> Protected (AppLayout wrapper)
/                       -> Dashboard
/users, /workers, /shops, /jobs, /kyc
/categories, /payouts, /wallets, /admin-wallet
/subscriptions, /ledger, /orders
/settlements, /promotions, /disputes
/notifications, /support-chats
/reports, /admin-users, /settings
```

---

## 9. COMPLETE FLOW: CUSTOMER

```
STEP 1: REGISTRATION
  Open App -> SplashScreen -> RoleSelection (CUSTOMER)
  -> Enter phone + name -> LoginScreen -> Enter OTP
  -> OTPVerifyScreen -> SetPasswordScreen
  [Backend: sendOTP -> Redis(5min) -> verifyOTP -> JWT(7d) -> session cache]

STEP 2: PROFILE SETUP
  Profile tab -> EditProfileScreen -> name, email, photo (Cloudinary)
  [Backend: PATCH /customers/me/profile -> invalidate Redis session]

STEP 3: ADDRESS MANAGEMENT
  Profile -> SavedAddressesScreen -> Add/edit/set primary address
  [Backend: CRUD /customers/me/addresses]

STEP 4: BROWSE & BOOK SERVICE
  HomeScreen -> tap category (e.g. Plumbing) -> SubCategoriesScreen
  -> tap subcategory -> DescribeJobScreen
  -> Fill: schedule, location(GPS), description, photos
  -> Submit
  [Backend: POST /jobs -> GeoJSON -> findEligibleWorkers -> 
   Socket.IO NEW_JOB_ALERT to worker_{id} -> Redis cache eligible workers]

STEP 5: REVIEW & ACCEPT QUOTES
  LiveBidsScreen (real-time socket updates) -> QuotesScreen
  -> View quotes (amount, ETA) -> Accept
  [Backend: PATCH /quotes/:id/accept -> Redis lock(job_allocation) -> 
   MongoDB txn: set worker, accept quote, reject others, generate OTPs]

STEP 6: LIVE TRACKING
  LiveTrackingScreen -> worker GPS via WebView map
  [Socket: WORKER_LOCATION_UPDATE -> customer_{id} -> WORKER_LOCATION]

STEP 7: WORKER ARRIVAL
  Worker arrives -> enters arrival OTP
  [Backend: POST /jobs/:id/start -> validate OTP + 200m geofence -> IN_PROGRESS]
  [Socket: JOB_STARTED -> customer]

STEP 8: WORK COMPLETION
  Worker uploads photos, enters completion OTP
  [Backend: POST /jobs/:id/complete -> validate OTP -> COMPLETED]
  [Socket: JOB_COMPLETED -> customer]

STEP 9: PAYMENT
  WorkCompletedScreen -> CASH or WALLET
  [Backend: POST /jobs/:id/pay -> MongoDB txn: 
   deduct customer wallet, credit worker wallet(-fee), AdminWallet(+fee)]
  [Socket: JOB_PAID -> worker]

STEP 10: RATING
  RateExperienceScreen -> star rating 1-5 + review
  [Backend: POST /jobs/:id/rate -> update worker average rating]

ALTERNATIVE: SHOP ORDER
  HomeScreen -> ShopScreen -> ShopDetailScreen -> Cart -> checkout
  [Backend: POST /shoporders -> txn: stock reserve + wallet deduct + OTP]
  [Socket: NEW_ORDER -> shop_{id}]
  OrderTrackingScreen -> status steps (Placed->Confirmed->...->Delivered)
  [Socket: ORDER_STATUS updates]
```

---

## 10. COMPLETE FLOW: WORKER

```
STEP 1: REGISTRATION
  SplashScreen -> RoleSelection (WORKER) -> LoginScreen -> OTPVerify
  -> SetPasswordScreen
  [Backend: creates Customer with role=WORKER, auto-14-day free trial]

STEP 2: KYC VERIFICATION
  WorkerProfileScreen -> upload PAN/Aadhaar/selfie
  [Backend: PATCH /workers/me/kyc -> Cloudinary upload -> PENDING]
  Admin reviews -> APPROVED/REJECTED
  [Socket: NEW_NOTIFICATION -> worker_{id}]

STEP 3: PROFILE COMPLETION
  WorkerManageServicesScreen -> select categories/subcategories
  WorkerProfileScreen -> set service radius, bank/UPI, profile photo
  [Backend: PATCH /workers/me/services, PATCH /workers/me/bank]

STEP 4: GO ONLINE
  WorkerDashboard -> tap Power FAB -> toggle online
  [Backend: PATCH /workers/me/online -> guards: KYC+subscription+wallet]
   Starts GPS location streaming

STEP 5: RECEIVE JOBS
  WorkerDashboard -> see available jobs (within radius + matching category)
  [Socket: NEW_JOB_ALERT -> worker_{id}]
  [Backend: cron sweeps expand job radius in rounds -> JOB_RADIUS_EXPANDED]

STEP 6: QUOTE ON JOB
  Tap job -> WorkerJobDetailsScreen -> see details + map
  -> Place Quote: amount, ETA, description
  [Backend: POST /quotes -> validate eligibility -> emit NEW_QUOTE to customer]

STEP 7: JOB ACCEPTED
  [Socket: QUOTE_ACCEPTED -> worker]
  WorkerNavigateJobScreen -> map route to customer + contact info

STEP 8: ARRIVE & START
  WorkerArrivalOTPScreen -> customer shares arrival OTP -> enter
  [Backend: POST /jobs/:id/start -> OTP+GEO validation -> IN_PROGRESS]
  [Socket: JOB_STARTED -> customer]

STEP 9: ACTIVE JOB
  WorkerActiveJobScreen -> timer, completion checklist, photo upload

STEP 10: COMPLETE JOB
  WorkerJobCompleteScreen -> upload before/after photos, enter completion OTP
  [Backend: POST /jobs/:id/complete -> validate OTP -> COMPLETED]
  [Socket: JOB_COMPLETED -> customer]

STEP 11: GET PAID
  [Socket: JOB_PAID -> worker] (after customer pays)
  Worker wallet balance updated
  [Backend: worker.wallet.balance += workerPayout]

STEP 12: RATE CUSTOMER
  WorkerRateCustomerScreen -> star rating + optional note

STEP 13: EARNINGS & WITHDRAW
  WorkerEarningsScreen -> summary/chart/transactions
  -> Request withdrawal: amount + method (BANK/UPI)
  [Backend: POST /workers/earnings/withdraw -> txn: wallet deduct + Payout create]
  Admin processes: PENDING -> APPROVED -> TRANSFERRED -> COMPLETED

FORCED OFFLINE SCENARIOS:
  - Subscription expires (cron checks daily)
  - Admin toggles worker offline
  [Socket: FORCED_OFFLINE -> worker]
```

---

## 11. COMPLETE FLOW: SHOP

```
STEP 1: REGISTRATION
  SplashScreen -> RoleSelection (SHOP) -> LoginScreen -> OTPVerify
  -> SetPasswordScreen

STEP 2: SHOP CREATION
  ShopDashboardScreen (no shop?) -> CreateShopScreen
  -> Enter: name, category, address, description, logo (Cloudinary)
  -> Location picker (LeafletMapPicker), business hours
  -> Delivery config: radius, charge, free threshold, min order
  [Backend: POST /shops -> KYC PENDING]

STEP 3: KYC APPROVAL
  Admin reviews -> approves/rejects
  [Socket: NEW_NOTIFICATION -> shop_{ownerId}]

STEP 4: PRODUCT MANAGEMENT
  ShopProductsScreen -> Add product: name, price, stock, brand, category, image
  [Backend: CRUD /products]

STEP 5: SERVICE ORDERS
  [Socket: NEW_ORDER -> shop_{id}] (customer placed order)
  ShopOrdersScreen -> see order in NEW status

STEP 6: ORDER PROCESSING
  ShopOrderDetailScreen -> status progression:
    Accept -> PACKING -> OUT_FOR_DELIVERY -> Deliver (OTP)
  [Backend: PATCH /shoporders/:id/status -> each step validates state machine]
  [Socket: ORDER_STATUS -> customer]

STEP 7: DELIVERY
  ShopDeliveryConfigScreen -> manage delivery staff
  Assign staff to delivery -> provide OTP to customer
  Customer verifies OTP -> DELIVERED

STEP 8: SETTLEMENT
  [Backend: Settlement created: totalAmount, platformCommission, shopEarning]
  Admin processes -> shop wallet credited
  [Backend: PATCH /settlements/:id/settle -> WalletTxn created]

STEP 9: WALLET & WITHDRAWAL
  ShopWalletScreen -> balance, transactions
  -> Request withdrawal: amount + payout method (BANK/UPI)
  [Backend: POST /wallet/withdraw -> wallet deduct + Payout create]
```

---

## 12. COMPLETE FLOW: ADMIN

```
STEP 1: LOGIN
  /login -> email + password
  [Backend: POST /auth/login -> JWT -> localStorage(kwickly_admin_token)]

STEP 2: DASHBOARD
  / (Dashboard) -> KPIs: total customers/workers/shops, active jobs, revenue
  -> 7-day chart, top workers, recent activity, badge counts
  Real-time: DASHBOARD_UPDATE socket events -> auto-refresh

STEP 3: USER MANAGEMENT
  /users -> customer list (paginated, searchable) -> detail drawer:
    profile, wallet, addresses, notification prefs, jobs/orders history
  Actions: toggle active/inactive, soft delete, impersonate, export CSV

  /workers -> worker list (filter by KYC) -> detail:
    profile, wallet, services, subscription, ratings, KYC docs
  Actions: toggle online, extend subscription, approve/reject KYC

  /shops -> shop list -> detail:
    products, orders, delivery config, payout methods
  Actions: credit/debit wallet, toggle status, KYC management

STEP 4: KYC VERIFICATION
  /kyc -> combined worker + shop pending KYC queue
  Review documents -> approve/reject with reason
  [Socket: NEW_NOTIFICATION -> worker_{id}/shop_{ownerId}]

STEP 5: JOB MANAGEMENT
  /jobs -> all jobs (search, filter) -> detail with full timeline
  Actions: admin-create job, reassign worker, resolve disputes
  /receipt/:id -> printable invoice

STEP 6: ORDER MANAGEMENT
  /orders -> all shop orders (search, filter by status)
  -> view order detail: items, status history, payment, invoice

STEP 7: FINANCE
  /wallets -> customer/worker/shop wallets -> manual credit/debit
  /admin-wallet -> platform revenue pool -> transactions, collect commission
  /payouts -> worker/shop withdrawal requests
    -> process: PENDING -> APPROVED -> TRANSFERRED -> COMPLETED (or REJECTED)
  /settlements -> pending shop settlements -> single or bulk settle
  /ledger -> full platform transaction history (filterable)

STEP 8: PLATFORM MANAGEMENT
  /categories -> CRUD categories + subcategories, set fees
  /promotions -> banner CRUD + promo code CRUD (type, limits, targeting)
  /notifications -> send broadcast to all or role-specific
  /support-chats -> real-time chat with users (Socket.IO)

STEP 9: SETTINGS
  /settings (6 tabs):
    Fees: platform fee (flat/%) + GST, per-subcategory overrides
    Wallet: minimum balance, topup presets
    Subscription: free trial days, plan management (price/duration/features)
    Radius: max search radius, broadcast rounds
    Branding: app name, logo, icon
    Legal: Terms of Service + Privacy Policy URLs

STEP 10: REPORTS
  /reports (4 tabs):
    Revenue: earnings over time, by category, by worker
    Performance: worker performance metrics
    Retention: customer/worker retention rates
    Demand: most-requested services, peak hours
```

---

## 13. ENVIRONMENT VARIABLES

### Backend (`/workspace/backend/.env.production`)
```bash
# Server
NODE_ENV=production
PORT=5000

# Database
MONGO_URI=mongodb://user:pass@host:27017/kwickly?authSource=admin

# Redis
REDIS_URL=redis://:password@host:6379

# Authentication
JWT_SECRET=your-jwt-secret-min-32-chars-long
JWT_EXPIRES_IN=7d

# Razorpay
RAZORPAY_KEY_ID=rzp_live_xxx
RAZORPAY_KEY_SECRET=your-razorpay-secret
RAZORPAY_WEBHOOK_SECRET=your-webhook-secret

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# SMS (one of)
ENABLE_REAL_SMS=true
FAST2SMS_API_KEY=...
# TWILIO_ACCOUNT_SID=...
# TWILIO_AUTH_TOKEN=...
# TWILIO_PHONE_NUMBER=...

# CORS
ALLOWED_ORIGINS=https://admin.kwickly.com,https://kwickly.com

# App
APP_NAME=Kwickly
APP_URL=https://kwickly.com
ADMIN_URL=https://admin.kwickly.com
```

### Mobile (`/workspace/mobile/.env`)
```bash
API_BASE_URL=http://10.0.2.2:5000/api/v1
GOOGLE_MAPS_API_KEY=your-google-maps-key
RAZORPAY_KEY_ID=your-razorpay-key
```

### Admin (`/workspace/admin/.env`)
```bash
VITE_API_URL=http://localhost:5000/api/v1
VITE_SOCKET_URL=http://localhost:5000
```

---

## 14. INFRASTRUCTURE & DEPLOYMENT

### Docker Compose (`/workspace/docker-compose.yml`)
```
MongoDB 7  (port 27017 -> 127.0.0.1, auth: MONGO_ROOT_USER/PASSWORD)
Redis 7    (port 6379  -> 127.0.0.1, auth: REDIS_PASSWORD)
Backend API (port 5000, depends on MongoDB + Redis health)
```

### Backend Process (PM2 Ecosystem)
- **Cluster mode:** PM2 manages multiple Node.js instances
- **Graceful shutdown:** SIGTERM handler -> stop accepting -> finish inflight -> disconnect DB/Redis
- **Cron engine:** Master process runs 4 sweeps with Redis distributed locks
- **Health check:** GET /health -> `{ status: 'ok' }`

### Codebase Structure
```
/workspace/
├── backend/                  # Node.js/Express API Server
│   ├── src/
│   │   ├── server.js          # Entry point, startup sequence
│   │   ├── app.js             # Express config, middleware, routes
│   │   ├── config/            # DB connection
│   │   ├── constants/         # Messages, business constants
│   │   ├── helpers/           # Redis, Socket, Razorpay, Geo, etc.
│   │   ├── middleware/        # Auth, Role, Validation, Rate Limit, etc.
│   │   ├── modules/           # 24 domain modules (model+controller+routes)
│   │   ├── services/          # Cloudinary, SMS
│   │   ├── sockets/           # Socket.IO event handlers
│   │   ├── validators/        # Joi schemas
│   │   └── __tests__/         # 32 test suites, 620+ tests
│   ├── Dockerfile
│   ├── ecosystem.config.js    # PM2 config
│   └── package.json
│
├── mobile/                    # React Native App
│   ├── src/
│   │   ├── app/navigation/    # AuthStack, CustomerTabs, ShopTabs, WorkerTabs
│   │   ├── features/          # 56 screens across auth/customer/worker/shop/chat
│   │   ├── components/        # Reusable UI components
│   │   ├── services/          # API client + 9 service modules
│   │   ├── contexts/          # Auth, Cart, Notification, Theme providers
│   │   ├── hooks/             # useSocket hook
│   │   └── assets/            # Images, icons, service assets
│   ├── android/               # Native Android (Kotlin)
│   ├── ios/                   # Native iOS (Swift)
│   └── package.json
│
├── admin/                     # React Admin Panel
│   ├── src/
│   │   ├── App.jsx            # Root router
│   │   ├── layouts/           # AppLayout (sidebar + header)
│   │   ├── modules/           # 22 admin pages
│   │   ├── components/        # Shared UI components
│   │   ├── services/          # API client
│   │   ├── contexts/          # Theme provider
│   │   └── hooks/             # useServerPagination
│   ├── vite.config.js
│   └── package.json
│
├── docker-compose.yml         # Full stack deployment
└── README.md
```
