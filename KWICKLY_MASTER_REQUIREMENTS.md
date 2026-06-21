# Kwickly — Master Requirements & Flow Document v3.1

> **Version**: 3.1 | **Model**: Service Marketplace + Product Delivery
> **Target Scale**: 50,000+ concurrent users | **Date**: June 2026
>
> **What's New in v3.1** (clarifications on v3.0):
> - Delivery staff = shop's own physical workers (no separate app role)
> - Shops are individual standalone stores (e.g. hardware shop, grocery store)
> - Product listing gated by **admin approval only** — subscription NOT required
> - Shop open/close times fully configured by shop owner
> - Nearby shop discovery based on shop's own delivery radius setting

---

## Table of Contents

1. [Platform Overview — Dual Model](#1-platform-overview)
2. [Roles & Sub-Roles](#2-roles--sub-roles)
3. [Subscription Plans (Admin-Configured)](#3-subscription-plans-admin-configured)
4. [Authentication & Registration Flows](#4-authentication--registration-flows)
5. [Profile Management](#5-profile-management)
6. [Complete Role Flows](#6-complete-role-flows)
   - 6.1 [Customer: Service Booking Flow](#61-customer-service-booking-flow)
   - 6.2 [Customer: Product Order Flow](#62-customer-product-order-flow)
   - 6.3 [Worker (Provider) Flow](#63-worker-provider-flow)
   - 6.4 [Shop Owner Onboarding & Setup](#64-shop-owner-onboarding--setup)
   - 6.5 [Shop Owner: Product & Delivery Management](#65-shop-owner-product--delivery-management)
   - 6.6 [Shop Owner: Order Fulfillment Flow](#66-shop-owner-order-fulfillment-flow)
   - 6.7 [Delivery Boy Flow](#67-delivery-boy-flow)
   - 6.8 [Admin Flow](#68-admin-flow)
7. [Loophole Analysis & Resolutions](#7-loophole-analysis--resolutions)
8. [Module Requirements](#8-module-requirements)
9. [Database Schema](#9-database-schema)
10. [Pricing & Charge Calculation Engine](#10-pricing--charge-calculation-engine)
11. [Geo-Radius Expansion & Notification Engine](#11-geo-radius-expansion--notification-engine)
12. [Media Upload Architecture](#12-media-upload-architecture)
13. [Real-Time Architecture](#13-real-time-architecture)
14. [Error Handling Strategy](#14-error-handling-strategy)
15. [Audit Logging Specification](#15-audit-logging-specification)
16. [Security Requirements](#16-security-requirements)
17. [Performance & Scale Targets](#17-performance--scale-targets)
18. [API Standards](#18-api-standards)

---

## 1. Platform Overview

**Kwickly** operates as a **dual-model platform**:

| Model | Description | Analogy |
|-------|-------------|---------|
| **Service Marketplace** | Customer posts a service job → Workers quote → Customer picks one | Urban Company / UrbanClap |
| **Product Delivery** | Customer browses shop products → Adds to cart → Shop delivers same-day | Dunzo / Blinkit / Swiggy Instamart |

Both models share: the same mobile app, the same auth system, the same wallet infrastructure, and the same admin panel.

### Payment Philosophy (Both Models)
> **All money first flows to Admin's Razorpay account.**
> Admin deducts platform commission → settles remainder to worker/shop wallet.
> Worker/shop withdraws from their wallet to bank/UPI.

---

## 2. Roles

| Role | Internal Name | Description |
|------|--------------|-------------|
| Customer | `customer` | Books services + orders products |
| Worker | `provider` | Fulfills service jobs on-site |
| Shop Owner | `shop_owner` | Manages their individual shop, products, delivery config, and their delivery staff |
| Admin | `admin` | Platform control, KYC approval, settlement, subscription config |

### Delivery Staff — NOT a Separate App Role
> **Delivery is handled by the shop's own physical workers/staff.** There is NO separate `delivery_boy` app role in the system.
>
> The shop owner manages delivery internally:
> - Assigns their physical staff to deliver orders
> - The shop owner's own app is used to manage and update delivery status
> - Delivery OTP is entered by the shop owner (or their staff using shop owner's device/app)
> - No separate login or registration required for delivery personnel
>
> This keeps the system simple and avoids onboarding friction for shop workers.

### Shop Type — Individual Physical Stores
> Each shop on Kwickly is an **individual, standalone physical store** — for example:
> - A hardware shop in your locality
> - A grocery store
> - A pharmacy
> - An electronics shop
>
> Each shop is independently owned and operated by one `shop_owner`. It is NOT a chain or franchise model. Every shop has its own products, delivery radius, pricing, and timings configured by that shop's owner.

---

## 3. Subscription Plans (Admin-Configured)

### 3.1 Default Plan Table

Both **Workers (providers)** and **Shop Owners** use the same subscription plan structure.

| Plan Name | Duration | Daily Cost | Total Price | Quote/Order Limit |
|-----------|----------|-----------|-------------|------------------|
| Free Trial | 180 days (6 months) | ₹0/day | ₹0 | 5 quotes/month (worker) / 20 orders/month (shop) |
| Basic Monthly | 30 days | ₹1.30/day | ₹39 | Unlimited |
| Quarterly Plan | 90 days (3 months) | ₹1.25/day | ₹113 | Unlimited |
| Half-Yearly Plan | 180 days (6 months) | ₹1.20/day | ₹216 | Unlimited |
| 9-Month Plan | 270 days (9 months) | ₹1.10/day | ₹297 | Unlimited |
| Annual Plan | 365 days (12 months) | ₹1.00/day | ₹365 | Unlimited |

### 3.2 Admin Configuration
All plan values are **stored in DB and fully configurable by Admin**:
```
Admin Panel → Subscriptions → Manage Plans → Edit any plan:
  - Plan name
  - Duration (days)
  - Price (₹)
  - Daily cost (auto-calculated = price / days)
  - Quote limit per month (for free tier)
  - Order limit per month (for free tier)
  - Is active (toggle to hide/show plan)
  - Priority notification delay (Premium = 0 min, Basic = 2 min, Free = 5 min)
```

### 3.3 Subscription Rules
- New registrations automatically get **Free Trial** (180 days)
- Free Trial is available **once per account** — cannot be re-used
- Paid plans can be stacked (buy before current expires → days added)
- Admin can grant any plan manually (for promotions, partnerships)
- Subscription stored per user (both worker and shop owner)

**Subscription Gate — What It Controls**:
| Gate | Worker | Shop Owner |
|------|--------|------------|
| Quoting on service jobs | ✅ Subscription required | — |
| Listing products to customers | — | ❌ NOT subscription gated |
| Receiving product orders | — | ❌ NOT subscription gated |
| Priority notification order | ✅ Tier determines speed | ✅ Tier determines speed |

> **KEY RULE for Shops**: Product listing and order receiving is gated by **Admin Approval ONLY**.
> Once admin approves the shop, the shop can immediately add products and receive orders.
> Subscription is NOT required for a shop to list products or receive orders.
> Subscription for shop owners only affects notification priority and future premium features.

### 3.4 Subscription Priority for Notifications
```
Premium (Annual / 9-Month / Half-Yearly) → notified IMMEDIATELY
Basic (Quarterly / Monthly)              → notified after 2 minutes
Free Trial                               → notified after 5 minutes
```

Premium tier = Annual + 9-Month + Half-Yearly plans
Basic tier = Quarterly + Monthly plans

---

## 4. Authentication & Registration Flows

### 4.1 Registration — All Roles (Customer / Worker / Shop Owner)

```
[App Open — New User]
         │
         ▼
Select Role Screen:
  ○ I'm a Customer
  ○ I'm a Service Worker
  ○ I'm a Shop Owner
         │
         ▼
Enter Phone Number (+91XXXXXXXXXX)
         │
         ▼
POST /api/v1/auth/register/send-otp { phone, role }
  ← Check: phone not already registered (returns error if duplicate)
  ← Generate 6-digit OTP → Redis `otp:reg:{phone}` TTL: 5 min
  ← Send OTP via SMS
         │
         ▼
Enter 6-digit OTP (60-sec countdown + resend after 60s)
         │
         ▼
POST /api/v1/auth/register/verify-otp { phone, otp }
  ← Verify OTP
  ← Store verified flag: Redis `otp:verified:{phone}` TTL: 15 min
         │
         ▼
Set Password Screen:
  - Min 8 chars, 1 uppercase, 1 number, 1 special char
  - Confirm password
         │
         ▼
POST /api/v1/auth/register/set-password { phone, password, confirmPassword }
  ← Hash password (bcrypt, 12 rounds)
  ← Create User record
  ← Create Wallet (balance: 0, pendingSettlement: 0)
  ← Assign Free Trial subscription (180 days)
  ← Issue accessToken (15 min) + refreshToken (7 days → Redis)
  ← Return { user, accessToken, refreshToken }
         │
         ▼
Role-specific onboarding screen
```

### 4.2 Login
```
POST /api/v1/auth/login { phone, password }
  ← Lookup user by phone
  ← bcrypt.compare(password, hash)
  ← Check: not banned, not deleted
  ← Check: not locked (loginAttempts >= 10 AND lockedUntil > now)
  ← On success: reset loginAttempts = 0, update lastLoginAt
  ← On failure: increment loginAttempts; if >= 10 → set lockedUntil = now + 30min
  ← Issue accessToken + refreshToken
```

### 4.3 Forgot Password
```
POST /api/v1/auth/forgot-password/send-otp { phone }
  ← Verify phone exists in DB
  ← Redis: `otp:pwd_reset:{phone}` TTL: 5 min (max 3 sends/hr)

POST /api/v1/auth/forgot-password/verify-otp { phone, otp }
  ← Returns { passwordResetToken } (JWT, 10 min, single-use flag in Redis)

POST /api/v1/auth/forgot-password/reset { passwordResetToken, newPassword }
  ← Verify token, hash new password, update DB
  ← Invalidate ALL refresh tokens for user (force re-login everywhere)
  ← Audit log: user.password_reset
```

### 4.4 Admin Login (Web Panel)
```
POST /api/v1/auth/admin/login { email, password }
  ← Role must be 'admin'
  ← Returns { accessToken, refreshToken }
```

---

## 5. Profile Management

### 5.1 All Roles — Common Profile
```
PATCH /api/v1/users/me/profile {
  name, email, photo (S3 URL), dateOfBirth
}

PATCH /api/v1/users/me/location {
  addressLine1, addressLine2, area, city, state, pincode,
  lat, lng
}

PATCH /api/v1/users/me/availability { isOnline: boolean }  ← workers only

PATCH /api/v1/users/me/fcm-token { fcmToken }
```

### 5.2 Wallet — Bank Account & UPI
```
POST /api/v1/users/me/bank-accounts { accountHolder, accountNumber, ifscCode, bankName, isDefault }
GET  /api/v1/users/me/bank-accounts
DELETE /api/v1/users/me/bank-accounts/:id
PATCH /api/v1/users/me/bank-accounts/:id/set-default

POST /api/v1/users/me/upi-accounts { upiId, name, isDefault }
GET  /api/v1/users/me/upi-accounts
DELETE /api/v1/users/me/upi-accounts/:id
PATCH /api/v1/users/me/upi-accounts/:id/set-default
```

### 5.3 Worker-Specific Profile
```
PATCH /api/v1/users/me/worker-profile {
  skills, categoryIds, experience, bio,
  idType, idNumber, idPhotoKeys[]
}
```

---

## 6. Complete Role Flows

### 6.1 Customer: Service Booking Flow

*(Unchanged from v2.0 — see full flow in previous version)*

**Quick Summary**:
1. Browse service categories
2. Post job with description + photos/videos + schedule
3. Workers notified (geo-radius expansion: 10→20→50km)
4. Workers quote → Customer reviews all quotes (price, rating, distance)
5. Customer accepts one quote → Others notified "job taken"
6. Worker travels → Customer shows Arrival OTP → Worker enters it → Work starts
7. Worker uploads completion proof (photos/videos)
8. Customer pays via Razorpay → Admin account
9. Customer rates worker
10. Admin settles worker wallet (after commission)

---

### 6.2 Customer: Product Order Flow

#### 6.2.1 Browsing & Cart

```
[Customer Home → Products Tab]
         │
         ▼
Browse Shops Near Me:
  GET /api/v1/shops?lat=X&lng=Y&type=product_shop&radiusKm=10
  ← Shops sorted by distance; shows: name, rating, delivery time, min order, delivery charge
         │
         ▼
Select a Shop → Shop Product Page:
  GET /api/v1/shops/:shopId/products?category=&search=
  ← Products list with: name, price, image, availability (in-stock/out-of-stock)
         │
         ▼
Add Product to Cart:
  POST /api/v1/cart { shopId, productId, quantity }
  ← Server-side cart (stored in DB, not just localStorage)
  ← VALIDATION: customer address within shop delivery radius
     → If outside radius: "This shop doesn't deliver to your area"
  ← VALIDATION: product is in stock (quantity > 0)
  ← RULE: Cart can only have products from ONE shop at a time
     → If cart has items from Shop A and customer adds from Shop B:
        "Your cart has items from [Shop A]. Clear cart to order from [Shop B]?"
         │
         ▼
Cart Screen:
  GET /api/v1/cart
  ← {
      shopId, shopName,
      items: [{ product, quantity, subtotal }],
      cartSubtotal,
      deliveryCharge,       // calculated based on shop config
      discount,             // calculated based on shop config
      totalAmount
    }
```

#### 6.2.2 Checkout Pricing Calculation

```
Cart Total Calculation (server-side, not client-side):

cartSubtotal = sum(item.price × item.quantity)

deliveryCharge:
  IF cartSubtotal >= shop.freeDeliveryAbove:
    deliveryCharge = 0     (free delivery)
  ELSE IF cartSubtotal >= shop.minOrderAmount:
    deliveryCharge = shop.deliveryCharge   (e.g., ₹50)
  ELSE:
    BLOCK CHECKOUT: "Minimum order is ₹{minOrderAmount}"

discount:
  IF cartSubtotal >= shop.discountAbove AND shop.discountType = 'flat':
    discount = shop.discountValue          (e.g., ₹50 off)
  IF cartSubtotal >= shop.discountAbove AND shop.discountType = 'percentage':
    discount = cartSubtotal × shop.discountPct / 100   (e.g., 10% off)
  discount = min(discount, shop.maxDiscountCap)         (cap if set)

totalAmount = cartSubtotal + deliveryCharge - discount
```

#### 6.2.3 Placing the Order

```
[Cart Screen → Proceed to Checkout]
         │
         ▼
Delivery Address Confirmation:
  - Show saved address (auto-fill from profile)
  - Customer can change delivery address (re-validates delivery radius)
         │
         ▼
Order Summary Screen:
  - Items list
  - Subtotal, delivery charge, discount
  - Final total
  - Estimated delivery: "Today by {shop's set time window}"
         │
         ▼
Payment:
  ○ UPI / Card / Net Banking (Razorpay)
  [Pay ₹XXX]
         │
         ▼
POST /api/v1/orders {
  cartId,
  deliveryAddressId,
  paymentMethod: 'razorpay'
}
  ← Server re-validates: stock, delivery radius, pricing
  ← Creates Order record (status: 'payment_pending')
  ← Creates Razorpay order
  ← Returns { orderId, razorpayOrderId, amount }
         │
         ▼
Razorpay SDK payment
         │
         ▼
POST /api/v1/orders/:id/payment/verify { razorpayPaymentId, signature }
  ← HMAC-SHA256 verified
  ← Order status → 'confirmed' (payment captured)
  ← Stock decremented for each ordered product
  ← Cart cleared
  ← Shop Owner push notification: "🔔 New Order #XXXX — ₹{amount}"
  ← Customer: "Order placed! Shop will confirm shortly."
```

#### 6.2.4 Order Tracking

```
[Customer — Order Status Screen]
         │
         ▼
Order status updates in real-time via Socket.IO (room: order:{orderId})
  + Push notifications at each status change:

  payment_pending → confirmed → preparing → out_for_delivery → delivered

Socket events:
  'order:status_changed' { orderId, oldStatus, newStatus, eta }

Status shown to customer:
  confirmed:          "Shop has accepted your order!"
  preparing:          "Your order is being prepared. ETA: {time}"
  out_for_delivery:   "Out for delivery! Delivery boy is on the way."
  delivered:          "Order delivered! ✅"
         │
         ▼
On 'out_for_delivery':
  - Delivery boy live location shown on customer map
  - Customer sees 4-digit DELIVERY OTP on their screen
    (to be given to delivery boy verbally/shown on phone)
         │
         ▼
On delivery:
  Delivery boy enters OTP in app → Order marked delivered
  Customer notified: "Order delivered! Please rate your experience."
         │
         ▼
Customer rates shop + delivery (1-5 stars, optional comment)
  POST /api/v1/orders/:id/rating { shopRating, deliveryRating, comment }
```

#### 6.2.5 Customer Order Edge Cases

| Scenario | Handling |
|----------|---------|
| Product out of stock at checkout | Server blocks order, notifies customer, suggests alternatives |
| Shop rejects order | Full refund to original payment method; customer notified with reason |
| Shop doesn't confirm within 30 min | Auto-cancel + refund; customer notified |
| Delivery boy can't reach (address issue) | Order flagged; customer and shop notified; reattempt same day |
| Customer not available for delivery | Delivery boy can re-attempt once (within 1 hour); else return to shop; full refund |
| Payment fails | Order not created; customer prompted to retry |
| Cart items price changed after cart add | Re-validate at checkout; show price difference to customer |

---

### 6.3 Worker (Provider) Flow

*(Unchanged from v2.0 — abbreviated here)*

1. Register → Free Trial subscription → Complete profile + skills
2. Go Online (wallet ≥ ₹100, subscription active, identity verified by admin)
3. Receive job notifications (based on category, location, eligibility)
4. View job details (description, photos, videos, approximate location)
5. Place quote (price, duration, note)
6. If quote accepted → get full address → travel → Arrival OTP → work → complete with proof
7. Customer pays → Admin settles to worker wallet
8. Worker withdraws to bank/UPI

---

### 6.4 Shop Owner Onboarding & Setup

#### 6.4.1 Step 1 — Register + Basic Profile

```
[Registration — role: shop_owner]
  → Phone OTP → Set Password → Account created with Free Trial
         │
         ▼
Onboarding Wizard (mandatory before shop goes live):
  ┌─────────────────────────────────────────────────────┐
  │  STEP 1: Personal Details                           │
  │  - Owner full name                                  │
  │  - Profile photo                                    │
  │  - Personal phone (auto-filled) + alternate phone   │
  │  - Personal address                                 │
  └─────────────────────────────────────────────────────┘
```

#### 6.4.2 Step 2 — Shop Details

```
  ┌─────────────────────────────────────────────────────┐
  │  STEP 2: Shop Details                               │
  │  - Shop name                                        │
  │  - Shop category (type of shop: grocery, pharmacy,  │
  │      electronics, restaurant, general store, etc.)  │
  │  - Shop phone number                                │
  │  - Shop address:                                    │
  │      Address Line 1, Area/Locality, City,           │
  │      State, Pincode                                 │
  │  - Pin shop location on map (lat/lng)               │
  │  - Shop timings (open/close time, days open)        │
  │  - Shop logo image (upload to S3)                   │
  │  - Shop banner image (upload to S3)                 │
  └─────────────────────────────────────────────────────┘

POST /api/v1/shops/onboarding/shop-details { ...shopDetails }
```

#### 6.4.3 Step 3 — KYC Documents

```
  ┌─────────────────────────────────────────────────────┐
  │  STEP 3: KYC Documents (mandatory)                  │
  │                                                     │
  │  Business Licence:                                  │
  │  [ Upload front ] [ Upload back ]                   │
  │  Licence Number: [______________]                   │
  │  Expiry Date: [______________]                      │
  │                                                     │
  │  GST Registration (if applicable):                  │
  │  [ Upload GST Certificate ]                         │
  │  GST Number: [______________]                       │
  │  (Toggle: "I am not GST registered" if exempt)      │
  │                                                     │
  │  Owner ID Proof:                                    │
  │  Type: ○ Aadhaar ○ PAN ○ Passport                   │
  │  [ Upload front ] [ Upload back ]                   │
  │  ID Number: [______________]                        │
  └─────────────────────────────────────────────────────┘

POST /api/v1/shops/onboarding/kyc {
  licenceNumber, licenceExpiry,
  licencePhotoKeys: string[],      // S3 keys
  gstNumber (optional),
  gstPhotoKey (optional),
  isGstExempt: boolean,
  ownerIdType, ownerIdNumber,
  ownerIdPhotoKeys: string[]
}
  ← Shop status: 'kyc_submitted' (pending admin review)
  ← Admin notified: "New shop KYC submitted — {shopName}"
```

#### 6.4.4 Step 4 — Wallet Setup

```
  ┌─────────────────────────────────────────────────────┐
  │  STEP 4: Payment Withdrawal Setup                   │
  │                                                     │
  │  Add Bank Account:                                  │
  │  Account Holder, Account Number, IFSC, Bank Name    │
  │                                                     │
  │  OR Add UPI ID:                                     │
  │  UPI ID (e.g., shopname@upi)                        │
  │                                                     │
  │  (At least one required)                            │
  └─────────────────────────────────────────────────────┘

POST /api/v1/users/me/bank-accounts { ... }
POST /api/v1/users/me/upi-accounts { ... }
```

#### 6.4.5 Step 5 — Admin KYC Review

```
[Admin Panel → KYC Queue]
         │
         ▼
Admin reviews:
  - Shop name, type, address completeness
  - Business licence number + validity
  - GST certificate (if applicable / exempt)
  - Owner ID proof (Aadhaar/PAN/Passport)
  - Shop location on map
         │
         ├── APPROVE:
         │   PATCH /api/v1/admin/shops/:id/approve
         │   ← shop.status = 'approved'
         │   ← shop.isActive = true
         │   ← shop.kycVerifiedAt = now()
         │   ← Shop Owner push:
         │       "🎉 Your shop [{shopName}] has been approved!
         │        You can now add your products and start receiving orders."
         │
         ├── REJECT with reason:
         │   PATCH /api/v1/admin/shops/:id/reject { reason, fieldsToRefix: [] }
         │   ← shop.status = 'kyc_rejected'
         │   ← Shop Owner push: "KYC rejected. Reason: {reason}. Please re-upload."
         │   ← Shop Owner can correct documents and re-submit
         │
         └── REQUEST RESUBMISSION (specific fields):
             PATCH /api/v1/admin/shops/:id/request-resubmission {
               fields: ['gst', 'licence'],
               message: 'GST certificate is blurry, please re-upload'
             }
             ← shop.status = 'kyc_resubmission_required'
             ← Shop Owner notified with exact fields to fix
```

**Gate Rules After Admin Approval**:
```
shop.status = 'approved':
  ✅ Shop owner CAN add products immediately
  ✅ Shop IS visible to customers within delivery radius
  ✅ Shop CAN receive orders
  ✅ No subscription required for any of the above

shop.status != 'approved' (incomplete / kyc_submitted / kyc_rejected):
  ❌ Shop owner CANNOT add products
  ❌ Shop NOT visible to customers
  ❌ Shop CANNOT receive orders

Note: Subscription status does NOT affect product listing or order reception.
      Subscription only affects: notification priority, future premium features.
```

---

### 6.5 Shop Owner: Shop Settings, Product & Delivery Management

#### 6.5.1 Shop Open / Close Time (Owner Configured)

> Shop hours are **fully controlled by the shop owner** from the app. Customers cannot place orders outside shop hours.

```
[Shop Dashboard → Settings → Shop Hours]
         │
         ▼
PATCH /api/v1/shops/:id/hours {
  openDays: ['mon','tue','wed','thu','fri','sat'],  // select which days open
  openTime: '09:00',      // HH:MM 24-hour format
  closeTime: '21:00',
  isOpenNow: boolean      // manual override toggle (holiday, emergency close)
}

Rules:
  - Orders blocked if placed outside openTime–closeTime on selected openDays
  - Shop owner can toggle 'isOpenNow: false' at any time for instant closure
  - On closure → new orders blocked; active orders continue
  - Customers see shop status: "Open" / "Closes at 9PM" / "Closed"
  - App shows next open time if currently closed: "Opens Mon 9:00 AM"
```

#### 6.5.2 Delivery Configuration

```
[Shop Dashboard → Settings → Delivery]
         │
         ▼
PATCH /api/v1/shops/:id/delivery-config {

  // ── Delivery radius (where this shop delivers) ──────────
  deliveryRadiusKm: 8,
    // Max km from shop location
    // Customer discovery: only customers within this radius see this shop
    // Example: Hardware shop sets 5km → only customers within 5km can order
    // Max allowed: platform cap (default 50km, admin configurable)

  // ── Minimum order amount ─────────────────────────────────
  minOrderAmount: 100,
    // Orders below ₹100 blocked at checkout
    // Shown to customer on shop page: "Min order ₹100"

  // ── Free delivery threshold ──────────────────────────────
  freeDeliveryAbove: 500,
    // Orders ≥ ₹500 → free delivery
    // Set null to never offer free delivery

  // ── Delivery charge ──────────────────────────────────────
  deliveryCharge: 50,
    // ₹ charged when order < freeDeliveryAbove
    // Example: order ₹300 → ₹50 delivery charge

  // ── Discount configuration ───────────────────────────────
  discountEnabled: true,
  discountAbove: 1000,          // discount triggers when order ≥ ₹1000
  discountType: 'flat',         // 'flat' (₹ off) or 'percentage' (% off)
  discountValue: 100,           // ₹100 off (if flat)
  discountPct: 10,              // 10% off (if percentage)
  maxDiscountCap: 200,          // max ₹200 discount cap (used with percentage)

  // ── Same-day delivery slots ──────────────────────────────
  sameDayDelivery: true,
  deliverySlots: [
    { label: '10AM–1PM',  slotOpen: '10:00', slotClose: '13:00' },
    { label: '2PM–6PM',   slotOpen: '14:00', slotClose: '18:00' },
    { label: '7PM–9PM',   slotOpen: '19:00', slotClose: '21:00' }
  ]
}
```

**Delivery Config Validations**:
- `deliveryRadiusKm` must be > 0 and ≤ platform max (default 50km)
- `minOrderAmount` must be ≥ 0
- `freeDeliveryAbove` must be ≥ `minOrderAmount` (or null)
- `deliveryCharge` must be ≥ 0
- `discountAbove` must be > `freeDeliveryAbove` (to prevent math conflicts)
- Delivery slots must be within shop's openTime–closeTime window

**How Delivery Radius Works for Customer Discovery**:
```
Customer opens app → "Nearby Shops" tab
  → Selects category: "Hardware"
  → App sends: GET /api/v1/shops?lat=X&lng=Y&type=hardware
  → Server returns: shops WHERE
      shop.status = 'approved'
      AND ST_DWithin(shop.location, customer.location, shop.deliveryRadiusKm)
      AND shop is currently open (openDays + openTime/closeTime)
  → Customer sees: list of hardware shops sorted by distance
  → Each shop shows: name, distance, rating, min order, delivery charge, ETA
```

#### 6.5.3 Delivery Staff Management (No Separate App Role)

> Delivery is handled by the **shop's own physical staff**.
> No separate app account needed for delivery personnel.
> The **shop owner manages delivery from their own app**.

```
[Shop Dashboard → Settings → Delivery Staff]
         │
         ▼
Shop owner adds delivery staff names for tracking/assignment purposes:
  POST /api/v1/shops/:id/delivery-staff {
    name: 'Raju',
    phone: '+919876543210'    // for contact only, not app login
  }
  ← Creates a DeliveryStaff record (NOT a User/app account)
  ← Returns: { staffId, name, phone }

View delivery staff:
  GET /api/v1/shops/:id/delivery-staff
  ← [{ staffId, name, phone, activeOrderId, totalDeliveries }]

Update / Remove staff:
  PATCH /api/v1/shops/:id/delivery-staff/:staffId
  DELETE /api/v1/shops/:id/delivery-staff/:staffId
    (blocked if staffId has activeOrderId set)
```

#### 6.5.3 Product Catalog Management

```
[Shop Dashboard → Products → Add New Product]
         │
         ▼
Product Form:
  ┌─────────────────────────────────────────────────────┐
  │ Product Name: [_________________________________]   │
  │ Category: [dropdown — shop categories]              │
  │ Description: [__________________________________]   │
  │ Price (MRP): ₹ [____]                              │
  │ Selling Price: ₹ [____]   (can be < MRP for offer) │
  │ Unit: ○ piece ○ kg ○ litre ○ pack ○ dozen          │
  │ Quantity per unit: [____] (e.g., 500g, 1L)         │
  │ Stock Quantity: [____]                              │
  │ Low Stock Alert: [____] (notify when stock ≤ this)  │
  │ Product Images: [Upload up to 5 images]             │
  │ Is Active: ○ Yes ○ No                               │
  └─────────────────────────────────────────────────────┘

POST /api/v1/shops/:id/products {
  name, categoryId, description,
  mrpPrice, sellingPrice, unit, quantityPerUnit,
  stockQuantity, lowStockThreshold,
  imageKeys: string[],   // S3 keys
  isActive: boolean
}
  ← Product created, visible to customers in delivery radius
  ← If stockQuantity = 0 → shown as "Out of Stock" (not hidden)

PATCH /api/v1/shops/:id/products/:productId { ...fields }
  ← Update any field
  ← If sellingPrice changed → cart re-calculates on next load (LOOPHOLE RESOLVED)

PATCH /api/v1/shops/:id/products/:productId/stock { stockQuantity, adjustment: 'set'|'add'|'subtract' }
  ← Stock management endpoint
  ← On low stock → push notification to shop owner
  ← On out of stock (0) → product auto-shown as "Out of Stock"
```

---

### 6.6 Shop Owner: Order Fulfillment Flow

```
[Push Notification + Sound Alert to Shop Owner App]
"🔔 New Order #1042 — ₹840 — 3 items"
         │
         ▼
Shop Owner opens order in their app:
  GET /api/v1/orders/:id (shop owner view)
  ← {
      orderId, orderNumber,
      customer: { firstName, phone (masked: +91XXXXXX4321) },
      items: [{ productName, quantity, unitPrice, subtotal }],
      deliveryAddress: { area, city, pincode, distanceFromShopKm },
      total, deliveryCharge, discount,
      paymentStatus: 'captured',
      customerSelectedSlot: { label, slotOpen, slotClose } (if chosen)
    }
         │
         ▼
Shop Owner must respond within 30 minutes:

  ┌─ ACCEPT ORDER ──────────────────────────────────────┐
  │ PATCH /api/v1/orders/:id/accept {                   │
  │   estimatedDeliverySlot: { label, estimatedBy }     │
  │   note: 'Will deliver by 2PM' (optional)            │
  │ }                                                   │
  │ ← order.status = 'confirmed'                        │
  │ ← Customer push: "Order confirmed! ETA: {slot}"    │
  │ ← Customer's full address now revealed to shop      │
  └──────────────────────────────────────────────────────┘

  ┌─ REJECT ORDER ──────────────────────────────────────┐
  │ PATCH /api/v1/orders/:id/reject {                   │
  │   reason: 'out_of_stock'|'shop_closed'|'other'      │
  │   note: 'Bolt stock finished'                       │
  │ }                                                   │
  │ ← order.status = 'cancelled'                        │
  │ ← Full Razorpay refund triggered automatically      │
  │ ← Customer push: "Order cancelled. Reason: {note}.  │
  │     Full refund in 3-5 business days."              │
  │ ← Audit logged                                      │
  └──────────────────────────────────────────────────────┘

If no response within 30 minutes (auto-cancel by BullMQ cron):
  → order.status = 'cancelled', cancelledBy = 'system'
  → Full refund triggered
  → Customer notified: "Shop didn't respond. Full refund initiated."
  → Admin alerted; shop gets penalty flag
  → 3 consecutive misses → admin review flag on shop
         │
         ▼ (after accepting)
[Order Accepted → Shop prepares items]
  PATCH /api/v1/orders/:id/status { status: 'preparing' }
  ← Customer push: "Shop is packing your order 📦"
         │
         ▼
[Ready for dispatch → Assign delivery staff]
  PATCH /api/v1/orders/:id/dispatch {
    staffId: uuid,             // one of the shop's registered delivery staff
    staffName: 'Raju',         // shown to customer
    staffPhone: '+91XXXXXXX'   // revealed to customer on dispatch
  }
  ← order.status = 'out_for_delivery'
  ← order.dispatchedAt = now()
  ← Delivery OTP generated → Redis: `delivery_otp:{orderId}` (no expiry until used)
  ← Customer push: "Your order is on the way! 🚚"
  ← Customer app shows: staff name + masked phone + 4-digit DELIVERY OTP
         │
         ▼
[Shop owner / delivery staff physically delivers]
Shop owner uses their app to:
  - Update order to 'out_for_delivery' (done in dispatch step above)
  - On arrival at customer: ask customer for the 4-digit OTP shown on their screen
  - Enter OTP in shop owner's app:

    POST /api/v1/orders/:id/verify-delivery { otp }
    ← OTP verified from Redis
    ← order.status = 'delivered'
    ← order.deliveredAt = now()
    ← Customer push: "Order delivered! ✅ Please rate your experience."
    ← Admin: Settlement record created (status: 'pending')
```

---

### 6.7 Delivery Staff — Physical Delivery Process

### 6.7 Post-Delivery & Settlement

```
[After OTP is verified in Shop Owner App]
         │
         ▼
Settlement Record Created (Admin):
  {
    orderId,
    shopId,
    totalPaid: ₹840,
    platformCommission: ₹84 (10%),
    shopEarning: ₹756,
    status: 'pending'
  }
         │
         ▼
Admin reviews and settles → shop.wallet.balance += ₹756
Shop push: "₹756 added to your Kwickly wallet!"
```

#### 6.7.1 Delivery Edge Cases

| Scenario | Handling |
|----------|---------|
| Customer not home | Shop marks "Customer Unavailable"; 1 re-attempt within 1 hour; else auto-refund |
| Wrong delivery address | Shop contacts customer; if can't reach → return to shop; admin reviews |
| Items damaged in delivery | Customer reports via app within 2 hours of delivery OTP; admin reviews photos; partial/full refund decision |
| OTP not matching after 5 attempts | Admin manual verification flow activated; cannot bypass without admin |
| Delivered to wrong person | Audit log shows GPS + timestamp mismatch; admin investigates; customer refunded |

---

### 6.8 Admin Flow

#### 6.8.1 Dashboard KPIs
```
GET /api/v1/admin/stats
  ← {
      // Platform-wide
      totalUsers, activeUsers24h,

      // Services
      activeServiceJobs, serviceJobsToday,
      pendingServiceSettlements,

      // Products / Orders
      activeOrders, ordersToday, ordersDeliveredToday,
      pendingOrderSettlements,

      // Revenue
      servicesTotalRevenue, ordersRevenue, totalRevenue,
      platformCommissionToday,

      // Shops & Workers
      onlineWorkers, activeShops,
      pendingKycApprovals, pendingShopApprovals,

      // Subscriptions
      activeSubscriptions, expiringThisWeek
    }
```

#### 6.8.2 Subscription Plan Management
```
GET  /api/v1/admin/subscription-plans        ← list all plans
POST /api/v1/admin/subscription-plans {      ← create new plan
  name, durationDays, totalPrice,
  monthlyQuoteLimit, monthlyOrderLimit,
  notificationPriorityMinutes,
  isActive
}
PATCH /api/v1/admin/subscription-plans/:id   ← update any plan
DELETE /api/v1/admin/subscription-plans/:id  ← soft delete (existing subs unaffected)

// Manual subscription grant
POST /api/v1/admin/subscriptions/grant {
  userId, planId, note
}

// View all subscriptions
GET /api/v1/admin/subscriptions?tier=&status=&expiresIn=7days
```

#### 6.8.3 KYC Management
```
GET /api/v1/admin/kyc?status=pending     ← list shops awaiting review
GET /api/v1/admin/kyc/:shopId            ← full KYC detail + document viewer
  ← { shop, owner, kycDocs: [{ type, s3SignedUrl, uploadedAt }] }

PATCH /api/v1/admin/shops/:id/approve
PATCH /api/v1/admin/shops/:id/reject { reason, fieldsToRefix: ['gst', 'licence'] }
PATCH /api/v1/admin/shops/:id/request-resubmission { fields: [], message }
```

#### 6.8.4 Order Settlement
```
GET /api/v1/admin/settlements?type=order&status=pending
  ← [{ orderId, shopId, deliveredAt, totalPaid, commission, shopEarning }]

POST /api/v1/admin/settlements/:id/settle {
  shopAmount: number,
  commissionAmount: number,
  note: string
}
  ← Shop wallet credited
  ← Settlement marked 'settled'
  ← Audit logged

POST /api/v1/admin/settlements/bulk-settle {
  settlementIds: string[],
  useDefaultCommission: true    // uses platformConfig.platformCommissionPct
}
```

#### 6.8.5 Platform Config
```
PATCH /api/v1/admin/config {
  // Service-related
  serviceCommissionPct: 10,
  shopServiceCommissionPct: 5,
  initialRadiusKm: 10,
  expandRadius2Km: 20,
  expandRadius3Km: 50,
  radiusExpansionDelayMin: 5,
  quoteWindowMinutes: 30,
  workerMinWalletBalance: 100,

  // Order-related
  orderCommissionPct: 10,
  shopAutoRejectMinutes: 30,       // auto-cancel if shop doesn't respond
  maxDeliveryRadiusKm: 50,        // platform max delivery radius
  deliveryOtpMaxAttempts: 5,

  // Subscription
  freeTrialDays: 180,
  freeMonthlyQuoteLimit: 5,       // for workers on free tier
  freeMonthlyOrderLimit: 20,      // for shops on free tier

  // Auth
  otpExpirySeconds: 300,
  maxLoginAttempts: 10,
  loginLockoutMinutes: 30,

  // Wallet
  minWithdrawalAmount: 100,
  maxWithdrawalAmount: 50000
}
```

---

## 7. Loophole Analysis & Resolutions

> All loopholes identified during design review — resolved before implementation.

| # | Loophole | Impact | Resolution |
|---|----------|--------|-----------|
| L1 | **Who is the delivery boy?** External employee with no system presence | Orders can't be tracked, no OTP verification | Delivery boy = registered app user with role `delivery_boy`, linked to shop, has GPS tracking |
| L2 | **No stock management** — product can be oversold | Customer pays for unavailable item | Stock quantity on every product; decremented atomically at order confirm; checkout re-validates stock |
| L3 | **Cart from multiple shops** — unclear behavior | Confusing UX, checkout complexity | Cart scoped to ONE shop per cart; adding from different shop prompts "Clear cart?" |
| L4 | **Price changed after cart add** | Customer pays wrong price | Price re-validated at checkout server-side; if changed → show difference, ask to re-confirm |
| L5 | **Delivery radius not checked at cart time** | Customer orders, payment taken, but shop can't deliver | Radius validated on EVERY add-to-cart call, not just at checkout |
| L6 | **Shop doesn't respond to order** | Customer's money held indefinitely | Auto-cancel + auto-refund after 30 min of no shop response |
| L7 | **No min order check at cart** | Customer checks out with ₹10 order when min is ₹100 | Min order check at add-to-cart AND again at checkout (server-side) |
| L8 | **KYC gate** — shop can list products before approval | Fake shops take orders, scam customers | Products can only be added AFTER shop.status = 'approved'; orders only from approved shops |
| L9 | **Subscription gate** — shop can receive orders without subscription | Free users abuse platform | Subscription validity checked before shop is shown to customers |
| L10 | **No delivery boy availability check before assignment** | Delivery boy assigned to two orders simultaneously | Delivery boy can only have ONE active delivery; assignment blocked if currentOrderId is set |
| L11 | **Delivery OTP can be brute-forced** | Fraud — delivery boy fakes delivery | Max 5 wrong OTP attempts → admin alert + manual verification required |
| L12 | **Customer not home** | Order stuck with delivery boy indefinitely | 1 re-attempt within 1 hour; if still unavailable → return to shop, auto-refund |
| L13 | **Partial order fulfillment** — shop has only some items | Customer unclear what they'll receive | No partial orders in v1.0. Shop must either fulfill fully or reject with reason. (Partial orders = v2.0 roadmap) |
| L14 | **GST handling** — no tax calculation | Legal compliance issue | GST number stored; tax display shown on invoice (visual only for v1.0); tax engine = v2.0 roadmap |
| L15 | **Delivery boy GPS goes stale** | Customer sees wrong location on map | If GPS not updated for >60s → delivery boy shown as "location unavailable"; shop alerted |
| L16 | **Free Trial re-use** | Users create new accounts for Free Trial | Free Trial tied to phone number (not just account); Redis + DB tracks used phone numbers |
| L17 | **Discount + free delivery math conflict** | Discount could make order free, no delivery charge decision | Delivery charge calculated first on RAW subtotal; discount applied after; both shown separately |
| L18 | **Settlement timing** — admin manually settles | Worker/shop waits indefinitely for payment | Admin SLA: settle within 2 business days; auto-reminder if settlement pending > 48h |
| L19 | **No delivery slot selection at order time** | Shop sets ETA, but customer had different expectation | Customer can select preferred delivery slot from shop's configured slots at checkout |
| L20 | **Shop closed when order placed** | Order placed outside shop hours | Shop's openTime/closeTime validated at checkout; orders blocked outside operating hours |

---

## 8. Module Requirements

### M1: Auth Module
`/api/v1/auth`

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/register/send-otp` | POST | None | Send registration OTP |
| `/register/verify-otp` | POST | None | Verify OTP |
| `/register/set-password` | POST | None | Create account + set password |
| `/login` | POST | None | Phone + password login |
| `/forgot-password/send-otp` | POST | None | Send reset OTP |
| `/forgot-password/verify-otp` | POST | None | Verify + get reset token |
| `/forgot-password/reset` | POST | None | Set new password |
| `/refresh` | POST | None | Rotate refresh token |
| `/logout` | POST | JWT | Invalidate refresh token |
| `/admin/login` | POST | None | Admin email + password |

### M2: Users Module
`/api/v1/users`

| Endpoint | Method | Auth | Roles |
|----------|--------|------|-------|
| `/me` | GET | JWT | Any |
| `/me/profile` | PATCH | JWT | Any |
| `/me/location` | PATCH | JWT | Any |
| `/me/worker-profile` | PATCH | JWT | provider |
| `/me/availability` | PATCH | JWT | provider, delivery_boy |
| `/me/fcm-token` | PATCH | JWT | Any |
| `/me/bank-accounts` | GET/POST/DELETE | JWT | provider, shop_owner, delivery_boy |
| `/me/upi-accounts` | GET/POST/DELETE | JWT | provider, shop_owner, delivery_boy |
| `/` | GET | JWT | admin |
| `/:id` | GET/PATCH | JWT | admin |

### M3: Media Module
`/api/v1/media`

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/upload-url` | POST | JWT | Get S3 pre-signed PUT URLs |
| `/confirm` | POST | JWT | Confirm upload, get CDN URLs |

**Contexts and limits**:
| Context | Max Files | Max Size | Allowed Types |
|---------|-----------|----------|--------------|
| `job_photo` | 5 | 10MB | image/jpeg, png, webp |
| `job_video` | 2 | 50MB | video/mp4, quicktime |
| `completion_photo` | 5 | 10MB | image/jpeg, png |
| `completion_video` | 1 | 50MB | video/mp4 |
| `profile_photo` | 1 | 5MB | image/jpeg, png |
| `product_image` | 5 | 10MB | image/jpeg, png, webp |
| `shop_logo` | 1 | 5MB | image/jpeg, png |
| `shop_banner` | 1 | 10MB | image/jpeg, png |
| `kyc_document` | 3 | 10MB | image/jpeg, png, pdf |
| `id_document` | 2 | 5MB | image/jpeg, png, pdf |

### M4: Subscriptions Module
`/api/v1/subscriptions`

| Endpoint | Method | Auth | Roles |
|----------|--------|------|-------|
| `/plans` | GET | None | Any |
| `/me` | GET | JWT | provider, shop_owner |
| `/purchase` | POST | JWT | provider, shop_owner |
| `/webhook` | POST | None | Razorpay |

Admin endpoints:
`/api/v1/admin/subscription-plans` → CRUD for plan definitions

### M5: Catalog Module (Service Items)
`/api/v1/catalog`
*(Unchanged from v2.0)*

### M6: Shops Module
`/api/v1/shops`

| Endpoint | Method | Auth | Roles |
|----------|--------|------|-------|
| `/` | GET | None | Any |
| `/:id` | GET | None | Any |
| `/onboarding/shop-details` | POST | JWT | shop_owner |
| `/onboarding/kyc` | POST | JWT | shop_owner |
| `/:id` | PATCH | JWT | shop_owner |
| `/:id/delivery-config` | GET/PATCH | JWT | shop_owner |
| `/:id/products` | GET | None | Any |
| `/:id/products` | POST | JWT | shop_owner |
| `/:id/products/:pid` | PATCH/DELETE | JWT | shop_owner |
| `/:id/products/:pid/stock` | PATCH | JWT | shop_owner |
| `/:id/workers` | GET/POST/DELETE | JWT | shop_owner |
| `/:id/delivery-staff` | GET/POST | JWT | shop_owner |
| `/:id/delivery-staff/:staffId` | PATCH/DELETE | JWT | shop_owner |
| `/:id/analytics` | GET | JWT | shop_owner, admin |

### M7: Cart Module
`/api/v1/cart`

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/` | GET | JWT | Get current cart |
| `/` | POST | JWT | Add item to cart |
| `/:itemId` | PATCH | JWT | Update item quantity |
| `/:itemId` | DELETE | JWT | Remove item |
| `/clear` | DELETE | JWT | Clear entire cart |

**Cart Server-Side Logic**:
- Cart stored in DB (not Redis) for persistence across devices
- One active cart per customer
- Cart scoped to one shop
- Each add-to-cart: validates radius, stock, shop is open and approved
- Cart auto-expires after 24 hours of inactivity (BullMQ cron)
- Price re-validation at checkout

### M8: Jobs Module (Service Jobs)
`/api/v1/jobs`
*(Unchanged from v2.0 — see Section 6.1)*

### M9: Orders Module (Product Orders)
`/api/v1/orders`

| Endpoint | Method | Auth | Roles |
|----------|--------|------|-------|
| `/` | POST | JWT | customer |
| `/` | GET | JWT | Any (role-filtered) |
| `/:id` | GET | JWT | Any |
| `/:id/payment/verify` | POST | JWT | customer |
| `/:id/accept` | PATCH | JWT | shop_owner |
| `/:id/reject` | PATCH | JWT | shop_owner |
| `/:id/status` | PATCH | JWT | shop_owner |
| `/:id/dispatch` | PATCH | JWT | shop_owner |
| `/:id/verify-delivery` | POST | JWT | shop_owner |
| `/:id/rating` | POST | JWT | customer |
| `/:id/report-issue` | POST | JWT | customer |

**Order Status State Machine**:
```
payment_pending
    │ (payment captured)
    ▼
confirmed ──────────────────────────────────────────────► cancelled (shop rejected)
    │ (shop confirms + sets ETA)                              │
    ▼                                                    (auto-refund)
preparing
    │ (shop dispatches order via staff)
    ▼
out_for_delivery
    │ (delivery OTP verified)
    ▼
delivered
    │
    ▼
settled (admin settles shop wallet)

cancelled can also happen:
  - shop doesn't respond in 30 min → auto-cancel + refund
  - customer cancels before 'preparing' status
  - admin override
```

### M10: Dispatch & Notification Engine (Services)
*(Geo-radius expansion — see Section 11)*

### M11: Wallet Module
`/api/v1/wallet`

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/me` | GET | JWT | Balance + pending settlement |
| `/me/transactions` | GET | JWT | Transaction history |
| `/withdraw` | POST | JWT | Withdraw to bank/UPI |

### M12: Payments Module
`/api/v1/payments`

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/service-orders` | POST | JWT | Create Razorpay order (service job) |
| `/product-orders` | POST | JWT | Create Razorpay order (product order) |
| `/verify` | POST | JWT | Verify payment signature |
| `/webhook` | POST | None | Razorpay webhook handler |
| `/refund` | POST | JWT | Issue refund (admin) |

### M13: Admin Module
`/api/v1/admin`
*(Enhanced — see Section 6.8)*

---

## 9. Database Schema

```prisma
// ─── ENUMS ─────────────────────────────────────────────────────────────────────
enum UserRole           { customer provider shop_owner admin }
enum JobStatus          { open assigned en_route in_progress completed paid settled cancelled expired }
enum OrderStatus        { payment_pending confirmed preparing out_for_delivery delivered cancelled returned }
enum QuoteStatus        { pending accepted rejected withdrawn expired }
enum SettlementStatus   { pending settled cancelled }
enum SettlementType     { service_job product_order }
enum TransactionType    { credit debit }
enum TransactionStatus  { pending success failed refunded }
enum PaymentStatus      { pending captured failed refunded }
enum SubscriptionTier   { free_trial basic_monthly quarterly half_yearly nine_month annual }
enum ShopStatus         { incomplete kyc_submitted kyc_rejected approved suspended }
enum InviteStatus       { pending accepted rejected expired }
enum MediaContext        { job_photo job_video completion_photo completion_video profile_photo product_image shop_logo shop_banner kyc_document id_document }
enum WithdrawStatus     { pending processing completed failed }
enum DiscountType       { flat percentage }
enum KycDocType         { business_licence gst_certificate owner_id }

// ─── USERS ─────────────────────────────────────────────────────────────────────
model User {
  id              String    @id @default(uuid())
  phone           String    @unique
  passwordHash    String
  name            String    @default("")
  email           String?   @unique
  role            UserRole  @default(customer)
  photo           String?
  fcmToken        String?
  isVerified      Boolean   @default(false)
  isActive        Boolean   @default(true)
  isBanned        Boolean   @default(false)
  banReason       String?
  loginAttempts   Int       @default(0)
  lockedUntil     DateTime?
  lastLoginAt     DateTime?
  addressLine1    String?
  addressLine2    String?
  area            String?
  city            String?
  state           String?
  pincode         String?
  locationLat     Float?
  locationLng     Float?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  wallet          Wallet?
  workerProfile   WorkerProfile?
  ownedShops      Shop[]
  jobsAsCustomer  Job[]          @relation("CustomerJobs")
  jobsAsProvider  Job[]          @relation("ProviderJobs")
  ordersAsCustomer Order[]
  ratings         JobRating[]
  orderRatings    OrderRating[]
  subscription    Subscription?
  bankAccounts    BankAccount[]
  upiAccounts     UpiAccount[]
  loginSessions   LoginSession[]
  auditLogs       AuditLog[]

  @@index([phone])
  @@index([role])
  @@index([city])
  @@index([createdAt])
}

model WorkerProfile {
  id              String    @id @default(uuid())
  userId          String    @unique
  user            User      @relation(fields: [userId], references: [id])
  shopId          String?
  shop            Shop?     @relation(fields: [shopId], references: [id])
  isOnline        Boolean   @default(false)
  lastLocationLat Float?
  lastLocationLng Float?
  lastLocationAt  DateTime?
  categoryIds     String[]
  skills          String[]
  experience      String?
  bio             String?
  idType          String?
  idNumber        String?
  idPhotoKeys     String[]
  totalJobsDone   Int       @default(0)
  averageRating   Float     @default(0)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([shopId, isOnline])
}

model DeliveryBoyProfile {
  id              String    @id @default(uuid())
  userId          String    @unique
  user            User      @relation(fields: [userId], references: [id])
  shopId          String?
  shop            Shop?     @relation(fields: [shopId], references: [id])
  isOnline        Boolean   @default(false)
  lastLocationLat Float?
  lastLocationLng Float?
  lastLocationAt  DateTime?
  currentOrderId  String?   // set when on active delivery; blocks new assignment
  totalDeliveries Int       @default(0)
  averageRating   Float     @default(0)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([shopId, isOnline])
}

model LoginSession {
  id          String    @id @default(uuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id])
  ip          String?
  userAgent   String?
  deviceId    String?
  platform    String?
  loggedInAt  DateTime  @default(now())
  loggedOutAt DateTime?

  @@index([userId])
}

// ─── SUBSCRIPTION PLANS (ADMIN-CONFIGURED) ────────────────────────────────────
model SubscriptionPlan {
  id                          String   @id @default(uuid())
  name                        String   @unique
  tier                        SubscriptionTier
  durationDays                Int
  totalPrice                  Float
  dailyCost                   Float    // auto: totalPrice / durationDays
  monthlyQuoteLimit           Int?     // null = unlimited
  monthlyOrderLimit           Int?     // null = unlimited
  notificationPriorityMinutes Int      @default(5) // 0 = immediate
  isActive                    Boolean  @default(true)
  sortOrder                   Int      @default(0)
  createdAt                   DateTime @default(now())
  updatedAt                   DateTime @updatedAt

  subscriptions Subscription[]
}

model Subscription {
  id                  String           @id @default(uuid())
  userId              String           @unique
  user                User             @relation(fields: [userId], references: [id])
  planId              String
  plan                SubscriptionPlan @relation(fields: [planId], references: [id])
  tier                SubscriptionTier
  isActive            Boolean          @default(true)
  startsAt            DateTime         @default(now())
  expiresAt           DateTime?
  quotesUsedThisMonth Int              @default(0)
  ordersUsedThisMonth Int              @default(0)
  usageResetAt        DateTime?
  razorpaySubId       String?
  grantedByAdminId    String?
  createdAt           DateTime         @default(now())
  updatedAt           DateTime         @updatedAt

  @@index([userId])
  @@index([expiresAt])
}

// ─── SHOPS ─────────────────────────────────────────────────────────────────────
model Shop {
  id              String     @id @default(uuid())
  ownerId         String
  owner           User       @relation(fields: [ownerId], references: [id])
  name            String
  description     String?
  categoryType    String     // 'grocery', 'pharmacy', 'restaurant', etc.
  phone           String
  logoKey         String?
  bannerKey       String?
  openTime        String?    // "09:00"
  closeTime       String?    // "21:00"
  openDays        String[]   // ['mon','tue',...]
  addressLine1    String     @default("")
  area            String     @default("")
  city            String     @default("")
  state           String     @default("")
  pincode         String     @default("")
  locationLat     Float      @default(0)
  locationLng     Float      @default(0)
  status          ShopStatus @default(incomplete)
  isActive        Boolean    @default(false)
  kycVerifiedAt   DateTime?
  kycVerifiedBy   String?
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt

  deliveryConfig  ShopDeliveryConfig?
  kycDocs         ShopKycDoc[]
  workers         WorkerProfile[]
  deliveryStaff   ShopDeliveryStaff[]
  serviceItems    CatalogItem[]
  products        Product[]
  serviceJobs     Job[]
  orders          Order[]
  wallet          Wallet?
  invites         ShopInvite[]

  @@index([ownerId])
  @@index([status, isActive])
  @@index([city])
}

model ShopDeliveryConfig {
  id                  String       @id @default(uuid())
  shopId              String       @unique
  shop                Shop         @relation(fields: [shopId], references: [id])
  deliveryRadiusKm    Float        @default(5)
  minOrderAmount      Float        @default(0)
  freeDeliveryAbove   Float?       // null = never free
  deliveryCharge      Float        @default(0)
  discountEnabled     Boolean      @default(false)
  discountAbove       Float?
  discountType        DiscountType @default(flat)
  discountValue       Float        @default(0)
  discountPct         Float        @default(0)
  maxDiscountCap      Float?
  deliverySlots       Json         @default("[]") // [{ label, openAt, closeAt }]
  sameDayDelivery     Boolean      @default(true)
  updatedAt           DateTime     @updatedAt
}

model ShopKycDoc {
  id          String     @id @default(uuid())
  shopId      String
  shop        Shop       @relation(fields: [shopId], references: [id])
  docType     KycDocType
  docNumber   String?    // encrypted
  expiryDate  DateTime?
  fileKeys    String[]   // S3 keys
  isExempt    Boolean    @default(false)  // e.g., GST exempt
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  @@index([shopId])
}

// ─── PRODUCTS ──────────────────────────────────────────────────────────────────
model Product {
  id                String   @id @default(uuid())
  shopId            String
  shop              Shop     @relation(fields: [shopId], references: [id])
  categoryId        String?
  name              String
  description       String?
  mrpPrice          Float
  sellingPrice      Float
  unit              String   @default("piece")  // piece, kg, litre, pack
  quantityPerUnit   String?  // e.g., "500g", "1L"
  stockQuantity     Int      @default(0)
  lowStockThreshold Int      @default(5)
  imageKeys         String[] // S3 keys (up to 5)
  isActive          Boolean  @default(true)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  cartItems   CartItem[]
  orderItems  OrderItem[]

  @@index([shopId])
  @@index([isActive])
  @@index([stockQuantity])
}

// ─── CART ──────────────────────────────────────────────────────────────────────
model Cart {
  id            String     @id @default(uuid())
  customerId    String     @unique  // one cart per customer
  shopId        String
  shop          Shop       @relation(fields: [shopId])
  expiresAt     DateTime   // 24h from last activity
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt

  items         CartItem[]
}

model CartItem {
  id        String   @id @default(uuid())
  cartId    String
  cart      Cart     @relation(fields: [cartId], references: [id])
  productId String
  product   Product  @relation(fields: [productId], references: [id])
  quantity  Int
  priceSnap Float    // price at time of add-to-cart (for change detection)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([cartId, productId])
  @@index([cartId])
}

// ─── ORDERS ────────────────────────────────────────────────────────────────────
model Order {
  id                  String      @id @default(uuid())
  orderNumber         String      @unique  // human-readable: ORD-2026-XXXX
  customerId          String
  customer            User        @relation(fields: [customerId], references: [id])
  shopId              String
  shop                Shop        @relation(fields: [shopId], references: [id])
  deliveryStaffId     String?
  deliveryStaff       ShopDeliveryStaff? @relation(fields: [deliveryStaffId], references: [id])

  status              OrderStatus @default(payment_pending)

  // Delivery address snapshot (copied at order time, not referenced)
  deliveryAddressLine1 String
  deliveryArea        String
  deliveryCity        String
  deliveryPincode     String
  deliveryLat         Float
  deliveryLng         Float

  // Pricing snapshot at order time
  cartSubtotal        Float
  deliveryCharge      Float
  discount            Float       @default(0)
  totalAmount         Float

  // Timing
  estimatedDeliverySlot Json?    // { label, openAt, closeAt }
  estimatedDeliveryAt   DateTime?
  confirmedAt         DateTime?
  preparingAt         DateTime?
  dispatchedAt        DateTime?
  deliveredAt         DateTime?
  cancelledAt         DateTime?
  cancelReason        String?
  cancelledBy         String?    // 'customer' | 'shop' | 'system' | 'admin'

  isPaid              Boolean    @default(false)
  isSettled           Boolean    @default(false)

  shopNote            String?    // shop's note to customer

  createdAt           DateTime   @default(now())
  updatedAt           DateTime   @updatedAt

  items               OrderItem[]
  payment             Payment?
  settlement          Settlement?
  rating              OrderRating?
  auditLogs           OrderAuditLog[]

  @@index([customerId])
  @@index([shopId])
  @@index([deliveryStaffId])
  @@index([status])
  @@index([orderNumber])
  @@index([createdAt])
}

model OrderItem {
  id          String  @id @default(uuid())
  orderId     String
  order       Order   @relation(fields: [orderId], references: [id])
  productId   String
  product     Product @relation(fields: [productId], references: [id])
  productName String  // snapshot at order time
  quantity    Int
  unitPrice   Float   // snapshot at order time
  subtotal    Float

  @@index([orderId])
}

model OrderAuditLog {
  id          String      @id @default(uuid())
  orderId     String
  order       Order       @relation(fields: [orderId], references: [id])
  actorId     String?
  actorRole   UserRole?
  event       String
  oldStatus   OrderStatus?
  newStatus   OrderStatus?
  metadata    Json?
  ip          String?
  createdAt   DateTime    @default(now())

  @@index([orderId])
  @@index([createdAt])
}

model OrderRating {
  id            String   @id @default(uuid())
  orderId       String   @unique
  order         Order    @relation(fields: [orderId], references: [id])
  customerId    String
  shopRating    Int      // 1-5
  deliveryRating Int?    // 1-5
  comment       String?
  createdAt     DateTime @default(now())
}

// ─── SERVICE JOBS (from v2.0, carried forward) ────────────────────────────────
model Job {
  id              String    @id @default(uuid())
  customerId      String
  customer        User      @relation("CustomerJobs", fields: [customerId], references: [id])
  providerId      String?
  provider        User?     @relation("ProviderJobs", fields: [providerId], references: [id])
  shopId          String?
  shop            Shop?     @relation(fields: [shopId], references: [id])
  categoryId      String
  catalogItemId   String?
  catalogItem     CatalogItem? @relation(fields: [catalogItemId], references: [id])
  status          JobStatus @default(open)
  description     String
  mediaKeys       String[]
  completionNote  String?
  completionMediaKeys String[]
  addressLine1    String
  area            String
  city            String
  pincode         String
  locationLat     Float
  locationLng     Float
  scheduledAt     DateTime?
  acceptedAt      DateTime?
  enRouteAt       DateTime?
  arrivedAt       DateTime?
  completedAt     DateTime?
  paidAt          DateTime?
  cancelledAt     DateTime?
  cancelReason    String?
  acceptedQuoteId String?
  finalAmount     Float?
  isPaid          Boolean   @default(false)
  isSettled       Boolean   @default(false)
  quoteDeadlineAt DateTime
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  quotes          Quote[]
  payment         Payment?
  settlement      Settlement?
  rating          JobRating?
  auditLogs       JobAuditLog[]

  @@index([customerId, status])
  @@index([providerId, status])
  @@index([categoryId])
  @@index([city, status])
  @@index([createdAt])
}

model JobAuditLog {
  id          String     @id @default(uuid())
  jobId       String
  job         Job        @relation(fields: [jobId], references: [id])
  actorId     String?
  actorRole   UserRole?
  event       String
  oldStatus   JobStatus?
  newStatus   JobStatus?
  metadata    Json?
  ip          String?
  createdAt   DateTime   @default(now())

  @@index([jobId, createdAt])
}

model Quote {
  id               String      @id @default(uuid())
  jobId            String
  job              Job         @relation(fields: [jobId], references: [id])
  providerId       String
  price            Float
  currency         String      @default("INR")
  estimatedMinutes Int
  note             String?
  status           QuoteStatus @default(pending)
  expiresAt        DateTime
  createdAt        DateTime    @default(now())
  updatedAt        DateTime    @updatedAt

  @@unique([jobId, providerId])
  @@index([jobId, status])
}

model JobRating {
  id        String   @id @default(uuid())
  jobId     String   @unique
  job       Job      @relation(fields: [jobId], references: [id])
  raterId   String
  rater     User     @relation(fields: [raterId], references: [id])
  rating    Int
  comment   String?
  createdAt DateTime @default(now())
}

// ─── WALLET & PAYMENTS ─────────────────────────────────────────────────────────
model Wallet {
  id                 String   @id @default(uuid())
  userId             String?  @unique
  user               User?    @relation(fields: [userId], references: [id])
  shopId             String?  @unique
  shop               Shop?    @relation(fields: [shopId], references: [id])
  balance            Float    @default(0)
  pendingSettlement  Float    @default(0)
  currency           String   @default("INR")
  updatedAt          DateTime @updatedAt

  transactions  WalletTransaction[]
  withdrawals   Withdrawal[]
}

model WalletTransaction {
  id           String            @id @default(uuid())
  walletId     String
  wallet       Wallet            @relation(fields: [walletId], references: [id])
  type         TransactionType
  amount       Float
  balanceAfter Float
  status       TransactionStatus @default(success)
  referenceId  String            @unique
  description  String?
  metadata     Json?
  createdAt    DateTime          @default(now())

  @@index([walletId, createdAt])
  @@index([referenceId])
}

model Withdrawal {
  id               String         @id @default(uuid())
  walletId         String
  wallet           Wallet         @relation(fields: [walletId], references: [id])
  amount           Float
  currency         String         @default("INR")
  withdrawTo       String
  accountId        String
  status           WithdrawStatus @default(pending)
  razorpayPayoutId String?
  failureReason    String?
  requestedAt      DateTime       @default(now())
  processedAt      DateTime?

  @@index([walletId, status])
}

model Payment {
  id                  String        @id @default(uuid())
  jobId               String?       @unique
  job                 Job?          @relation(fields: [jobId], references: [id])
  orderId             String?       @unique
  order               Order?        @relation(fields: [orderId], references: [id])
  razorpayOrderId     String        @unique
  razorpayPaymentId   String?
  amount              Float
  currency            String        @default("INR")
  status              PaymentStatus @default(pending)
  paidAt              DateTime?
  refundedAt          DateTime?
  refundAmount        Float?
  webhookIds          String[]
  createdAt           DateTime      @default(now())
  updatedAt           DateTime      @updatedAt

  @@index([razorpayOrderId])
  @@index([status])
}

model Settlement {
  id               String          @id @default(uuid())
  type             SettlementType
  jobId            String?         @unique
  job              Job?            @relation(fields: [jobId], references: [id])
  orderId          String?         @unique
  order            Order?          @relation(fields: [orderId], references: [id])
  workerId         String?
  shopId           String?
  totalAmount      Float
  platformCom      Float
  shopCom          Float           @default(0)
  workerEarning    Float           @default(0)
  shopEarning      Float           @default(0)
  status           SettlementStatus @default(pending)
  settledAt        DateTime?
  settledBy        String?
  note             String?
  createdAt        DateTime        @default(now())

  @@index([status])
  @@index([shopId])
  @@index([workerId])
}

// ─── BANK / UPI ACCOUNTS ───────────────────────────────────────────────────────
model BankAccount {
  id            String   @id @default(uuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id])
  accountHolder String
  accountNumber String
  ifscCode      String
  bankName      String
  isVerified    Boolean  @default(false)
  isDefault     Boolean  @default(false)
  createdAt     DateTime @default(now())

  @@index([userId])
}

model UpiAccount {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  upiId     String
  name      String
  isDefault Boolean  @default(false)
  createdAt DateTime @default(now())

  @@index([userId])
}

// ─── MEDIA ─────────────────────────────────────────────────────────────────────
model MediaFile {
  id          String       @id @default(uuid())
  uploadedBy  String
  fileKey     String       @unique
  cdnUrl      String?
  mimeType    String
  sizeBytes   Int
  context     MediaContext
  entityId    String?
  isConfirmed Boolean      @default(false)
  createdAt   DateTime     @default(now())

  @@index([entityId, context])
}

// ─── AUDIT & CONFIG ────────────────────────────────────────────────────────────
model AuditLog {
  id          String    @id @default(uuid())
  actorId     String?
  actor       User?     @relation(fields: [actorId], references: [id])
  actorRole   UserRole?
  action      String
  targetType  String?
  targetId    String?
  oldValue    Json?
  newValue    Json?
  ip          String?
  userAgent   String?
  requestId   String?
  createdAt   DateTime  @default(now())

  @@index([action])
  @@index([targetType, targetId])
  @@index([createdAt])
}

model PlatformConfig {
  id                          String   @id @default("singleton")
  // Services
  serviceCommissionPct        Float    @default(10)
  shopServiceCommissionPct    Float    @default(5)
  initialRadiusKm             Int      @default(10)
  expandRadius2Km             Int      @default(20)
  expandRadius3Km             Int      @default(50)
  radiusExpansionDelayMin     Int      @default(5)
  quoteWindowMinutes          Int      @default(30)
  workerMinWalletBalance      Float    @default(100)
  // Orders
  orderCommissionPct          Float    @default(10)
  shopAutoRejectMinutes       Int      @default(30)
  maxDeliveryRadiusKm         Float    @default(50)
  deliveryOtpMaxAttempts      Int      @default(5)
  cartExpiryHours             Int      @default(24)
  settlementSlaHours          Int      @default(48)
  // Subscriptions
  freeTrialDays               Int      @default(180)
  freeMonthlyQuoteLimit       Int      @default(5)
  freeMonthlyOrderLimit       Int      @default(20)
  // Auth
  otpExpirySeconds            Int      @default(300)
  maxLoginAttempts            Int      @default(10)
  loginLockoutMinutes         Int      @default(30)
  // Wallet
  minWithdrawalAmount         Float    @default(100)
  maxWithdrawalAmount         Float    @default(50000)
  updatedAt                   DateTime @updatedAt
  updatedBy                   String?
}

model ShopInvite {
  id         String       @id @default(uuid())
  shopId     String
  shop       Shop         @relation(fields: [shopId], references: [id])
  phone      String
  inviteType String       @default("worker")  // 'worker' | 'delivery_boy'
  status     InviteStatus @default(pending)
  expiresAt  DateTime
  createdAt  DateTime     @default(now())

  @@index([shopId, inviteType])
  @@index([phone])
}
```

---

## 10. Pricing & Charge Calculation Engine

All pricing computed **server-side only** — never trust client-sent totals.

```typescript
// Called at: add-to-cart, cart view, checkout
function calculateOrderPricing(
  items: CartItem[],
  config: ShopDeliveryConfig
): OrderPricing {

  // Step 1: Subtotal from current DB prices (NOT cart snapshots)
  const cartSubtotal = items.reduce(
    (sum, item) => sum + (item.product.sellingPrice * item.quantity), 0
  );

  // Step 2: Block if below minimum order
  if (cartSubtotal < config.minOrderAmount) {
    throw new AppError(422, `Minimum order amount is ₹${config.minOrderAmount}`, 'ORDER_BELOW_MINIMUM');
  }

  // Step 3: Delivery charge (based on raw subtotal, before discount)
  let deliveryCharge = 0;
  if (!config.freeDeliveryAbove || cartSubtotal < config.freeDeliveryAbove) {
    deliveryCharge = config.deliveryCharge;
  }

  // Step 4: Discount (applied AFTER delivery charge is determined)
  let discount = 0;
  if (config.discountEnabled && config.discountAbove && cartSubtotal >= config.discountAbove) {
    if (config.discountType === 'flat') {
      discount = config.discountValue;
    } else {
      discount = (cartSubtotal * config.discountPct) / 100;
    }
    // Apply cap
    if (config.maxDiscountCap && discount > config.maxDiscountCap) {
      discount = config.maxDiscountCap;
    }
  }

  // Step 5: Final total
  const totalAmount = cartSubtotal + deliveryCharge - discount;

  return { cartSubtotal, deliveryCharge, discount, totalAmount };
}
```

**Price Change Detection at Checkout**:
```typescript
// Compare current DB price vs price snapshot in cart
const priceChanges = items.filter(item =>
  item.priceSnap !== item.product.sellingPrice
);
if (priceChanges.length > 0) {
  // Return 409 with changed items → customer must confirm
  throw new PriceChangedError(priceChanges);
}
```

---

## 11. Geo-Radius Expansion & Notification Engine

*(Service jobs only — product delivery uses shop delivery radius config)*

```
Service Job Posted by Customer
         │
         ▼
BullMQ: notification-worker enqueued
  { jobId, categoryId, lat, lng, radiusKm: 10, attempt: 1 }
         │
         ▼
Worker eligibility filter:
  1. categoryIds includes job.categoryId
  2. wallet.balance >= platformConfig.workerMinWalletBalance
  3. subscription.isActive = true AND (tier != free_trial OR quotesUsed < limit)
  4. workerProfile.isOnline = true
  5. not currently assigned to active job
  6. workerProfile.lastLocationAt within 60 seconds (location is fresh)
         │
         ▼
Geo query: Redis GEORADIUS workers:online:{categoryId}
  (keyed by category for faster lookups)
         │
         ├── Workers found → Sort by subscription priority:
         │     Group 1 (Premium: annual/9month/half-yearly) → FCM push now
         │     Group 2 (Basic: quarterly/monthly) → FCM push after 2 min
         │     Group 3 (Free Trial) → FCM push after 5 min
         │
         └── No workers → expand radius:
               10km → wait 5min → 20km → wait 5min → 50km → wait 5min
               If still 0: job.status = 'no_workers'; notify customer
```

**Product Delivery Notification** (separate from service):
```
Order confirmed → shop_owner gets push notification immediately
  No geo-radius expansion needed (shop already fixed location)
  Delivery boy assigned by shop owner manually
```

---

## 12. Media Upload Architecture

*(Unchanged from v2.0 — S3 pre-signed URL direct upload)*

```
Client → POST /media/upload-url { context, files[] }
       ← { uploads: [{ uploadUrl, fileKey, expiresIn: 900 }] }

Client → PUT {uploadUrl} (direct S3 upload)

Client → POST /media/confirm { fileKeys }
       ← { files: [{ fileKey, cdnUrl }] }
```

**S3 Structure**:
```
kwickly-media/
  ├── jobs/{jobId}/photo-{uuid}.jpg
  ├── jobs/{jobId}/completion/{uuid}.mp4
  ├── shops/{shopId}/logo.jpg
  ├── shops/{shopId}/banner.jpg
  ├── shops/{shopId}/kyc/licence-front.pdf
  ├── shops/{shopId}/kyc/gst-cert.pdf
  ├── products/{shopId}/{productId}/{uuid}.jpg
  ├── profiles/{userId}/photo.jpg
  └── id-docs/{userId}/aadhaar-front.jpg
```

KYC docs = **private S3 objects** (no public access, served via signed URLs to admin only)
Product images + shop logos + job photos = **public S3 objects** (via CloudFront CDN)

---

## 13. Real-Time Architecture

### Socket.IO Rooms
| Room | Members | Events |
|------|---------|--------|
| `job:{jobId}` | Customer + assigned Worker | `worker:location`, `job:status_changed`, `job:new_quote` |
| `order:{orderId}` | Customer + Delivery Boy + Shop | `order:status_changed`, `delivery:location` |
| `worker:{workerId}` | Worker | `job:assigned`, `quote:accepted`, `job:taken` |
| `shop:{shopId}` | Shop Owner | `order:new`, `delivery_boy:status` |
| `admin` | Admins | `stats:update`, `kyc:new`, `settlement:new` |

### Key Socket Events
```typescript
// Service (Job)
'job:new_quote'       → customer: { quote, worker }
'quote:accepted'      → worker: { job, customerAddress, customerPhone }
'job:taken'           → other workers: { jobId }
'worker:location'     → customer: { lat, lng, etaMinutes }

// Product (Order)
'order:new'           → shop_owner: { order }
'order:status_changed'→ customer: { orderId, newStatus, estimatedDeliveryAt }
'delivery:location'   → customer: { lat, lng, etaMinutes }

// Admin
'stats:update'        → admin: { activeJobs, onlineWorkers, ordersToday }
'kyc:submitted'       → admin: { shopId, shopName }
'settlement:pending'  → admin: { count, totalAmount }
```

---

## 14. Error Handling Strategy

*(Unchanged from v2.0 — standard error envelope with `code`, `error`, `requestId`)*

Additional error codes:
| Code | HTTP | Trigger |
|------|------|---------|
| `CART_SHOP_CONFLICT` | 409 | Adding product from different shop |
| `CART_OUTSIDE_RADIUS` | 422 | Customer address outside delivery radius |
| `CART_OUT_OF_STOCK` | 422 | Product not in stock |
| `ORDER_BELOW_MINIMUM` | 422 | Order value below shop minimum |
| `ORDER_SHOP_CLOSED` | 422 | Order placed outside shop hours |
| `ORDER_PRICE_CHANGED` | 409 | Product price changed since cart add |
| `DELIVERY_OTP_INVALID` | 401 | Wrong delivery OTP |
| `DELIVERY_OTP_MAX_ATTEMPTS` | 423 | Max wrong OTP attempts reached |
| `DELIVERY_BOY_BUSY` | 409 | Delivery boy already on active delivery |
| `SHOP_KYC_NOT_APPROVED` | 403 | Shop not yet approved |
| `SUBSCRIPTION_INACTIVE` | 403 | No active subscription |
| `SUBSCRIPTION_QUOTA_EXCEEDED` | 422 | Free tier limit reached |

---

## 15. Audit Logging Specification

Additional events for v3.0:
| Action | Trigger |
|--------|---------|
| `shop.kyc_submitted` | Shop owner completes KYC |
| `shop.kyc_approved` | Admin approves |
| `shop.kyc_rejected` | Admin rejects with reason |
| `product.created` | Shop adds product |
| `product.stock_updated` | Stock changed |
| `product.out_of_stock` | Stock hits 0 (auto) |
| `order.placed` | Customer creates order |
| `order.payment_captured` | Razorpay confirms |
| `order.confirmed` | Shop accepts |
| `order.rejected` | Shop rejects |
| `order.auto_cancelled` | 30-min timeout |
| `order.dispatched` | Delivery boy assigned |
| `order.delivery_otp_failed` | Wrong OTP attempt |
| `order.delivered` | OTP verified |
| `order.refunded` | Admin refund |
| `subscription.purchased` | User buys plan |
| `subscription.granted` | Admin manual grant |
| `subscription.expired` | Plan expired |

---

## 16. Security Requirements

*(Inherits all from v2.0 plus)*:
- KYC documents stored in **private S3** — accessible only via admin-generated signed URLs (valid 15 min)
- KYC document numbers (GST, licence) encrypted at rest (AES-256)
- Delivery OTP: max 5 wrong attempts → admin alert + manual verification lock
- Cart pricing: all totals **always recalculated server-side**; client-sent amounts ignored
- Shop status validation on every order: blocked if not `approved`
- Subscription validation on every quote/order: blocked if expired or limit exceeded
- Admin settlement: idempotent (referenceId prevents double credit)

---

## 17. Performance & Scale Targets

*(Inherits all from v2.0 plus)*:
| Operation | Target p50 | Target p99 |
|-----------|-----------|-----------|
| Add to cart (with all validations) | 30ms | 100ms |
| Checkout pricing calculation | 20ms | 80ms |
| Order placement | 50ms | 200ms |
| Product list (cached) | 5ms | 20ms |
| Delivery tracking (Socket.IO) | < 1s | < 2s |

---

## 18. API Standards

*(Unchanged from v2.0 — standard headers, pagination, datetime, file structure)*

### Implementation Order (Updated)

```
Phase 1:  Prisma schema + migrations + S3 buckets + Redis structures
Phase 2:  Core middleware (JWT, validate, rateLimit, requestId, logger, audit)
Phase 3:  Auth module — register, login, forgot password
Phase 4:  Users module — profile, location, bank/UPI
Phase 5:  Media module — S3 pre-signed upload + confirm
Phase 6:  Subscription plans — admin CRUD + purchase + webhook
Phase 7:  Catalog + Shops (service items) — with KYC flow
Phase 8:  Shop delivery config + Products
Phase 9:  Cart module
Phase 10: Service Jobs + Quotes — full state machine + arrival OTP
Phase 11: Orders — full state machine + delivery OTP + pricing engine
Phase 12: Notification + Geo-radius engine (BullMQ)
Phase 13: Wallet + Payments (Razorpay orders + webhooks + refunds)
Phase 14: Admin module — KYC, settlement, user mgmt, config
Phase 15: Socket.IO real-time (jobs, orders, delivery tracking)
Phase 16: BullMQ workers (dispatch, notification, payment, cart-expiry, sub-expiry)
Phase 17: Testing, hardening, load testing to 50k users
```

---

> **Document Status**: v3.0 — READY FOR IMPLEMENTATION
> *Previous v2.0 auto-dispatch replaced with marketplace model.*
> *v3.0 adds: shop onboarding with KYC, product delivery, admin-configured subscriptions, delivery boy role, 20 loopholes resolved.*
