# Kwickly Platform Flow & Architecture

This document provides a comprehensive analysis of the Kwickly platform's system architecture, component interactions, business flows, and how the administrative backend controls and monitors the entire ecosystem.

## 1. High-Level Architecture & Tech Stack

The Kwickly platform is built on a modern, real-time, event-driven stack:

*   **Backend System**: Node.js & Express.
*   **Database**: MongoDB (Mongoose ORM). **Crucial**: Runs as a replica set to support transactions (`session.withTransaction`) which are strictly required for all wallet, payout, and order operations to guarantee financial integrity.
*   **Caching & Geospatial**: Redis. Used heavily for caching GET endpoint responses, storing user sessions, and crucially, geospatial indexing (`GEORADIUS`) to quickly find nearby workers and shops.
*   **Real-time Communication**: Socket.io. Powers cross-app, bi-directional real-time updates (e.g., live tracking, instant job quotes, status changes).
*   **Storage**: AWS S3 (or compatible). Used for dual-purpose storage: public buckets for profile/product images, and private, secure buckets for KYC documentation (accessed via signed URLs).
*   **Admin Frontend**: React.js (built with Vite), featuring a modern dark-mode, glassmorphism UI with micro-animations.
*   **Mobile Client**: React Native, utilizing standardized UI components, gracefully handling empty states, and incorporating native modules for geolocation and maps.

---

## 2. Platform Core Entities

The platform revolves around four primary actors:

1.  **Customers (Users)**: Request jobs, place shop orders, pay via in-app wallet.
2.  **Workers (Pros)**: Receive job requests, submit quotes, fulfill services, earn via wallet.
3.  **Shops (Merchants)**: List products/services, fulfill customer orders, manage inventory, earn via wallet.
4.  **Admins (Super Admin/Staff)**: Oversee the platform, verify KYC, resolve disputes, manage settlements/payouts, monitor system health.

---

## 3. Core Business Flows

### 3.1. The Service Job Flow (Customer & Worker)
This is the core booking business logic, heavily reliant on Redis (for matching) and Socket.io (for real-time signaling).

1.  **Job Request**: Customer creates a job request. Backend uses Redis geospatial data to find nearby, active workers matching the category.
2.  **Notification**: Socket.io broadcasts the job request to eligible workers.
3.  **Quoting**: Interested workers submit quotes (price + time).
4.  **Acceptance**: Customer reviews quotes and accepts one.
5.  **Fulfillment Lock**: Other quoting workers are notified (via Sockets) that the job is fulfilled.
6.  **Navigation & Arrival**: The accepted worker navigates to the location. Upon arrival, an OTP (One-Time Password) provided by the customer is entered by the worker to verify presence.
7.  **Work Execution**: Worker starts the job. Upon finishing, the worker is required to upload completion photo/video evidence.
8.  **Completion & Payment**: The job is marked complete. The backend executes an atomic MongoDB transaction to move funds from the Customer's wallet to the Worker's wallet (minus platform commissions).
9.  **Rating**: Customer rates the worker.

### 3.2. The Shop Order Flow (Customer & Shop)
1.  **Order Placement**: Customer browses a shop and places an order.
2.  **Notification**: Shop receives a real-time Socket.io notification of the new order.
3.  **Acceptance/Processing**: Shop accepts the order and prepares it.
4.  **Fulfillment**: Order is marked ready/delivered.
5.  **Payment Processing**: Atomic wallet transactions process the payment, transferring funds from Customer to Shop (minus commission).

---

## 4. Admin Panel Deep Dive & Visual Mapping

The React-based Admin panel provides comprehensive oversight. Here is how the visual modules map to the backend architecture:

### 4.1. Overview & Dashboards
*   **Dashboard**: Consolidates key metrics (Total Users, Workers, Shops, Platform Revenue, Pending KYCs). Driven by aggregated MongoDB queries and Redis caching for fast load times.

### 4.2. Entity Management
*   **Customers (`/users`)**: Lists all registered customers. Displays active/inactive states. Admin can view details, edit, or deactivate accounts.
*   **Workers (`/workers`)**: Displays workers, their KYC approval status, and real-time "Online" status (driven by Socket.io connections and Redis presence indicators). Shows aggregated stats (Total Workers, KYC Approved, Pending Review, Online Now).
*   **Shops (`/shops`)**: Similar to Workers, manages shop entities, their KYC status, wallet balances, and total orders.

### 4.3. Operations & Monitoring
*   **Jobs (`/jobs`)**: Real-time view of all service jobs. Tracks status transitions (Requested -> Quoted -> Accepted -> In Progress -> Completed -> Cancelled). Admins can view job details, assigned workers, and disputes.
*   **Orders (`/orders`)**: Monitors shop orders. Tracks fulfillment statuses.
*   **KYC Queue (`/kyc`)**: Dedicated workflow for verifying entity identities. Admins review submitted documents (fetched securely via S3 signed URLs) and approve/reject, changing the entity's platform capabilities.

### 4.4. Finance & Ledger
*   **Admin Wallet (`/admin-wallet`)**: Tracks the platform's retained earnings (commissions collected from jobs and orders).
*   **Settlements (`/settlements`) & Payouts**: Manages the flow of money out of the platform. Workers/Shops request payouts from their wallets. Admins review and process these (e.g., bank transfers).
*   **Ledger (`/ledger`)**: A master audit trail of all financial transactions across the platform. Every job payment, commission cut, and payout is logged here via immutable ledger entries in MongoDB.
*   **Disputes (`/disputes`)**: Interface for admins to resolve conflicts (e.g., job quality issues). Admins can view job completion evidence (photos/videos) and manually trigger refunds or wallet adjustments using secure backend endpoints.

### 4.5. Platform Settings
*   **Promotions & Banners (`/promotions`)**: Admins manage marketing banners and promo codes. Changes here instantly reflect in the mobile app via updated API responses.
*   **Categories (`/categories`)**: Manage the service/product categories available on the platform.

---

## 5. Low-Level Technical Mechanics

### 5.1. Data Integrity: Wallets & Transactions
Financial operations are strictly protected. The backend uses Mongoose transactions:
```javascript
const session = await mongoose.startSession();
session.startTransaction();
try {
  // Example atomic operation for moving funds
  await Wallet.findOneAndUpdate(
    { userId: customerId, balance: { $gte: jobCost } },
    { $inc: { balance: -jobCost } },
    { session, new: true }
  );
  // Increment Worker wallet, Increment Admin wallet (commission), etc.
  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
} finally {
  session.endSession();
}
```

### 5.2. Real-Time Socket.io Events
The platform utilizes a robust namespace/room structure in Socket.io.
*   **Rooms**: Entities join rooms based on their ID (e.g., `user_123`, `worker_456`) and roles.
*   **Key Events**:
    *   `job:new_request`: Broadcast to nearby worker rooms.
    *   `job:new_quote`: Sent to the specific customer room.
    *   `job:status_changed`: Broadcast to involved customer/worker.
    *   `order:new`: Sent to the specific shop room.

### 5.3. Redis Geospatial Indexing
Worker and Shop locations are frequently updated in Redis using `GEOADD`.
When a customer requests a job, the backend queries Redis:
```javascript
// Conceptual Redis Command
GEORADIUS platform:workers:locations <longitude> <latitude> <radius> km WITHDIST
```
This enables sub-millisecond matching of available workers to nearby jobs.

### 5.4. Backend API Structure
*   Located in `backend/src/`.
*   Modular structure: `modules/`, `helpers/`, `middleware/`.
*   **Validation**: All POST/PUT/PATCH routes use `Joi` middleware for strict schema validation before processing.
*   **Startup**: Executed via `node src/app.js`.

### 5.5. Frontend Structure
*   **Admin Panel**: `admin/src/`, built with Vite (`npm run build`). Heavily utilizes React Context/Redux for state management, specifically for Socket.io connections and real-time dashboard updates.
*   **Mobile App**: `mobile/src/`, React Native. Note: Requires `--legacy-peer-deps` during npm install. Test suite utilizes Jest with specific native module mocks defined in `jest.setup.js` (e.g., `@react-native-community/geolocation`).

---
*End of Document*
