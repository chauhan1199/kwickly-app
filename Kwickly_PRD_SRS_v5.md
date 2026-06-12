# KWICKLY - On-Demand Home Services Platform
## Complete Product Requirements Document (PRD) & Software Requirements Specification (SRS)

**Version:** 5.0
**Date:** June 2026

---

## 1. Introduction

### 1.1 Purpose
This comprehensive Product Requirements Document (PRD) and Software Requirements Specification (SRS) defines the complete workflows, functional requirements, and technical architecture for the Kwickly platform. It covers all four primary actors: **Customer**, **Worker**, **Shop**, and **Admin**.

### 1.2 Product Overview
Kwickly is a hyper-local, on-demand home services and parts platform. It connects Customers with skilled Workers (plumbers, electricians, etc.) via an expanding-radius broadcasting system. Additionally, it integrates local **Shops** to supply spare parts and materials required for jobs, directly to Workers or Customers. The platform manages job booking, real-time tracking, OTP verifications, B2B/B2C material purchases, and UPI-based payments via Razorpay with automated platform commission splitting.

---

## 2. User Roles & Personas

| Role | Description | Primary Interface |
|---|---|---|
| **Customer** | End user who discovers, books, tracks, and pays for home services. Can also purchase spare parts from local Shops. | Mobile App (Customer Flow) |
| **Worker** | Skilled service provider who receives job alerts, submits quotes, travels to site, and completes jobs. Needs to buy materials from Shops. | Mobile App (Worker Flow) |
| **Shop (Vendor)** | Local business (e.g., hardware store) that registers to sell parts/materials to Workers or Customers for job completion. | Mobile (Shop Module) |
| **Admin** | Platform operator who manages users, verifications (KYC), categories, disputes, payments, and dynamic platform settings. | Admin Web Panel | also handel all the functionality behalf of customer, worker and shop, without any app update |

---

## 3. Detailed Workflows

### 3.1 Customer Workflow

#### 3.1.1 Authentication & Onboarding
- **Login/Register:** Enter 10-digit mobile number → Verify 6-digit OTP (SMS/WhatsApp) → Setup Password.
- **Profile:** Set up basic info (Name, Email) and manage Saved Addresses (Home, Office).

#### 3.1.2 Job Booking & Worker Selection
- **Select Service:** Browse categories (Plumbing, Electrical, etc.) and specify the issue (text/photo /video).
- **Address & Priority:** Select address and set priority (Urgent, Same Day, Flexible).
- **Wait for Quotes:** System broadcasts request to Workers in an expanding radius (5km → 50km).
- **Review Quotes:** View incoming bids in real-time (Worker name, rating, price, ETA).
- **Acceptance:** Customer accepts a quote; other quotes are discarded.

#### 3.1.3 Job Tracking & Execution
- **Tracking:** View Worker's real-time location and ETA on the map.
- **Arrival Verification:** Share 6-digit **Arrival OTP** with Worker upon physical arrival.
- **Job Completion:** Once fixed, the Worker will updaload photo/video of the issue, before and after the repair and provides a **Completion OTP** to the Customer.

#### 3.1.4 Payment & Review
- **Payment:** Pay the final bill after seeing photo/video of the issue, before and after the repair via Razorpay (UPI, QR code). The bill includes Worker charge + Platform fee + (Optional) Shop Materials.
- **Rating:** Rate the Worker (1-5 stars) and provide optional feedback.

---

### 3.2 Worker Workflow

#### 3.2.1 Onboarding & Wallet
- **Registration & KYC:** Submit Aadhaar, PAN, Selfie, and select Service Categories. Wait for Admin approval.
- **Wallet Model:** Start with 90-day Free Trial. Post-trial, maintain a minimum wallet balance of Rs. 100 to receive job alerts. Options to subscribe to Monthly/Annual plans.

#### 3.2.2 Job Alerts & Quoting
- **Job Alerts:** Receive push notifications for jobs in the area based on radius matching.
- **Quoting:** Review job details and submit a Quote (Price, ETA, Note) within 15 minutes.
- **Selection:** If the Customer accepts the quote, the job transitions to 'Active Job'.

#### 3.2.3 Job Execution & Material Sourcing
- **Navigation:** Use in-app map to navigate to Customer.
- **Arrival:** Enter the Customer's **Arrival OTP** to start work.
- **Material Sourcing (Integration with Shop):** If parts are needed, Worker can open the "Shop" tab, create a Material Request, and send it to local platform-registered Shops.
- **Completion:** Mark job outcome (Fixed/Partial). Generate **Completion OTP** for Customer.

---

### 3.3 Shop Workflow [NEW]

#### 3.3.1 Onboarding & Inventory
- **Registration:** Shop owner registers with business details (Shop Act License, GST, Address).
- **Category Selection:** Shop selects which categories of items they stock (e.g., Plumbing Spares, Electrical Wiring).
- **Dashboard:** Access order queue, daily revenue, and inventory catalog.

#### 3.3.2 Material Request Processing
- **Receiving Orders:** Receive a "Material Request" (B2B from Workers or B2C from Customers).
- **Quoting Price:** Shop owner reviews the requested list and submits a total price quote (including taxes).
- **Approval & Payment:** Once the Worker/Customer accepts and pays (via Razorpay), the order is confirmed.

#### 3.3.3 Fulfillment & Settlement
- **Fulfillment:** Shop prepares the items. Status updated to "Ready for Pickup". Worker/Customer arrives and verifies pickup with an **Order OTP**.
- **Settlement:** Razorpay automatically splits the payment: Shop receives the item price minus the Platform Commission.

---

### 3.4 Admin Workflow

#### 3.4.1 Real-Time Dashboard
- **Live Metrics:** View Active Users, Jobs Today, Revenue, Open Disputes.
- **Activity Feed:** Live Socket.io feed of platform events.

#### 3.4.2 User & KYC Management
- **Verification:** Review and Approve/Reject KYC docs for Workers and Shops (24-hour SLA).
- **User Moderation:** Suspend or ban fraudulent Customers, Workers, or Shops.

#### 3.4.3 Dynamic App Settings
- All platform rules are configured here and pushed instantly to apps via Socket.io without App Store updates.
- **Settings include:** Commission rates, Wallet minimums, Radius ranges, OTP validity, Subscription pricing.

#### 3.4.4 Job & Payment Management
- Monitor all jobs and material orders. Ability to force-cancel or re-assign jobs.
- View financial ledger and Razorpay payout statuses.

---

## 4. Technical Architecture

### 4.1 Codebases
1. **Backend API:** Node.js + Express + MongoDB + Socket.io + Redis.
2. **Mobile App:** React Native (Shared for Customer & Worker).
3. **Shop Web/App Module:** React.js / React Native interface for local vendors.
4. **Admin Web:** React.js + Tailwind CSS for operators.

### 4.2 API Namespaces
- `/api/customer/*` - Booking, tracking, payments.
- `/api/worker/*` - Quoting, wallet, active job execution.
- `/api/shop/*` - Order management, quoting materials.
- `/api/admin/*` - Protected management endpoints.
- `/api/app/settings` - Global singleton configuration cache.

### 4.3 Third-Party Integrations
- **Payments:** Razorpay (UPI/QR, Auto Route Split).
- **Real-Time:** Socket.io (Tracking, Quotes, Settings Sync).
- **Notifications:** Firebase Cloud Messaging (FCM).
- **Maps/Routing:** Google Maps API.

---

## 5. Database Schema (Key Entities)

- **Customer:** `user_id`, `name`, `mobile`, `addresses[]`
- **Worker:** `worker_id`, `categories[]`, `wallet_balance`, `kyc_status`, `is_online`
- **Shop (New):** `shop_id`, `name`, `address`, `inventory_categories[]`, `gst_number`, `kyc_status`, `is_active`
- **Job:** `job_id`, `customer_id`, `worker_id`, `status`, `arrival_otp`, `completion_otp`, `total_amount`
- **ShopOrder (New):** `order_id`, `shop_id`, `buyer_id` (worker or customer), `job_id` (optional), `items[]`, `total_price`, `status`, `pickup_otp`
- **AppSettings:** Singleton document containing all dynamic rules (commission, radius, subscriptions).

---

## 6. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Performance** | API response &lt; 2s under load; Real-time GPS tracking every 10 seconds. |
| **Availability** | 99.5% uptime SLA; Scheduled maintenance windows 02:00–04:00 IST. |
| **Security** | TLS 1.3; Bcrypt hashing; OTP verified endpoints; PCI-DSS compliant payments. |
| **Caching** | Redis layer for AppSettings, OTPs, GPS locations, and active job states to minimize DB load. |
| **Compliance** | KYC verification for Workers & Shops; India GST rules for vendor billing. |
