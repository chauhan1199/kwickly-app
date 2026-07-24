# Kwickly Platform — Complete Flow Documentation

> **Audience**: New developers onboarding to the Kwickly codebase.
> **Last updated**: July 2026

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [Customer Complete Flow](#2-customer-complete-flow)
3. [Worker Complete Flow](#3-worker-complete-flow)
4. [Shop Complete Flow](#4-shop-complete-flow)
5. [Admin Complete Flow](#5-admin-complete-flow)
6. [Real-Time Infrastructure](#6-real-time-infrastructure)
7. [Background Processing](#7-background-processing)
8. [Payment System](#8-payment-system)
9. [Security](#9-security)
10. [Database Schema Summary](#10-database-schema-summary)
11. [API Endpoint Reference](#11-api-endpoint-reference)
12. [Testing](#12-testing)

---

## 1. Platform Overview

### What is Kwickly?

Kwickly is a **service marketplace platform** that connects customers who need home/services with verified local workers, while also operating a localized e-commerce marketplace where nearby shops can sell products to customers. Think of it as a combination of Urban Company (services) and a neighborhood grocery delivery app (shop orders).

### Three User Personas

| Persona | Description | Mobile App | Key Models |
|---------|-------------|------------|------------|
| **Customer** | Requests services or buys products from nearby shops | React Native (CustomerTabs) | `Customer`, `Job`, `Cart`, `ShopOrder` |
| **Worker** | Provides services (AC repair, plumbing, etc.) and receives job bids | React Native (WorkerTabs) | `Customer` (role=WORKER), `Quote`, `WalletTxn` |
| **Shop** | Runs a local store, manages products, fulfills orders | React Native (ShopTabs) | `Shop`, `Product`, `ShopOrder`, `DeliveryStaff` |

### Admin Panel

A separate React SPA (`admin/`) provides platform management:

- **Tech**: React 18, Vite, React Router v6, Recharts, Leaflet (maps)
- **Modules**: Dashboard, Users, Workers, Shops, Jobs, Orders, Wallets, KYC, Payouts, Settlements, Promotions, Reports, Settings, Disputes, Support Chat

### Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| **Backend** | Node.js 22+, Express 5, Mongoose 9, Socket.IO 4 |
| **Database** | MongoDB (Mongoose ODM) |
| **Cache / PubSub** | Redis (ioredis) |
| **Mobile** | React Native 0.85 (TypeScript) |
| **Admin** | React 18, Vite |
| **Payments** | Razorpay (orders, refunds, webhooks) |
| **SMS/OTP** | Twilio / Fast2SMS / MSG91 (pluggable) |
| **Push Notifications** | Firebase Cloud Messaging (FCM) |
| **File Storage** | Cloudinary |
| **Background Jobs** | node-cron (in-process cron engine) |
| **Testing** | Jest, Supertest, MongoDB Memory Server |

---

## 2. Customer Complete Flow

### 2.1 Registration

The registration flow uses OTP-based phone verification. The same flow handles both registration (new account) and login (existing account).

**Step 1: Request OTP**

```
POST /api/v1/auth/send-otp
Content-Type: application/json

{
  "phone": "9876543210",
  "role": "CUSTOMER"
}
```

- Rate limited: 3 requests per 10 minutes per IP (`otpSendLimiter`)
- Backend generates a 4-digit OTP, stores it in Redis with a TTL, and sends via SMS (Twilio in production, console log in dev)
- Response: `{ status: "success", message: "Verification code sent successfully" }`

**Step 2: Verify OTP**

```
POST /api/v1/auth/verify-otp
Content-Type: application/json

{
  "phone": "9876543210",
  "code": "1234",
  "role": "CUSTOMER",
  "name": "John Doe"
}
```

- If phone + role exists → **Login**: returns JWT + user data
- If phone + role doesn't exist → **Registration**: creates account in MongoDB, returns JWT + user data
- OTP is validated against Redis cache, then deleted
- Response includes: `{ token, user: { _id, name, role, ... } }`

**Step 3: Set Password (Optional)**

```
PATCH /api/v1/auth/set-password
Authorization: Bearer <token>
Content-Type: application/json

{
  "password": "securePassword123"
}
```

**Step 4: Check Auth Status**

```
POST /api/v1/auth/check-status
Authorization: Bearer <token>
```

Returns current user data if token is valid.

**Step 5: Get Current User**

```
GET /api/v1/auth/me
Authorization: Bearer <token>
```

### 2.2 Profile Setup

**Update Profile**

```
PUT /api/v1/customers/me/profile
Authorization: Bearer <token>
Content-Type: multipart/form-data

Fields:
  - name: "John Doe"
  - email: "john@example.com"
  - city: "Mumbai"
  - bio: "Looking for home services"
  - profileImage: <file>
```

**Add Address**

```
POST /api/v1/customers/me/addresses
Authorization: Bearer <token>
Content-Type: application/json

{
  "label": "Home",
  "street": "123 Main St",
  "city": "Mumbai",
  "area": "Andheri",
  "pincode": "400053",
  "location": {
    "type": "Point",
    "coordinates": [72.8777, 19.0760]
  },
  "isPrimary": true
}
```

**Other Address Operations**:
- `PUT /api/v1/customers/me/addresses/:addressId` — Update address
- `DELETE /api/v1/customers/me/addresses/:addressId` — Delete address
- `PATCH /api/v1/customers/me/addresses/:addressId/primary` — Set as primary

### 2.3 Browse Services

**Get All Categories**

```
GET /api/v1/categories
```

- Public endpoint (no auth required)
- Returns categories with nested subcategories
- Each subcategory has `platformFee`, `minPrice`, `suggestedMax`

**Get Top Pros (Workers)**

```
GET /api/v1/customers/top-pros
Authorization: Bearer <token>
```

Returns top-rated workers based on rating and job completion count.

**View Worker Profile**

```
GET /api/v1/customers/workers/:workerId
Authorization: Bearer <token>
```

### 2.4 Post a Job

**Create Job**

```
POST /api/v1/jobs
Authorization: Bearer <token>
Content-Type: application/json

{
  "category": "AC Repair",
  "subcategory": "AC Servicing",
  "description": "AC not cooling properly, needs servicing",
  "location": {
    "type": "Point",
    "coordinates": [72.8777, 19.0760]
  },
  "addressDetails": {
    "city": "Mumbai",
    "fullAddress": "123 Main St, Andheri, Mumbai"
  },
  "timeSlot": "morning",
  "preferredDate": "2026-07-20"
}
```

**Validation rules** (from `job.validator.js`):
- Customer must have fewer than 5 active jobs
- Category is required
- Location coordinates are required (GeoJSON Point)

**Broadcasting**:
1. Job is created with status `BROADCASTING`
2. Backend queries for eligible workers using `findEligibleWorkers()`:
   - Must be verified (`isVerified: true`)
   - KYC approved
   - Currently online (`isOnline: true`)
   - Has active subscription (or within trial period)
   - Wallet balance >= minimum (default ₹100)
   - Within service radius of job location (Haversine distance)
   - Category match
3. Eligible workers receive `NEW_JOB_ALERT` via Socket.IO
4. If no workers found initially, the cron engine expands the radius progressively (Round 1: 15km, Round 2: 30km, Round 3: 45km)
5. If still no workers after 3 rounds, job is auto-cancelled (unless scheduled for future date)

### 2.5 Receive and Compare Quotes

**View Quotes for a Job**

```
GET /api/v1/quotes/job/:jobId
Authorization: Bearer <token>
```

Returns all quotes with worker details (name, rating, profile image).

**Accept a Quote**

```
PATCH /api/v1/quotes/:quoteId/accept
Authorization: Bearer <token>
```

**What happens on acceptance**:
1. Quote status → `ACCEPTED`
2. All other quotes for the same job → `REJECTED`
3. Job status → `ALLOCATED`
4. Assigned worker is set on the job
5. Security OTPs generated (arrival OTP + completion OTP)
6. Worker receives `QUOTE_ACCEPTED` socket event
7. Other bidders receive `QUOTE_REJECTED` socket events
8. Customer receives `JOB_ALLOCATED` socket event

### 2.6 Job Execution

**Worker Arrives at Site**

1. Customer shares the **arrival OTP** verbally with the worker
2. Worker enters the arrival OTP in the app
3. Backend verifies:
   - OTP matches the stored `security.arrivalOtp`
   - Worker's GPS coordinates are within 200m of the job location (anti-spoofing)
4. Job status → `IN_PROGRESS`
5. Real-time location tracking begins (worker shares GPS via socket `WORKER_LOCATION_UPDATE`)

**Worker Completes Job**

```
POST /api/v1/jobs/:jobId/complete
Authorization: Bearer <token>
Content-Type: multipart/form-data

Fields:
  - completionOtp: "5678"
  - report: "AC serviced, filter cleaned, gas topped up"
  - media: <file(s)>
```

- Verifies completion OTP
- Uploads media to Cloudinary
- Job status → `COMPLETED`
- Receipt is generated

### 2.7 Payment

**Pay for Job (Cash or Online)**

```
POST /api/v1/jobs/:jobId/pay
Authorization: Bearer <token>
Content-Type: application/json

{
  "method": "CASH"
}
```

Or for online payment:
```
{
  "method": "ONLINE"
}
```

**Cash Flow**:
1. Customer hands cash to worker
2. Backend deducts platform fee + GST from worker's virtual wallet
3. Job status → `PAID`

**Online Flow**:
1. Backend creates Razorpay order via `createRazorpayOrder()`
2. Frontend opens Razorpay checkout (`react-native-razorpay`)
3. Customer completes payment
4. Frontend calls `/api/v1/payments/verify` with payment details
5. Backend verifies HMAC signature, credits worker wallet
6. Job status → `PAID`

**Payment breakdown**:
```
Total Amount = WorkerPayout + PlatformFee + GST
PlatformFee = Flat amount (default ₹50) OR percentage, configurable in settings
GST = PlatformFee × GST% (default 18%)
```

### 2.8 Rating

```
POST /api/v1/jobs/:jobId/rate
Authorization: Bearer <token>
Content-Type: application/json

{
  "score": 5,
  "review": "Excellent work, very professional!"
}
```

- Only available for jobs in `PAID` status
- Updates job's `rating` field
- Updates worker's `rating.average` and `rating.count`

### 2.9 Shop Order Alternative Flow

**Browse Shop**

```
GET /api/v1/shops/:shopId
Authorization: Bearer <token>
```

**View Shop Products**

```
GET /api/v1/products?shopId=<shopId>
Authorization: Bearer <token>
```

**Add to Cart**

```
POST /api/v1/cart
Authorization: Bearer <token>
Content-Type: application/json

{
  "shopId": "<shopId>",
  "productId": "<productId>",
  "qty": 2
}
```

**View Cart**

```
GET /api/v1/cart
Authorization: Bearer <token>
```

- Cart has a TTL index (auto-expires after configured time)
- Cart is per-customer, per-shop

**Place Order**

```
POST /api/v1/shoporders
Authorization: Bearer <token>
Content-Type: application/json

{
  "shopId": "<shopId>",
  "deliveryAddress": "123 Main St, Mumbai",
  "deliveryLocation": {
    "type": "Point",
    "coordinates": [72.8777, 19.0760]
  },
  "paymentMethod": "WALLET"
}
```

**Order Lifecycle**:
1. `NEW` → Shop receives real-time alert
2. `CONFIRMED` → Shop accepts the order
3. `PACKING` → Shop is preparing
4. `OUT_FOR_DELIVERY` → Delivery staff dispatched with delivery OTP
5. `DELIVERED` → Handed to customer (delivery OTP verified)

**Cancel Order**

```
POST /api/v1/shoporders/:orderId/cancel
Authorization: Bearer <token>
```

- Only allowed in `NEW` or `CONFIRMED` status
- If paid online, refund is credited to customer wallet

---

## 3. Worker Complete Flow

### 3.1 Registration and KYC

**Register via OTP** (same flow as Customer, but with `role: "WORKER"`):

```
POST /api/v1/auth/send-otp    { "phone": "9876543211", "role": "WORKER" }
POST /api/v1/auth/verify-otp  { "phone": "9876543211", "code": "1234", "role": "WORKER", "name": "Raj Kumar" }
```

On registration, a **14-day free trial** is automatically applied to the worker's subscription.

**Submit KYC Documents**

```
PATCH /api/v1/workers/me/kyc
Authorization: Bearer <token>
Content-Type: multipart/form-data

Fields:
  - document: <file> (Aadhar, PAN, License, or Other)
```

- KYC status starts as `PENDING`
- Admin reviews and approves/rejects via admin panel
- Worker cannot go online until KYC is `APPROVED`

**Remove KYC Document**

```
DELETE /api/v1/workers/me/kyc/:docIndex
Authorization: Bearer <token>
```

### 3.2 Profile Setup

**Update Services**

```
PATCH /api/v1/workers/me/services
Authorization: Bearer <token>
Content-Type: application/json

{
  "services": [
    {
      "category": "<categoryId>",
      "categoryName": "AC Repair",
      "subcategories": ["AC Servicing", "AC Installation"],
      "isActive": true
    }
  ]
}
```

**Update Bank Details**

```
PATCH /api/v1/workers/me/bank
Authorization: Bearer <token>
Content-Type: application/json

{
  "bankDetails": {
    "accountNumber": "1234567890",
    "ifscCode": "SBIN0001234",
    "bankName": "State Bank of India"
  },
  "upiId": "worker@upi"
}
```

**Update Location**

```
PATCH /api/v1/workers/me/location
Authorization: Bearer <token>
Content-Type: application/json

{
  "activeLocation": {
    "type": "Point",
    "coordinates": [72.8777, 19.0760]
  },
  "addressDetails": {
    "city": "Mumbai",
    "pincode": "400053",
    "area": "Andheri"
  }
}
```

**Full Profile Update**

```
PUT /api/v1/workers/me/profile
Authorization: Bearer <token>
Content-Type: multipart/form-data

Fields:
  - name, email, city, bio, serviceRadius
  - profileImage: <file>
```

### 3.3 Going Online

**Toggle Online Status**

```
PATCH /api/v1/workers/me/online
Authorization: Bearer <token>
Content-Type: application/json

{
  "isOnline": true
}
```

**Eligibility checks before going online** (enforced in controller):
1. `isVerified` must be `true`
2. KYC status must be `APPROVED`
3. Subscription must be active (not expired)
4. Wallet balance >= minimum threshold (configurable in settings)

If any check fails, the worker stays offline and receives an error message.

### 3.4 Receiving Job Alerts

Workers receive real-time job alerts via Socket.IO:

```
Event: NEW_JOB_ALERT
Room: worker_{workerId}
Payload: {
  jobId, category, subcategory, description,
  location, addressDetails, timeSlot, preferredDate,
  notifiedWorkers, customer: { _id, name, profileImage }
}
```

The worker's mobile app listens for this event and displays the job card with an option to place a quote.

### 3.5 Placing Quotes

```
POST /api/v1/quotes
Authorization: Bearer <token>
Content-Type: application/json

{
  "jobId": "<jobId>",
  "amount": 500,
  "description": "I can service your AC within 2 hours",
  "timeToReach": "25 mins",
  "workerLocation": {
    "type": "Point",
    "coordinates": [72.8777, 19.0760]
  }
}
```

- One quote per worker per job (enforced by unique compound index)
- Only `PENDING` or `ACCEPTED` quotes are counted for uniqueness
- Customer receives `QUOTE_RECEIVED` notification

**View Worker's Own Quotes**

```
GET /api/v1/quotes/worker
Authorization: Bearer <token>
```

**Withdraw Quote**

```
PATCH /api/v1/quotes/:quoteId/withdraw
Authorization: Bearer <token>
```

### 3.6 Job Assignment (Quote Accepted)

When a customer accepts a worker's quote:
1. Worker receives `QUOTE_ACCEPTED` event
2. Job status → `ALLOCATED`
3. Security OTPs are generated (arrival + completion)
4. Worker assignment is cached in Redis: `job:{jobId}:assigned_worker`

### 3.7 Navigation to Job Site

Worker uses the job location coordinates to navigate. The mobile app integrates `react-native-maps` for navigation.

### 3.8 Starting Job (Arrival OTP + GPS Verification)

```
POST /api/v1/jobs/:jobId/start
Authorization: Bearer <token>
Content-Type: application/json

{
  "arrivalOtp": "1234",
  "location": {
    "type": "Point",
    "coordinates": [72.8778, 19.0761]
  }
}
```

**Verification**:
1. OTP matches `security.arrivalOtp`
2. GPS coordinates are within **200m** of the job location (Haversine distance check)
3. Job status → `IN_PROGRESS`
4. Real-time location tracking begins

### 3.9 Completing Job

```
POST /api/v1/jobs/:jobId/complete
Authorization: Bearer <token>
Content-Type: multipart/form-data

Fields:
  - completionOtp: "5678"
  - report: "AC serviced, filter cleaned, gas topped up, all working"
  - media: <file(s)>
```

- Completion OTP verified
- Media uploaded to Cloudinary
- Job status → `COMPLETED`
- Customer receives completion notification

**Report Partial Payment** (dispute mechanism):

```
POST /api/v1/jobs/:jobId/report-partial-payment
Authorization: Bearer <token>
Content-Type: application/json

{
  "amountReceived": 400,
  "shortAmount": 100,
  "reason": "Customer only paid partial amount"
}
```

- Creates a dispute record
- Job status → `DISPUTED`
- Admin investigates and resolves

### 3.10 Earnings Tracking and Withdrawal

**View Earnings Summary**

```
GET /api/v1/workers/earnings/summary
Authorization: Bearer <token>
```

**View Earnings Chart**

```
GET /api/v1/workers/earnings/chart
Authorization: Bearer <token>
```

**View Transaction History**

```
GET /api/v1/workers/earnings/transactions
Authorization: Bearer <token>
```

**Request Withdrawal**

```
POST /api/v1/workers/earnings/withdraw
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 2000,
  "paymentMethod": "UPI",
  "paymentDetails": "worker@upi"
}
```

- Creates a `Payout` record with status `PENDING`
- Admin reviews and approves/transfers
- On approval: wallet balance deducted, payout status → `TRANSFERRED`

**Worker Stats**

```
GET /api/v1/workers/me/stats
Authorization: Bearer <token>
```

Returns total jobs, completion rate, earnings, average rating, etc.

---

## 4. Shop Complete Flow

### 4.1 Registration and Shop Creation

**Register via OTP** (same flow, `role: "SHOP"`):

```
POST /api/v1/auth/send-otp    { "phone": "9876543212", "role": "SHOP" }
POST /api/v1/auth/verify-otp  { "phone": "9876543212", "code": "1234", "role": "SHOP", "name": "Quick Mart" }
```

**Create Shop**

```
POST /api/v1/shops
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Quick Mart",
  "category": "Grocery",
  "description": "Fresh groceries delivered to your doorstep",
  "address": "456 Market Road, Mumbai",
  "location": {
    "type": "Point",
    "coordinates": [72.8777, 19.0760]
  },
  "businessHours": {
    "monFri": "9 AM - 10 PM",
    "sat": "9 AM - 10 PM",
    "sun": "10 AM - 8 PM"
  },
  "delivery": {
    "radiusKm": 3,
    "fee": 40,
    "freeAbove": 1000
  }
}
```

- One shop per owner (unique `ownerId`)
- KYC status starts as `PENDING`
- 14-day free trial applied on registration

### 4.2 KYC Approval

- Shop owner uploads KYC documents
- Admin reviews via admin panel (`/api/v1/admin/shops/:id/kyc`)
- KYC status transitions: `PENDING` → `APPROVED` or `REJECTED`
- Shop can only receive orders when KYC is `APPROVED`

### 4.3 Product Management

**Add Product**

```
POST /api/v1/products
Authorization: Bearer <token>
Content-Type: multipart/form-data

Fields:
  - name: "Fresh Tomatoes"
  - price: 40
  - category: "Vegetables"
  - brand: "Local Farm"
  - unit: "kg"
  - description: "Fresh organic tomatoes"
  - stock: 100
  - minQty: 1
  - image: <file>
  - attributes: [{"name": "Organic", "value": "Yes"}]
```

**View Shop Products**

```
GET /api/v1/products/shop
Authorization: Bearer <token>
```

**Update Product**

```
PATCH /api/v1/products/:productId
Authorization: Bearer <token>
Content-Type: multipart/form-data

Fields: (same as create, all optional)
```

**Delete Product**

```
DELETE /api/v1/products/:productId
Authorization: Bearer <token>
```

**View Single Product**

```
GET /api/v1/products/:productId
Authorization: Bearer <token>
```

### 4.4 Receiving Orders

**View Shop Orders**

```
GET /api/v1/shoporders/shop
Authorization: Bearer <token>
```

**Real-time Alerts**: Shop receives `ORDER_STATUS` socket events when new orders arrive.

### 4.5 Order Fulfillment

**Update Order Status**

```
PATCH /api/v1/shoporders/:orderId/status
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "CONFIRMED",
  "shopNote": "Order confirmed, will be ready in 30 mins"
}
```

**Status Flow**:
1. `NEW` → Shop receives alert
2. `CONFIRMED` → Shop accepts
3. `PACKING` → Shop is preparing
4. `OUT_FOR_DELIVERY` → Delivery staff dispatched
5. `DELIVERED` → Handed to customer

**Delivery OTP**: Generated when order status changes to `OUT_FOR_DELIVERY`. Customer must share this OTP with delivery staff to confirm handover.

**Cancel Order** (Shop only):

```
PATCH /api/v1/shoporders/:orderId/status
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "CANCELLED",
  "shopNote": "Out of stock"
}
```

### 4.6 Wallet and Settlement Management

**View Wallet Balance**

```
GET /api/v1/wallet/balance
Authorization: Bearer <token>
```

**Request Withdrawal**

```
POST /api/v1/shops/my/withdraw
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 5000,
  "method": "UPI",
  "details": "shop@upi"
}
```

**Add Payout Method**

```
POST /api/v1/shops/my/payout-methods
Authorization: Bearer <token>
Content-Type: application/json

{
  "type": "UPI",
  "label": "GPay",
  "detail": "shop@upi",
  "isPrimary": true
}
```

**Settlements**: Platform settles shop earnings periodically. Settlements track `totalAmount`, `platformCommission`, and `shopEarning`.

### 4.7 Delivery Staff Management

**View Staff**

```
GET /api/v1/delivery-staff
Authorization: Bearer <token>
```

**Add Staff**

```
POST /api/v1/delivery-staff
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Delivery Boy 1",
  "phone": "9876543213"
}
```

**Update Staff**

```
PATCH /api/v1/delivery-staff/:staffId
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Name"
}
```

**Remove Staff**

```
DELETE /api/v1/delivery-staff/:staffId
Authorization: Bearer <token>
```

---

## 5. Admin Complete Flow

### 5.1 Dashboard

**Get Dashboard Stats**

```
GET /api/v1/admin/stats
Authorization: Bearer <token>
```

Returns real-time aggregated statistics:
- Total revenue, active jobs, pending payouts
- User counts by role, new registrations
- Revenue by period (week, month, quarter, year)
- Top workers, top categories
- Cached in Redis, auto-invalidated on entity changes

**Get Badge Counts**

```
GET /api/v1/admin/badges
Authorization: Bearer <token>
```

Returns pending items: pending KYC, pending payouts, active disputes, etc.

**Get Platform Health**

```
GET /api/v1/admin/health
Authorization: Bearer <token>
```

Returns system health indicators.

**Get Ledger**

```
GET /api/v1/admin/ledger
Authorization: Bearer <token>
```

Returns financial ledger with date range filtering.

**Real-time Updates**: Admin panel connects via Socket.IO to `admin_dashboard` room and receives `DASHBOARD_UPDATE` events when data changes.

### 5.2 User Management

**List Customers**

```
GET /api/v1/admin/customers?page=1&limit=20&search=Mumbai
Authorization: Bearer <token>
```

**Export Customers**

```
GET /api/v1/admin/customers/export
Authorization: Bearer <token>
```

**Get Customer Detail**

```
GET /api/v1/admin/customers/:id
Authorization: Bearer <token>
```

**Get Customer Jobs**

```
GET /api/v1/admin/customers/:id/jobs
Authorization: Bearer <token>
```

**Get Customer Orders**

```
GET /api/v1/admin/customers/:id/orders
Authorization: Bearer <token>
```

**Create User (Admin creates account)**

```
POST /api/v1/admin/users
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "New Worker",
  "phone": "9876543214",
  "role": "WORKER",
  "email": "worker@example.com"
}
```

**Update User**

```
PATCH /api/v1/admin/users/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Name",
  "email": "updated@example.com"
}
```

**Toggle User Status** (enable/disable):

```
PATCH /api/v1/admin/users/:id/toggle-status
Authorization: Bearer <token>
```

**Delete User**:

```
DELETE /api/v1/admin/users/:id
Authorization: Bearer <token>
```

**Impersonate User** (login as another user):

```
POST /api/v1/admin/users/:id/impersonate
Authorization: Bearer <token>
```

Returns a JWT for the impersonated user.

### 5.3 Worker Management

**List Workers**

```
GET /api/v1/admin/workers?page=1&limit=20&search=Mumbai
Authorization: Bearer <token>
```

**Export Workers**

```
GET /api/v1/admin/workers/export
Authorization: Bearer <token>
```

**Get Worker Detail**

```
GET /api/v1/admin/workers/:id
Authorization: Bearer <token>
```

**Review KYC**

```
PATCH /api/v1/admin/workers/:id/kyc
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "APPROVED",
  "note": "Documents verified"
}
```

**Add KYC Document**

```
POST /api/v1/admin/workers/:id/kyc-documents
Authorization: Bearer <token>
Content-Type: multipart/form-data

Fields:
  - document: <file>
```

**Remove KYC Document**

```
DELETE /api/v1/admin/workers/:id/kyc-documents/:docIndex
Authorization: Bearer <token>
```

### 5.4 Pending KYC Queue

```
GET /api/v1/admin/pending-kyc
Authorization: Bearer <token>
```

Returns all users (workers + shops) with `kyc.status === "PENDING"`.

### 5.5 Job Management

**List All Jobs**

```
GET /api/v1/admin/jobs?page=1&limit=20&status=IN_PROGRESS
Authorization: Bearer <token>
```

**Get Job Detail**

```
GET /api/v1/admin/jobs/:id
Authorization: Bearer <token>
```

**Export Jobs**

```
GET /api/v1/admin/jobs/export
Authorization: Bearer <token>
```

**Cancel Job**

```
PATCH /api/v1/jobs/:id/cancel
Authorization: Bearer <token>
```

- Available to both Admin and Customer
- Only for jobs not yet `IN_PROGRESS`

**Reassign Worker**

```
PATCH /api/v1/jobs/:id/reassign
Authorization: Bearer <token>
Content-Type: application/json

{
  "workerId": "<newWorkerId>"
}
```

**Admin Create Job** (for a customer):

```
POST /api/v1/admin/customers/:customerId/jobs
Authorization: Bearer <token>
Content-Type: application/json

{
  "category": "Plumbing",
  "description": "Leaky faucet repair",
  "location": { "type": "Point", "coordinates": [72.8777, 19.0760] }
}
```

**Admin Update Job Details**:

```
PATCH /api/v1/admin/jobs/:jobId/details
Authorization: Bearer <token>
Content-Type: application/json

{
  "category": "Plumbing",
  "description": "Updated description"
}
```

**Resolve Dispute**

```
PATCH /api/v1/jobs/:id/resolve-dispute
Authorization: Bearer <token>
Content-Type: application/json

{
  "resolution": "REFUND_CUSTOMER",
  "adminNote": "Customer was overcharged"
}
```

### 5.6 Shop Order Management

**List All Shop Orders**

```
GET /api/v1/shoporders/all?page=1&limit=20&status=NEW
Authorization: Bearer <token>
```

**Update Order Status** (admin override):

```
PATCH /api/v1/shoporders/:id/status
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "CANCELLED",
  "shopNote": "Cancelled by admin due to dispute"
}
```

**Create Order for Customer** (admin):

```
POST /api/v1/admin/customers/:customerId/orders
Authorization: Bearer <token>
Content-Type: application/json

{
  "shopId": "<shopId>",
  "items": [{ "productId": "<id>", "qty": 2 }],
  "paymentMethod": "WALLET"
}
```

### 5.7 Financial Management

**Admin Wallet**

```
GET  /api/v1/admin/admin-wallet/balance          — View balance
GET  /api/v1/admin/admin-wallet/transactions      — Transaction history
POST /api/v1/admin/admin-wallet/credit            — Credit admin wallet
POST /api/v1/admin/admin-wallet/debit             — Debit admin wallet
PATCH /api/v1/admin/admin-wallet/bank-details     — Update bank details
POST /api/v1/admin/admin-wallet/razorpay-order    — Create Razorpay order (add funds)
POST /api/v1/admin/admin-wallet/razorpay-verify   — Verify Razorpay payment
```

**Payouts**

```
GET /api/v1/payouts                          — List all payouts
PATCH /api/v1/payouts/:id/status             — Approve/reject payout
```

**Settlements**

```
GET /api/v1/settlements                      — List settlements
GET /api/v1/settlements/pending              — Pending settlements
POST /api/v1/settlements/:id/settle          — Settle a single record
POST /api/v1/settlements/bulk-settle         — Bulk settle multiple records
```

**Global Wallet Operations**

```
GET  /api/v1/wallet/balance                  — Any user's own wallet
GET  /api/v1/wallet/transactions             — Admin: all transactions
POST /api/v1/wallet/adjust                   — Admin: manual wallet adjustment
POST /api/v1/wallet/topup                    — Top up via Razorpay
POST /api/v1/wallet/withdraw                 — Request withdrawal
```

**Export Payments**

```
GET /api/v1/admin/payments/export
Authorization: Bearer <token>
```

### 5.8 Dispute Resolution

**List Disputes**

```
GET /api/v1/admin/disputes
Authorization: Bearer <token>
```

**Update Dispute Status**

```
PATCH /api/v1/admin/disputes/:id/status
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "resolved",
  "resolutionNotes": "Refunded customer in full"
}
```

**Dispute statuses**: `open` → `in_review` → `resolved` | `refunded` | `dismissed`

### 5.9 Settings and Configuration

**Get Settings**

```
GET /api/v1/settings
Authorization: Bearer <token> (ADMIN only)
```

**Update Settings**

```
PATCH /api/v1/settings
Authorization: Bearer <token> (ADMIN only)
Content-Type: application/json

{
  "fees": { "type": "flat", "amount": 50, "gstPercentage": 18 },
  "wallet": { "minimumBalance": 100, "topupPresets": [50, 100, 200, 500] },
  "subscription": { "freeTrialDays": 14 },
  "radius": { "maxKm": 15 },
  "maintenance": { "mode": false, "message": "..." },
  "branding": { "appName": "Kwickly", "logoUrl": "..." },
  "subscriptionPlans": [
    { "id": "basic", "label": "Basic", "price": 199, "durationDays": 30, "features": ["..."], "isActive": true, "targetRole": "WORKER" }
  ]
}
```

**Get Public Settings** (no auth):

```
GET /api/v1/settings/public
```

**Get Branding** (no auth):

```
GET /api/v1/admin/settings/branding
```

### 5.10 Promotions

**Banners**

```
GET    /api/v1/promotions/banners              — Public: active banners
GET    /api/v1/promotions/banners/all          — Admin: all banners
POST   /api/v1/promotions/banners              — Create banner
PATCH  /api/v1/promotions/banners/:id          — Update banner
DELETE /api/v1/promotions/banners/:id          — Delete banner
```

Banner positions: `HOME_TOP`, `HOME_MIDDLE`, `SHOP_PAGE`, `CATEGORY_PAGE`
Link types: `SHOP`, `PRODUCT`, `CATEGORY`, `EXTERNAL`, `NONE`

**Promo Codes**

```
POST   /api/v1/promotions/validate             — Validate promo code
GET    /api/v1/promotions/promotions           — Admin: all promotions
POST   /api/v1/promotions/promotions           — Create promotion
PATCH  /api/v1/promotions/promotions/:id       — Update promotion
DELETE /api/v1/promotions/promotions/:id       — Delete promotion
```

Promotion types: `FLAT_DISCOUNT`, `PERCENTAGE_DISCOUNT`, `FREE_DELIVERY`, `FIRST_ORDER`, `CASHBACK`

### 5.11 Reports and Analytics

```
GET /api/v1/admin/reports/...                  — Various report endpoints
```

Report endpoints are defined in `reports.routes.js` and `reports.controller.js`.

### 5.12 Support Chat

**View Support Threads**

```
GET /api/v1/chat/support/threads
Authorization: Bearer <token> (ADMIN only)
```

**Chat History**

```
GET /api/v1/chat/history?userId=<userId>&jobId=<jobId>
Authorization: Bearer <token>
```

**Send Message**

```
POST /api/v1/chat/send
Authorization: Bearer <token>
Content-Type: application/json

{
  "receiverId": "<userId>",
  "jobId": "<jobId>",
  "text": "How can I help you?",
  "mediaUrl": null
}
```

**Mark as Read**

```
POST /api/v1/chat/mark-read
Authorization: Bearer <token>
Content-Type: application/json

{
  "senderId": "<senderId>"
}
```

### 5.13 Category Management

**List Categories** (public):

```
GET /api/v1/categories
```

**Admin CRUD**:

```
POST   /api/v1/categories                    — Create category
PATCH  /api/v1/categories/:id                — Update category
DELETE /api/v1/categories/:id                — Delete category
POST   /api/v1/categories/:id/subcategories  — Add subcategory
PATCH  /api/v1/categories/:id/subcategories/:subId — Update subcategory
DELETE /api/v1/categories/:id/subcategories/:subId — Delete subcategory
```

### 5.14 Notifications

**Admin**

```
GET    /api/v1/notifications                 — Admin: all notifications
GET    /api/v1/notifications/activity-logs   — Admin activity logs
POST   /api/v1/notifications/broadcast       — Send broadcast notification
```

**User**

```
GET    /api/v1/notifications/my              — User's notifications
GET    /api/v1/notifications/unread-count    — Unread count
PATCH  /api/v1/notifications/read-all        — Mark all as read
PATCH  /api/v1/notifications/:id/read        — Mark one as read
DELETE /api/v1/notifications/:id             — Delete notification
```

### 5.15 Subscriptions

**Get Available Plans** (public):

```
GET /api/v1/subscriptions/plans
```

**Subscribe** (Worker/Shop):

```
POST /api/v1/subscriptions/subscribe
Authorization: Bearer <token>
Content-Type: application/json

{
  "planId": "basic",
  "paymentMethod": "RAZORPAY"
}
```

**View Own Subscriptions**:

```
GET /api/v1/subscriptions/my
Authorization: Bearer <token>
```

**Admin: All Subscriptions**:

```
GET /api/v1/subscriptions/all
Authorization: Bearer <token> (ADMIN)
```

### 5.16 Suggestions

**Submit Category Suggestion** (Worker/Customer):

```
POST /api/v1/customers/category-suggestions
Authorization: Bearer <token>
Content-Type: application/json

{
  "type": "new_category",
  "payload": {
    "name": "Pest Control",
    "description": "Professional pest control services",
    "suggestedSubcategories": ["Termite", "Cockroach", "Rodent"]
  }
}
```

**Admin: Process Suggestions**:

```
GET    /api/v1/admin/suggestions
PATCH  /api/v1/admin/suggestions/:id/approve
PATCH  /api/v1/admin/suggestions/:id/reject
```

---

## 6. Real-Time Infrastructure

### 6.1 Socket.IO Architecture

**Initialization** (`socket.helper.js`):
- Socket.IO server created with CORS whitelist
- Redis Pub/Sub adapter enabled for horizontal scaling (`@socket.io/redis-adapter`)
- JWT authentication middleware on every connection
- Performance tuned: `pingTimeout: 20000`, `pingInterval: 25000`

**Room Naming Conventions** (`sockets/index.js`):

| Room Pattern | Purpose | Who Joins |
|-------------|---------|-----------|
| `customer_{userId}` | Customer's real-time feed | Auto-joined on connection |
| `worker_{userId}` | Worker's real-time feed | Auto-joined on connection |
| `shop_{shopId}` | Shop's order feed | Auto-joined on connection |
| `job_{jobId}` | All bidders on a job | Manual via `JOIN_JOB_ROOM` |
| `admin_dashboard` | Admin panel live stats | Auto-joined on connection |

**Key Socket Events**:

| Event | Direction | Purpose |
|-------|-----------|---------|
| `NEW_JOB_ALERT` | Server → Worker | New job available for bidding |
| `QUOTE_RECEIVED` | Server → Customer | Worker placed a quote |
| `QUOTE_ACCEPTED` | Server → Worker | Customer accepted quote |
| `QUOTE_REJECTED` | Server → Worker | Customer rejected quote |
| `JOB_STATUS_CHANGED` | Server → Customer/Worker | Job status updated |
| `JOB_RADIUS_EXPANDED` | Server → Customer | Broadcast radius expanded |
| `ORDER_STATUS` | Server → Customer/Shop | Shop order status updated |
| `WORKER_LOCATION` | Server → Customer | Worker's live location |
| `FORCED_OFFLINE` | Server → Worker/Shop | Subscription expired |
| `DASHBOARD_UPDATE` | Server → Admin | Dashboard needs refresh |
| `SEND_MESSAGE` | Client → Server | In-app chat message |
| `NEW_MESSAGE` | Server → Client | Chat message received |
| `ERROR` | Server → Client | Authentication error |

**Security Features**:
- JWT auth on connection (`socket.helper.js:43-72`)
- Token blacklist check in Redis
- Worker location updates verified against Redis assignment cache (anti-spoofing)
- Chat messages validated against socket's `userId` (prevents identity spoofing)

### 6.2 Redis Caching Strategy

**Session Cache**:
- Key: `session:{userId}`
- TTL: 24 hours (86400 seconds)
- Contents: Full user object (minus password)
- Populated on first request after cache miss, used on every subsequent request

**Token Blacklist**:
- Key: `blacklist:{token}`
- Set on logout
- Checked on every auth request

**Dashboard Stats Cache**:
- Key: `admin_dashboard_stats_{range}` (week/month/quarter/year/all)
- Auto-invalidated when critical entities change (jobs, users, etc.)

**Shop List Cache**:
- Pattern: `*shops_list*`
- Cleared on Shop model save/update/delete

**Job Assignment Cache**:
- Key: `job:{jobId}:assigned_worker`
- Used for real-time location verification

**Cache Stampede Prevention**:
- `fetchWithCache()` uses distributed locks (`lock:{key}`) with 10s TTL
- Prevents thundering herd on cache miss

**Distributed Locks**:
- Used by cron engine for multi-instance safety
- Keys: `cron:broadcast_sweep`, `cron:job_sweep`, `cron:order_sweep`, `cron:worker_sweep`
- TTL matches the cron interval + buffer

### 6.3 Push Notifications

**Triple-Redundancy Strategy**:

1. **Database (Persistent)**: Every notification saved to `Notification` collection → populates in-app bell icon
2. **WebSocket (In-App)**: If user has app open, event emitted to their personal room → sub-second UI updates
3. **FCM (Push)**: If user is offline/backgrounded, payload sent to Firebase Cloud Messaging → device banner alert

**Notification Types**:
- `BROADCAST` — Platform-wide announcements
- `DIRECT` — User-specific alerts
- `SYSTEM` — System-generated (subscription expiry, etc.)
- `ADMIN_ACTIVITY` — Admin action logs

**Notification Actions**: `CREATE`, `UPDATE`, `DELETE`, `KYC`, `PAYOUT`, `WALLET_CREDIT`, `JOB_CREATED`, `QUOTE_RECEIVED`, `ORDER_PLACED`, etc.

---

## 7. Background Processing

### 7.1 Cron Jobs

**Cron Engine** (`workers/cronEngine.js`) — runs in-process using `node-cron`:

| Cron Schedule | Lock Key | Purpose |
|---------------|----------|---------|
| `* * * * *` (every minute) | `cron:broadcast_sweep` | Progressive job broadcasting |
| `* * * * *` (every minute) | `cron:job_sweep` | Ghost quote cleanup |
| `*/5 * * * *` (every 5 min) | `cron:order_sweep` | Shop order ghost cleanup |
| `*/10 * * * *` (every 10 min) | `cron:worker_sweep` | Expired subscription cleanup |

**Subscription Cron** (`cron/subscription.cron.js`):

| Cron Schedule | Purpose |
|---------------|---------|
| `0 0 * * *` (daily midnight) | Check expiring/expired subscriptions |

### 7.2 Progressive Job Broadcasting

When a job is created in `BROADCASTING` status, the cron engine expands the search radius:

| Round | Radius | Action |
|-------|--------|--------|
| 1 | 15 km (configurable) | Initial broadcast to nearby workers |
| 2 | 30 km | Expand and re-broadcast |
| 3 | 45 km | Final expansion |
| 4+ | Cancel | Auto-cancel if no workers found |

**Special case**: Scheduled future jobs don't auto-cancel; next broadcast is delayed by 30 minutes.

### 7.3 Ghost Cleanup with Refunds

**Ghost Quotes** (every minute):
- Jobs stuck in `QUOTES_RECEIVED` for >2 hours → auto-cancelled
- Exception: Scheduled future jobs are preserved

**Ghost Shop Orders** (every 5 minutes):
- Orders stuck in `NEW` status for >30 minutes → auto-cancelled
- If order was paid online → automatic wallet refund to customer
- Customer receives `ORDER_STATUS` cancellation event
- Shop receives `ORDER_STATUS` cancellation event

**Expired Subscriptions** (every 10 minutes):
- Workers/Shops with expired subscriptions that are still online → forced offline
- `FORCED_OFFLINE` event emitted with reason

---

## 8. Payment System

### 8.1 Wallet Architecture

The platform uses a **multi-wallet architecture**:

| Wallet | Owner | Purpose |
|--------|-------|---------|
| **Customer Wallet** | Customer | Pay for jobs/orders, receive refunds |
| **Worker Wallet** | Worker | Earn from jobs, pay platform fees, withdraw |
| **Shop Wallet** | Shop | Earn from orders, pay commission, withdraw |
| **Admin Wallet** | Platform | Collect platform fees, process payouts |

**Wallet Transaction Types** (`WalletTxn` model):

| Type | Description |
|------|-------------|
| `JOB_CREDIT` | Worker earns from a job |
| `JOB_DEBIT` | Commission deducted from worker |
| `SUBSCRIPTION` | Plan purchase |
| `WITHDRAWAL` | Payout to bank/UPI |
| `REFUND` | Customer/shop refund |
| `ORDER_CREDIT` | Shop earns from order |
| `ORDER_DEBIT` | Platform commission from shop |
| `REFERRAL_BONUS` | Referral reward |
| `ADJUSTMENT` | Admin manual adjustment |
| `TOPUP` | Wallet top-up via payment gateway |
| `ORDER_PAYMENT` | Customer paying for an order |

### 8.2 Razorpay Integration

**Order Creation Flow**:

```
1. Backend calls Razorpay API: rp.orders.create({ amount, currency: 'INR', receipt, notes })
2. Returns: { id, amount, currency, status }
3. Frontend opens checkout: RazorpayCheckout.open({ key, amount, order_id, ... })
4. Customer completes payment on Razorpay UI
5. Frontend receives: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
6. Frontend calls: POST /api/v1/payments/verify
```

**Payment Verification** (`razorpay.helper.js`):

```javascript
// HMAC signature verification
const body = orderId + '|' + paymentId;
const expectedSignature = crypto.createHmac('sha256', keySecret).update(body).digest('hex');
// Uses timing-safe comparison to prevent timing attacks
crypto.timingSafeEqual(expectedBuf, actualBuf);
```

**Webhook Handling** (`POST /api/v1/payments/webhook`):
- No auth (public endpoint)
- Receives Razorpay events: `payment.captured`, `payment.failed`, `refund.created`
- Updates `Payment` model status
- Idempotent via `webhookEventId` tracking

### 8.3 Transaction Types and Flows

**Job Payment Flow**:
```
Customer pays ₹600
├── Worker Payout: ₹500 (quoted amount)
├── Platform Fee: ₹50 (flat fee from settings)
└── GST on Platform Fee: ₹9 (18% of ₹50)
    Total: ₹600 ✓
```

**Cash Payment**:
```
1. Customer hands ₹500 cash to worker
2. Backend deducts platform fee + GST from worker wallet
3. Worker wallet: balance -= ₹59 (platform fee + GST)
4. Job payment status → PAID
5. Worker's wallet transaction: JOB_DEBIT
```

**Online Payment**:
```
1. Customer pays ₹600 via Razorpay
2. Payment captured by Razorpay
3. Backend credits worker wallet: ₹500
4. Backend credits admin wallet: ₹59 (platform fee + GST)
5. Job payment status → PAID
6. Worker wallet transaction: JOB_CREDIT
7. Admin wallet transaction: PLATFORM_FEE_COLLECTED
```

### 8.4 Subscription Payments

**Worker/Shop Subscription**:
```
1. User selects plan → POST /api/v1/subscriptions/subscribe
2. Backend creates Razorpay order for subscription amount
3. User completes payment
4. Backend verifies payment, creates WorkerSubscription/ShopSubscription record
5. User's subscription.expiryDate updated
6. User wallet transaction: SUBSCRIPTION
```

---

## 9. Security

### 9.1 Authentication (JWT + Redis Session Cache)

**Login Flow**:
1. Phone + OTP → Backend verifies OTP against Redis cache
2. Backend issues 30-day JWT with `{ id, role }` payload
3. Backend caches user session in Redis (key: `session:{userId}`, TTL: 24h)
4. Client stores JWT in AsyncStorage (React Native) or localStorage (Admin)

**Request Authentication** (`auth.middleware.js`):
1. Extract `Bearer` token from `Authorization` header
2. Verify JWT signature using `JWT_SECRET`
3. Check token blacklist in Redis (set on logout)
4. Load user from Redis session cache (cache miss → DB fallback)
5. Check `isDeleted` flag
6. Attach `req.user` with full user object

**Logout**:
```
POST /api/v1/auth/logout
Authorization: Bearer <token>
```
- Adds token to Redis blacklist
- Removes session cache

### 9.2 Authorization (RBAC)

**Role Middleware** (`role.middleware.js`):

```javascript
router.use(authMiddleware);
router.use(authorize('ADMIN', 'SHOP'));  // Only ADMIN and SHOP can access
```

**Four roles**: `ADMIN`, `CUSTOMER`, `WORKER`, `SHOP`

**Route-level enforcement**: Each route specifies allowed roles:
```javascript
router.post('/', authorize('CUSTOMER'), jobController.createJob);
router.get('/all', authorize('ADMIN'), jobController.getJobs);
router.patch('/:id/status', authorize('SHOP', 'ADMIN'), ctrl.updateOrderStatus);
```

### 9.3 Rate Limiting

**Three tiers** (`rateLimit.middleware.js`):

| Limiter | Window | Max Requests | Applied To |
|---------|--------|-------------|------------|
| `globalLimiter` | 15 min | 1000 | All `/api/` routes |
| `authLimiter` | 15 min | 5 (prod) / 500 (dev) | Login, verify, check-status |
| `otpSendLimiter` | 10 min | 3 (prod) / 300 (dev) | OTP send, forgot password |

**Storage**: Redis-backed via `rate-limit-redis` (supports multi-instance deployments)

### 9.4 Input Validation (Joi + Sanitize)

**Validation Middleware** (`validate.middleware.js`):
- Every request body/query/params validated against Joi schemas
- Schemas defined in `validators/` directory
- Returns structured error messages on failure

**Sanitization** (`sanitize.middleware.js`):
- Custom NoSQL injection prevention
- Strips `$` and `.` from request bodies (mongo operator injection)

### 9.5 Socket Security

**Connection Auth** (`socket.helper.js:43-72`):
1. Extract JWT from `handshake.auth.token` or `Authorization` header
2. Verify JWT signature
3. Check token blacklist in Redis
4. Set `socket.isAuthenticated`, `socket.userId`, `socket.userRole`

**Event-level Guards** (`sockets/index.js`):
- `WORKER_LOCATION_UPDATE`: Verifies worker is assigned to the job via Redis cache
- `SEND_MESSAGE`: Validates `senderId` matches `socket.userId`
- `JOIN_JOB_ROOM`: Requires `socket.isAuthenticated`

### 9.6 Payment Security

**Razorpay Signature Verification** (`razorpay.helper.js:52-72`):
- HMAC-SHA256 signature verification
- Timing-safe comparison to prevent timing attacks
- Dev mode: verification skipped with warning (placeholder keys)

**Webhook Security**:
- Razorpay webhook is public (no auth) but uses HMAC verification
- `webhookEventId` tracking for idempotency

### 9.7 Additional Security Measures

- **Helmet**: HTTP security headers (`helmet.js`)
- **CORS**: Strict origin whitelist (`ALLOWED_ORIGINS` env var)
- **Body size limits**: 10MB max
- **Static files**: Served from `/uploads` directory
- **Graceful shutdown**: SIGTERM handler
- **Uncaught exception handling**: Process exit on uncaught exceptions
- **Environment variable validation**: Server fails fast if `JWT_SECRET` or `MONGO_URI` missing

---

## 10. Database Schema Summary

### 10.1 Core Collections

| Collection | Model File | Purpose |
|-----------|-----------|---------|
| `customers` | `customer.model.js` | All users (Customer, Worker, Shop, Admin) — single collection with `role` field |
| `jobs` | `job.model.js` | Service jobs posted by customers |
| `quotes` | `quote.model.js` | Worker bids on jobs |
| `shops` | `shop.model.js` | Shop profiles (linked to Customer via `ownerId`) |
| `products` | `product.model.js` | Shop products |
| `carts` | `cart.model.js` | Customer shopping carts (TTL-indexed) |
| `shoporders` | `shoporder.model.js` | Product orders |
| `wallettxns` | `wallet.model.js` | Wallet transaction ledger |
| `payments` | `payment.model.js` | Razorpay payment records |
| `categories` | `category.model.js` | Service categories with subcategories |
| `notifications` | `notification.model.js` | All notifications (in-app + broadcast) |
| `messages` | `message.model.js` | Chat messages |
| `disputes` | `dispute.model.js` | Job/order disputes |
| `subscriptions` | `subscription.model.js` | Worker and Shop subscription records |
| `payouts` | `payout.model.js` | Withdrawal requests |
| `settlements` | `settlement.model.js` | Platform settlement records |
| `banners` | `promotion.model.js` | Promotional banners |
| `promotions` | `promotion.model.js` | Promo codes and discounts |
| `userprousauges` | `promotion.model.js` | Promo usage tracking |
| `appsettings` | `settings.model.js` | Singleton config document |
| `admins` | `adminWallet.model.js` | Admin wallet + transactions |
| `deliverystaffs` | `deliveryStaff.model.js` | Shop delivery staff |
| `suggestions` | `suggestion.model.js` | Category suggestions from users |

### 10.2 Key Relationships

```
Customer (role=WORKER) ──owns──> Wallet balance (embedded)
Customer (role=WORKER) ──has──> services[] (ref: Category)
Customer (role=WORKER) ──has──> subscription (embedded)
Customer (role=WORKER) ──has──> kyc (embedded)
Customer (role=WORKER) ──has──> addresses[] (embedded)
Customer (role=WORKER) ──has──> activeLocation (GeoJSON)

Shop ──owned by──> Customer (ownerId ref)
Shop ──has──> payoutMethods[] (embedded)
Shop ──has──> wallet.balance (embedded)
Shop ──has──> kyc (embedded)
Shop ──has──> deliveryConfig (embedded)

Job ──belongs to──> Customer (customerId ref)
Job ──assigned to──> Customer (workerId ref)
Job ──has──> payment (embedded)
Job ──has──> security OTPs (embedded)
Job ──has──> location (GeoJSON 2dsphere)

Quote ──belongs to──> Job (jobId ref)
Quote ──placed by──> Customer (workerId ref)

Product ──belongs to──> Shop (shopId ref)

Cart ──belongs to──> Customer (customerId ref, unique)
Cart ──from──> Shop (shopId ref)
Cart ──has──> items[] (ref: Product)

ShopOrder ──belongs to──> Shop (shopId ref)
ShopOrder ──placed by──> Customer (customerId ref)
ShopOrder ──has──> items[] (ref: Product)
ShopOrder ──has──> payment (embedded)

DeliveryStaff ──belongs to──> Shop (shopId ref)

WalletTxn ──belongs to──> Customer (userId ref)
Payment ──belongs to──> Customer (userId ref)
Payout ──belongs to──> Customer (workerId ref) or Shop (shopId ref)
Settlement ──belongs to──> Shop (shopId ref)

Dispute ──linked to──> Job (jobId ref) or ShopOrder (shopOrderId ref)
```

### 10.3 Key Indexes

**Performance-critical indexes**:

```javascript
// Customer model
{ role: 1 }                                              // Role-based queries
{ 'kyc.status': 1 }                                      // KYC queue
{ isVerified: 1 }                                        // Verification checks
{ activeLocation: '2dsphere' }                           // Geospatial worker search
{ phone: 1, role: 1 }, { unique: true }                  // Unique phone+role
{ role: 1, isOnline: 1, 'kyc.status': 1, isVerified: 1 } // Worker availability
{ 'services.category': 1, role: 1, isOnline: 1, activeLocation: '2dsphere' } // Category+location search

// Job model
{ location: '2dsphere' }                                 // Job geolocation
{ customerId: 1, createdAt: -1 }                         // Customer's jobs
{ workerId: 1, createdAt: -1 }                           // Worker's jobs
{ status: 1, createdAt: -1 }                             // Status filter + broadcasting

// Quote model
{ jobId: 1, workerId: 1 }, { unique: true }              // One quote per worker per job

// Cart model
{ expiresAt: 1 }, { expireAfterSeconds: 0 }              // TTL auto-cleanup

// ShopOrder model
{ shopId: 1, status: 1, createdAt: -1 }                 // Shop dashboard filter
```

### 10.4 TTL Indexes

| Collection | Field | TTL | Purpose |
|-----------|-------|-----|---------|
| `carts` | `expiresAt` | Auto-delete when expired | Shopping cart auto-cleanup |

---

## 11. API Endpoint Reference

### 11.1 Auth Module (`/api/v1/auth`)

| Method | Endpoint | Auth | Rate Limit | Description |
|--------|----------|------|-----------|-------------|
| POST | `/send-otp` | None | `otpSendLimiter` | Send OTP to phone |
| POST | `/verify-otp` | None | `authLimiter` | Verify OTP / Register |
| POST | `/login` | None | `authLimiter` | Login with password |
| POST | `/check-status` | None | `authLimiter` | Check auth status |
| POST | `/forgot-password` | None | `otpSendLimiter` | Request password reset OTP |
| POST | `/reset-password` | None | `authLimiter` | Reset password |
| POST | `/logout` | JWT | — | Logout (blacklist token) |
| PATCH | `/set-password` | JWT | — | Set/change password |
| GET | `/me` | JWT | — | Get current user |

### 11.2 Job Module (`/api/v1/jobs`)

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/` | JWT | CUSTOMER | Create job |
| GET | `/my` | JWT | CUSTOMER | Get customer's jobs |
| POST | `/:id/pay` | JWT | CUSTOMER | Pay for job |
| POST | `/:id/rate` | JWT | CUSTOMER | Rate completed job |
| GET | `/available` | JWT | WORKER | Get available jobs |
| GET | `/worker` | JWT | WORKER | Get worker's jobs |
| POST | `/:id/start` | JWT | WORKER | Start job (arrival OTP) |
| POST | `/:id/complete` | JWT | WORKER | Complete job |
| POST | `/:id/report-partial-payment` | JWT | WORKER | Report partial payment |
| GET | `/all` | JWT | ADMIN | Get all jobs |
| GET | `/disputes` | JWT | ADMIN | Get disputed jobs |
| PATCH | `/:id/cancel` | JWT | ADMIN/CUSTOMER | Cancel job |
| PATCH | `/:id/reassign` | JWT | ADMIN | Reassign worker |
| PATCH | `/:id/resolve-dispute` | JWT | ADMIN | Resolve dispute |
| GET | `/:id/receipt` | JWT | CUSTOMER/WORKER/ADMIN | Get job receipt |

### 11.3 Customer Module (`/api/v1/customers`)

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/me/profile` | JWT | CUSTOMER | Get profile |
| PUT | `/me/profile` | JWT | CUSTOMER | Update profile |
| DELETE | `/me/account` | JWT | CUSTOMER | Delete account |
| POST | `/me/addresses` | JWT | CUSTOMER | Add address |
| PUT | `/me/addresses/:id` | JWT | CUSTOMER | Update address |
| DELETE | `/me/addresses/:id` | JWT | CUSTOMER | Delete address |
| PATCH | `/me/addresses/:id/primary` | JWT | CUSTOMER | Set primary address |
| GET | `/top-pros` | JWT | CUSTOMER | Get top workers |
| GET | `/jobs/active` | JWT | CUSTOMER | Get active job |
| GET | `/jobs/:id/receipt` | JWT | CUSTOMER | Get job receipt |
| POST | `/disputes` | JWT | CUSTOMER | Open dispute |
| PUT | `/me/notifications` | JWT | CUSTOMER | Update notification prefs |
| POST | `/me/notifications/trigger` | JWT | CUSTOMER | Trigger notification |
| GET | `/workers/:id/profile` | JWT | CUSTOMER | Browse worker profile |
| POST | `/category-suggestions` | JWT | CUSTOMER | Suggest new category |

### 11.4 Worker Module (`/api/v1/workers`)

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/me` | JWT | WORKER | Get profile |
| GET | `/me/stats` | JWT | WORKER | Get stats |
| PATCH | `/me/profile` | JWT | WORKER | Update profile image |
| PUT | `/me/profile` | JWT | WORKER | Full profile update |
| PATCH | `/me/kyc` | JWT | WORKER | Upload KYC document |
| DELETE | `/me/kyc/:docIndex` | JWT | WORKER | Remove KYC document |
| PATCH | `/me/bank` | JWT | WORKER | Update bank details |
| PATCH | `/me/services` | JWT | WORKER | Update services |
| PATCH | `/me/location` | JWT | WORKER | Update location |
| PATCH | `/me/online` | JWT | WORKER | Toggle online status |
| GET | `/earnings/summary` | JWT | WORKER | Earnings summary |
| GET | `/earnings/chart` | JWT | WORKER | Earnings chart |
| GET | `/earnings/transactions` | JWT | WORKER | Transaction history |
| POST | `/earnings/withdraw` | JWT | WORKER | Request withdrawal |
| POST | `/category-suggestions` | JWT | WORKER | Suggest category |
| GET | `/category-suggestions` | JWT | WORKER | View suggestions |
| POST | `/me/addresses` | JWT | WORKER | Add address |
| PUT | `/me/addresses/:id` | JWT | WORKER | Update address |
| DELETE | `/me/addresses/:id` | JWT | WORKER | Delete address |
| PATCH | `/me/addresses/:id/primary` | JWT | WORKER | Set primary address |

### 11.5 Shop Module (`/api/v1/shops`)

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/` | JWT | — | Create shop |
| GET | `/my` | JWT | SHOP | Get my shop |
| PATCH | `/my` | JWT | SHOP | Update my shop |
| PATCH | `/my/owner` | JWT | SHOP | Update owner name |
| POST | `/my/payout-methods` | JWT | SHOP | Add payout method |
| POST | `/my/withdraw` | JWT | SHOP | Request withdrawal |
| PATCH | `/my/payout-methods/:id/primary` | JWT | SHOP | Set primary payout |
| DELETE | `/my/payout-methods/:id` | JWT | SHOP | Delete payout method |
| DELETE | `/my` | JWT | SHOP | Delete my shop |
| GET | `/:id/delivery-config` | JWT | — | Get delivery config |
| PATCH | `/:id/delivery-config` | JWT | SHOP/ADMIN | Update delivery config |
| GET | `/` | JWT | — | Get all shops |
| PATCH | `/:id` | JWT | ADMIN | Admin update shop |
| DELETE | `/:id` | JWT | ADMIN | Admin delete shop |
| PATCH | `/:id/kyc` | JWT | ADMIN | Admin review KYC |
| PATCH | `/:id/toggle` | JWT | ADMIN | Toggle shop status |
| GET | `/:id` | JWT | — | Get shop by ID |

### 11.6 Quote Module (`/api/v1/quotes`)

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/` | JWT | WORKER | Place quote |
| GET | `/worker` | JWT | WORKER | Get worker's quotes |
| PATCH | `/:id/withdraw` | JWT | WORKER | Withdraw quote |
| GET | `/job/:jobId` | JWT | CUSTOMER | Get quotes for job |
| PATCH | `/:id/accept` | JWT | CUSTOMER | Accept quote |

### 11.7 Product Module (`/api/v1/products`)

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/` | JWT | — | Get all products |
| GET | `/shop` | JWT | — | Get shop products |
| GET | `/:id` | JWT | — | Get product by ID |
| POST | `/` | JWT | — | Create product |
| PATCH | `/:id` | JWT | — | Update product |
| DELETE | `/:id` | JWT | — | Delete product |

### 11.8 Cart Module (`/api/v1/cart`)

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/` | JWT | — | Get cart |
| POST | `/` | JWT | CUSTOMER | Add to cart |
| DELETE | `/clear` | JWT | CUSTOMER | Clear cart |
| PATCH | `/:itemId` | JWT | CUSTOMER | Update cart item |
| DELETE | `/:itemId` | JWT | CUSTOMER | Remove cart item |

### 11.9 Shop Order Module (`/api/v1/shoporders`)

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/` | JWT | CUSTOMER | Place order |
| GET | `/customer` | JWT | CUSTOMER | Customer orders |
| POST | `/:id/cancel` | JWT | CUSTOMER | Cancel order |
| GET | `/shop` | JWT | SHOP | Shop orders |
| PATCH | `/:id/status` | JWT | SHOP/ADMIN | Update order status |
| GET | `/all` | JWT | ADMIN | All orders |
| GET | `/:id` | JWT | — | Get order by ID |
| GET | `/:id/invoice` | JWT | — | Download invoice |

### 11.10 Payment Module (`/api/v1/payments`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/webhook` | None | Razorpay webhook |
| POST | `/create-order` | JWT | Create Razorpay order |
| POST | `/verify` | JWT | Verify payment |
| GET | `/history` | JWT | Payment history |
| GET | `/:orderId` | JWT | Get payment by order |
| POST | `/refund` | JWT (ADMIN) | Refund payment |

### 11.11 Wallet Module (`/api/v1/wallet`)

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/balance` | JWT | — | Get wallet balance |
| POST | `/topup` | JWT | — | Top up wallet |
| POST | `/withdraw` | JWT | — | Request withdrawal |
| GET | `/transactions` | JWT | ADMIN | All transactions |
| POST | `/adjust` | JWT | ADMIN | Manual adjustment |

### 11.12 Subscription Module (`/api/v1/subscriptions`)

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/plans` | None | — | Get available plans |
| POST | `/subscribe` | JWT | WORKER/SHOP | Subscribe to plan |
| GET | `/my` | JWT | WORKER/SHOP | My subscriptions |
| GET | `/all` | JWT | ADMIN | All subscriptions |

### 11.13 Chat Module (`/api/v1/chat`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/upload-image` | JWT | Upload chat image |
| POST | `/upload-base64` | JWT | Upload base64 image |
| GET | `/history` | JWT | Chat history |
| POST | `/send` | JWT | Send message |
| POST | `/mark-read` | JWT | Mark messages read |
| GET | `/support/threads` | JWT (ADMIN) | Support threads |

### 11.14 Notification Module (`/api/v1/notifications`)

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/` | JWT | ADMIN | All notifications |
| GET | `/activity-logs` | JWT | ADMIN | Activity logs |
| POST | `/broadcast` | JWT | ADMIN | Send broadcast |
| GET | `/my` | JWT | — | My notifications |
| GET | `/unread-count` | JWT | — | Unread count |
| PATCH | `/read-all` | JWT | — | Mark all read |
| PATCH | `/:id/read` | JWT | — | Mark one read |
| DELETE | `/:id` | JWT | — | Delete notification |

### 11.15 Admin Module (`/api/v1/admin`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/stats` | JWT (ADMIN) | Dashboard stats |
| GET | `/badges` | JWT (ADMIN) | Badge counts |
| GET | `/health` | JWT (ADMIN) | Platform health |
| GET | `/ledger` | JWT (ADMIN) | Financial ledger |
| GET | `/customers` | JWT (ADMIN) | List customers |
| GET | `/customers/export` | JWT (ADMIN) | Export customers |
| GET | `/customers/:id` | JWT (ADMIN) | Customer detail |
| GET | `/workers` | JWT (ADMIN) | List workers |
| GET | `/workers/export` | JWT (ADMIN) | Export workers |
| GET | `/workers/:id` | JWT (ADMIN) | Worker detail |
| GET | `/pending-kyc` | JWT (ADMIN) | Pending KYC queue |
| POST | `/users` | JWT (ADMIN) | Create user |
| PATCH | `/users/:id` | JWT (ADMIN) | Update user |
| PATCH | `/users/:id/toggle-status` | JWT (ADMIN) | Toggle user status |
| DELETE | `/users/:id` | JWT (ADMIN) | Delete user |
| POST | `/users/:id/impersonate` | JWT (ADMIN) | Impersonate user |
| GET | `/customers/:id/jobs` | JWT (ADMIN) | Customer jobs |
| GET | `/customers/:id/orders` | JWT (ADMIN) | Customer orders |
| POST | `/customers/:id/jobs` | JWT (ADMIN) | Admin create job |
| PATCH | `/jobs/:id/details` | JWT (ADMIN) | Admin update job |
| POST | `/customers/:id/orders` | JWT (ADMIN) | Admin create order |
| PATCH | `/workers/:id/kyc` | JWT (ADMIN) | Update KYC status |
| POST | `/workers/:id/kyc-documents` | JWT (ADMIN) | Add KYC document |
| DELETE | `/workers/:id/kyc-documents/:docIndex` | JWT (ADMIN) | Remove KYC document |
| GET | `/shops` | JWT (ADMIN) | List shops |
| GET | `/shops/:id` | JWT (ADMIN) | Shop detail |
| POST | `/shops` | JWT (ADMIN) | Admin create shop |
| PATCH | `/shops/:id` | JWT (ADMIN) | Admin update shop |
| DELETE | `/shops/:id` | JWT (ADMIN) | Delete shop |
| PATCH | `/shops/:id/kyc` | JWT (ADMIN) | Update shop KYC |
| PATCH | `/shops/:id/toggle` | JWT (ADMIN) | Toggle shop status |
| POST | `/shops/:id/wallet/credit` | JWT (ADMIN) | Credit shop wallet |
| POST | `/shops/:id/wallet/debit` | JWT (ADMIN) | Debit shop wallet |
| POST | `/shops/:id/kyc-doc` | JWT (ADMIN) | Upload shop KYC doc |
| DELETE | `/shops/:id/kyc-doc/:docIndex` | JWT (ADMIN) | Delete shop KYC doc |
| POST | `/shops/:id/payout-methods` | JWT (ADMIN) | Add shop payout method |
| PATCH | `/shops/:id/payout-methods/:methodId` | JWT (ADMIN) | Edit shop payout method |
| DELETE | `/shops/:id/payout-methods/:methodId` | JWT (ADMIN) | Delete shop payout method |
| PATCH | `/shops/:id/payout-methods/:methodId/primary` | JWT (ADMIN) | Set primary payout |
| PATCH | `/shops/:id/kyc-doc/:docIndex` | JWT (ADMIN) | Edit shop KYC doc |
| PATCH | `/shops/:id/owner` | JWT (ADMIN) | Update shop owner |
| GET | `/jobs/export` | JWT (ADMIN) | Export jobs |
| GET | `/jobs/:id` | JWT (ADMIN) | Job detail |
| GET | `/payments/export` | JWT (ADMIN) | Export payments |
| GET | `/payouts` | JWT (ADMIN) | List payouts |
| PATCH | `/payouts/:id/status` | JWT (ADMIN) | Update payout status |
| GET | `/suggestions` | JWT (ADMIN) | List suggestions |
| PATCH | `/suggestions/:id/approve` | JWT (ADMIN) | Approve suggestion |
| PATCH | `/suggestions/:id/reject` | JWT (ADMIN) | Reject suggestion |
| GET | `/disputes` | JWT (ADMIN) | List disputes |
| PATCH | `/disputes/:id/status` | JWT (ADMIN) | Update dispute status |
| POST | `/upload-image` | JWT (ADMIN) | Upload image |

### 11.16 Sub-Module Routes (mounted under `/api/v1/admin`)

| Prefix | Module | Description |
|--------|--------|-------------|
| `/admin/jobs` | Job routes | Admin job operations |
| `/admin/reports` | Reports routes | Analytics and reports |
| `/admin/categories` | Category routes | Category management |
| `/admin/notifications` | Notification routes | Notification management |
| `/admin/settings` | Settings routes | Platform settings |
| `/admin/wallet` | Wallet routes | Global wallet operations |
| `/admin/shoporders` | ShopOrder routes | Shop order management |
| `/admin/settlements` | Settlement routes | Settlement operations |
| `/admin/promotions` | Promotion routes | Banners and promo codes |

### 11.17 Other Modules

| Module | Prefix | Description |
|--------|--------|-------------|
| Category | `/api/v1/categories` | Service categories (public read) |
| Delivery Staff | `/api/v1/delivery-staff` | Shop delivery staff management |
| Promotions | `/api/v1/promotions` | Banners and promo codes |
| Payout | `/api/v1/payouts` | Payout management (admin) |
| Settlement | `/api/v1/settlements` | Settlement operations (admin) |
| Admin Wallet | `/api/v1/admin/admin-wallet` | Admin wallet operations |
| Health | `/health` | Health check (no auth) |

---

## 12. Testing

### 12.1 Test Infrastructure

**Stack**:
- **Test Runner**: Jest 30.x
- **HTTP Testing**: Supertest 7.x
- **Database**: MongoDB Memory Server 11.x (in-memory MongoDB instance)
- **Test Timeout**: 120 seconds (for MongoDB binary download)

**Test Setup** (`__tests__/testSetup.js`):

```javascript
// Mocks Redis for all tests
jest.mock('../helpers/redis.helper', () => ({
    initRedis: jest.fn(),
    getRedis: jest.fn(),
    setCache: jest.fn(),
    getCache: jest.fn(),
    delCache: jest.fn(),
    // ... more mock functions
}));

// Mocks rate limiter (pass-through)
jest.mock('../middleware/rateLimit.middleware', () => ({
    globalLimiter: (req, res, next) => next(),
    authLimiter: (req, res, next) => next(),
    otpSendLimiter: (req, res, next) => next()
}));

// Mocks Socket.IO
jest.mock('../helpers/socket.helper', () => ({
    initSocket: jest.fn(),
    getIO: jest.fn(),
    emitToAll: jest.fn(),
    emitToRoom: jest.fn(),
    triggerDashboardUpdate: jest.fn(),
    emitToUser: jest.fn()
}));

// Mocks SMS service (returns static OTP '1234')
jest.mock('../services/sms.service', () => ({
    sendOTP: jest.fn().mockResolvedValue('1234')
}));
```

**Test Helpers**:
- `setup()` — Starts MongoMemoryServer, connects Mongoose
- `teardown()` — Disconnects Mongoose, stops MongoMemoryServer
- `clearCollections()` — Clears all collections
- `generateToken(user)` — Generates JWT for test user
- `createTestUser(overrides)` — Creates a test user with defaults

### 12.2 Test Categories

| Category | File Pattern | Description |
|----------|-------------|-------------|
| **Unit Tests** | `*.test.js` | Individual module tests (auth, job, wallet, etc.) |
| **E2E Tests** | `e2e-*.test.js` | Complete user flow tests (customer, worker, shop) |
| **Integration Tests** | Various | Cross-module integration tests |

### 12.3 Test Files

| Test File | Tests | Description |
|-----------|-------|-------------|
| `auth.test.js` | Authentication | OTP, login, logout, password |
| `customer.test.js` | Customer operations | Profile, addresses, top pros |
| `customer-management.test.js` | Customer management | CRUD operations |
| `worker.test.js` | Worker operations | Profile, KYC, services, online |
| `job.test.js` | Job lifecycle | Create, start, complete, pay |
| `quote.test.js` | Quote system | Place, accept, withdraw |
| `shop.test.js` | Shop operations | CRUD, KYC, delivery config |
| `product.test.js` | Product management | CRUD operations |
| `cart.test.js` | Cart operations | Add, update, remove, clear |
| `shoporder.test.js` | Shop orders | Place, status update, cancel |
| `payment.test.js` | Payment system | Razorpay integration |
| `wallet.test.js` | Wallet operations | Balance, transactions |
| `adminWallet.test.js` | Admin wallet | Credit, debit, transactions |
| `subscription.test.js` | Subscriptions | Plans, subscribe, expiry |
| `payout.test.js` | Payouts | Request, approve, reject |
| `settlement.test.js` | Settlements | Settle, bulk settle |
| `dispute.test.js` | Disputes | Open, resolve |
| `category.test.js` | Categories | CRUD, subcategories |
| `notification.test.js` | Notifications | CRUD, broadcast |
| `chat.test.js` | Chat system | Send, history, mark read |
| `settings.test.js` | Settings | Get, update |
| `promotion.test.js` | Promotions | Banners, promo codes |
| `admin.test.js` | Admin operations | Dashboard, user management |
| `deliveryStaff.test.js` | Delivery staff | CRUD operations |
| `impersonation.test.js` | Impersonation | Admin impersonate user |
| `validation.test.js` | Validation | Joi schema validation |
| `health.test.js` | Health check | API health endpoint |
| `e2e-customer-flow.test.js` | E2E | Complete customer journey (35 steps) |
| `e2e-worker-flow.test.js` | E2E | Complete worker journey |
| `e2e-shop-flow.test.js` | E2E | Complete shop journey |
| `e2e-infrastructure.test.js` | E2E | Infrastructure tests |

### 12.4 How to Run Tests

```bash
# Navigate to backend directory
cd backend

# Run all tests
npm test

# Run tests with verbose output
npm run test:verbose

# Run specific test file
npx jest src/__tests__/auth.test.js --forceExit

# Run E2E tests only
npx jest src/__tests__/e2e-*.test.js --forceExit

# Run tests matching a pattern
npx jest --testNamePattern="Job" --forceExit
```

### 12.5 Current Test Coverage

- **Total Test Suites**: 32
- **Total Tests**: ~620
- **Test Environment**: Node.js (Jest)
- **Test Timeout**: 30 seconds per test, 120 seconds for setup
- **Database**: MongoDB Memory Server (port 27018)
- **Mocks**: Redis, Socket.IO, SMS, Rate Limiter

### 12.6 E2E Test Flow (Customer Example)

The E2E customer flow test (`e2e-customer-flow.test.js`) covers 35 sequential steps:

1. Send OTP → Verify OTP → Login
2. Update profile → Add addresses
3. Get categories → Create job
4. (Worker side) Register → Set services → Go online → Place quote
5. (Customer) View quotes → Accept quote
6. (Worker) Start job with arrival OTP → Complete job with completion OTP
7. (Customer) Pay for job → Rate worker
8. Shop flow: Create shop → Add product → Customer browse → Add to cart → Place order
9. Shop: Confirm order → Pack → Out for delivery → Delivered
10. Verify notifications, wallet transactions, and final state

---

## Appendix: Environment Variables

Key environment variables required (from `.env`):

```bash
# Required
JWT_SECRET=<your-jwt-secret>
MONGO_URI=mongodb://localhost:27017/kwickly
REDIS_URL=redis://localhost:6379

# Razorpay
RAZORPAY_KEY_ID=<your-razorpay-key>
RAZORPAY_KEY_SECRET=<your-razorpay-secret>

# SMS (optional in dev)
ENABLE_REAL_SMS=false
DEV_STATIC_OTP=1234

# Cloudinary
CLOUDINARY_CLOUD_NAME=<your-cloud-name>
CLOUDINARY_API_KEY=<your-api-key>
CLOUDINARY_API_SECRET=<your-api-secret>

# Firebase (for push notifications)
FCM_SERVER_KEY=<your-fcm-key>

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:19006,http://localhost:5173,http://localhost:5174

# Server
PORT=5000
NODE_ENV=development
```

---

*Document generated from codebase analysis. For questions, consult the relevant module files in `backend/src/modules/`.*
