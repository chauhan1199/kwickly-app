# Kwickly Platform Flow Analysis

## 1. System Architecture Overview
The Kwickly platform is built using a modern 3-tier architecture:
- **Backend API**: Node.js + Express with MongoDB (Mongoose) for primary data storage, Redis for caching, and Socket.io for real-time communication.
- **Admin Panel**: React.js based web application for platform operators.
- **Mobile App**: React Native application for Customers, Workers, and Shop Owners.

## 2. Authentication & User Management Flow

### 2.1 Core Concepts
Authentication is role-based and relies on JSON Web Tokens (JWT) stored with session data in Redis to reduce database hits.
The platform supports 4 main roles stored in the single `Customer` model:
- `CUSTOMER`
- `WORKER`
- `ADMIN`
- `SHOP`

The key constraint is that `[phone, role]` and `[email, role]` pairings are strictly unique. A user can be both a Customer and a Worker, but these are maintained as separate account entities in the DB based on the `role` field.

### 2.2 OTP Based Registration/Login (Mobile/Customer & Worker)
The primary method of authentication for mobile users is via Phone Number and OTP.

1. **OTP Request (`POST /api/v1/auth/send-otp`)**
   - User submits their `phone`.
   - The backend checks Redis for rate limiting (max 5 attempts per hour).
   - If allowed, it triggers `smsService.sendOTP(phone)`.
   - The generated OTP is stored in Redis under the key `otp:{phone}` with a 5-minute TTL.
   - *Dev Note: In non-production environments, the OTP is emitted via Socket.io (`OTP_SENT`) for easier testing.*

2. **OTP Verification (`POST /api/v1/auth/verify-otp`)**
   - User submits `phone`, `code`, and `role`.
   - Backend compares the code with `otp:{phone}` in Redis.
   - If valid, the DB is queried for an existing user with `{phone, role}`.
   - If no user exists, a **new account is created** with `isVerified: true`.
   - A JWT is generated (`expiresIn: 30d`).
   - The user session object is serialized and cached in Redis under `session:{user._id}` (24h TTL) to speed up future requests.
   - The API returns the token and an `isNew` flag indicating if the profile needs completion (e.g., missing name).

### 2.3 Email/Password Based Login (Admin)
While Customers and Workers primarily use OTP, Admins (and potentially users with configured passwords) can use standard password authentication.

1. **Login Request (`POST /api/v1/auth/login`)**
   - User submits `email` (or `phone`), `password`, and `role`.
   - Backend queries DB for the user and selects the `+password` field.
   - `bcrypt.compare` validates the hash.
   - If valid, a JWT is issued and the session is cached in Redis similarly to OTP verification.

### 2.4 Worker KYC and Approval Flow
Workers cannot immediately accept jobs upon registration; they must pass KYC.
1. **Document Upload (`POST /api/v1/workers/me/kyc`)**
   - The worker uploads documents (AADHAR, PAN, etc.) via `multer` middleware.
   - The DB updates the worker's `kyc.documents` array and sets `kyc.status = 'PENDING'`.
2. **Admin Review (`PATCH /api/v1/admin/workers/:id/kyc`)**
   - Admins fetch pending workers from the Dashboard.
   - Admin approves/rejects the KYC, updating `kyc.status` to `APPROVED` or `REJECTED`.
   - Only workers with `APPROVED` KYC, an active subscription, and minimum wallet balance can participate in the quoting system.

### 2.5 Security and Logout
- **Logout (`POST /api/v1/auth/logout`)**: The JWT is blacklisted in Redis (`blacklist:{token}`) until its natural expiration, and the `session:{user._id}` cache is cleared.

## 3. Core Booking and Execution Flow (Deep Technical)

The core mechanic of Kwickly relies heavily on a real-time negotiation flow between Customers and Workers, powered by Socket.io and strictly guarded state machines in Mongoose.

### 3.1 Job Creation & Broadcasting (Customer)
1. **Request (`POST /api/v1/jobs`)**: The customer creates a job, providing `category`, `location` (GeoJSON Point), and `timeSlot`.
2. **Initial State**: The job is created in the DB with `status = 'BROADCASTING'` and `payment.status = 'PENDING'`.
3. **Geospatial Filtering**: The backend queries the `Customer` collection for active workers near the job location using `$geoNear` or `$geoWithin` based on the system's `serviceRadius`.
   - **Guards**: The worker must be `role: 'WORKER'`, `isOnline: true`, `kyc.status: 'APPROVED'`, have a valid `subscription`, and possess a minimum wallet balance.
4. **Real-Time Notification**: The backend triggers a socket emission (`JOB_BROADCAST`) only to the eligible workers within the radius.

### 3.2 Bidding / Quoting (Worker)
1. **Request (`POST /api/v1/quotes`)**: An eligible worker submits a quote (`amount`, `timeToReach`) for the `jobId`.
2. **Guards**:
   - A worker cannot quote on their own job (`workerId !== customerId`).
   - The job `status` must be `BROADCASTING` or `QUOTES_RECEIVED`.
   - The worker must have enough wallet balance (checked against `app_settings` in Redis).
3. **Job State Update**: The job status is updated to `QUOTES_RECEIVED` if it was `BROADCASTING`.
4. **Notification**: The customer is notified via socket (`NEW_QUOTE`) that a worker has bid on their job.

### 3.3 Quote Acceptance & Allocation (Customer)
1. **Request (`PATCH /api/v1/quotes/:id/accept`)**: The customer accepts a specific quote.
2. **Atomic Allocation Guard**: To prevent race conditions where multiple requests might try to accept different quotes simultaneously, Mongoose uses `findOneAndUpdate` with a query constraint: `{ _id: job._id, status: { $in: ['BROADCASTING', 'QUOTES_RECEIVED'] } }`.
3. **Security OTP Generation**: Two random 4-digit OTPs are generated: `arrivalOtp` and `completionOtp`.
4. **State Change**:
   - The Job `status` changes to `ALLOCATED`.
   - The Job `workerId` is populated.
   - The accepted Quote `status` changes to `ACCEPTED`.
   - All other pending quotes for the job are bulk updated to `status = 'REJECTED'`.
5. **Notifications**:
   - The assigned worker receives `QUOTE_ACCEPTED` with the `arrivalOtp` and full address.
   - Other workers listening in the `job_{jobId}` room receive `JOB_TAKEN`.

### 3.4 Job Execution (Worker)
1. **Arrival & Start (`POST /api/v1/jobs/:id/start`)**:
   - The worker arrives at the location and asks the customer for the `arrivalOtp`.
   - The API verifies `arrivalOtp` matches `job.security.arrivalOtp`.
   - Job `status` moves to `IN_PROGRESS`.
   - Socket `JOB_STARTED` is emitted to the customer.
2. **Completion (`POST /api/v1/jobs/:id/complete`)**:
   - The worker finishes the job and uploads proof (images/video).
   - The API updates `status` to `COMPLETED` and saves `completionDetails.media`.
   - Socket `JOB_COMPLETED` is emitted to the customer.

## 4. Payment, Wallet, and Admin Settlement Flow

The platform handles real-money transactions, demanding strict consistency. It enforces this using Mongoose transactions (`session.withTransaction`) for all operations involving money movement.

### 4.1 Payment for Jobs (`POST /api/v1/jobs/:id/pay`)
The Customer pays for the job after completion using one of two methods:

#### Method 1: CASH
- The Customer physically hands cash to the Worker.
- The system must deduct its platform commission from the Worker's digital wallet.
- **Mongoose Transaction**:
  1. Calculate `platformFee` based on `app_settings` (fixed or percentage).
  2. Deduct `platformFee` from the Worker's `wallet.balance`.
     - *Edge Case*: If the worker's wallet lacks sufficient funds, the balance goes negative (debt).
  3. Create a `JOB_DEBIT` entry in `WalletTxn`.
  4. The platform transfers this fee to the `AdminWallet` via `collectPlatformFee()`.

#### Method 2: ONLINE (e.g., Razorpay)
- The Customer pays via the platform.
- The platform deducts its commission and credits the rest to the Worker's digital wallet.
- **Mongoose Transaction**:
  1. Calculate `workerPayout = jobAmount - platformFee`.
  2. Credit `workerPayout` to the Worker's `wallet.balance`.
  3. Create a `JOB_CREDIT` entry in `WalletTxn`.
  4. Transfer the `platformFee` to the `AdminWallet`.

### 4.2 Payouts & Settlements (`payout.controller.js`)
Workers and Shops cannot withdraw cash directly; they must request a payout.

1. **Request**: Worker requests a payout. The requested amount is immediately deducted from their `wallet.balance` to prevent double-spending, and a `Payout` document is created with status `PENDING`.
2. **Admin Processing**:
   - Admin views `PENDING` payouts via the Admin panel.
   - Admin physically/manually transfers money using bank details (`accountNumber`, `ifscCode`) stored on the Worker's profile.
   - Admin calls `PATCH /api/v1/admin/payouts/:id/status` setting status to `PROCESSED` (logging the external `txnId`) or `REJECTED`.
3. **Rejection Handling**: If a payout is `REJECTED`, a Mongoose transaction reverses the deduction, refunding the amount to the Worker's `wallet.balance` and generating a `PAYOUT_REFUND` WalletTxn.

### 4.3 The Admin Wallet (`adminWallet.controller.js`)
The `AdminWallet` is a separate singleton document that tracks the platform's overall revenue (commissions from jobs, shop orders, and subscriptions). It records entries in `AdminWalletTxn` (e.g., `PLATFORM_FEE`, `SUBSCRIPTION`, `COMMISSION`).
