# 🚀 Kwickly — On-Demand Services & Hyperlocal E-Commerce Platform

> **Single Source of Truth & Master System Overview**  
> Complete system specification across Backend API, Admin Control Center, and Cross-Platform Mobile Application.  
> Built with: **Node.js (Express 5)**, **React 18 (Vite SPA)**, **React Native (Expo)**, **MongoDB Atlas**, **Upstash Cloud Redis**, **Socket.io**, and **Zero-Trust Direct UPI (NPCI Protocol)**.

---

## 📌 Master Architecture Document

For the complete, exhaustive architectural manual covering all 24 backend modules, 22 admin modules, mobile screens, state machines, cron engines, and zero-trust financial ledgers, refer to:
👉 [**KWICKLY-MASTER-SYSTEM-DOCUMENTATION.md**](file:///d:/kwickly/11-4-26/docs/KWICKLY-MASTER-SYSTEM-DOCUMENTATION.md)

---

## 🌐 Live Production Cloud Deployments

| Component | Provider / Host | Live URL | Directory |
| :--- | :--- | :--- | :--- |
| **REST API Server** | Render Cloud (Docker) | `https://kwickly-backend-r6zb.onrender.com` | `backend/` |
| **WebSocket Engine** | Socket.io over SSL / WSS | `wss://kwickly-backend-r6zb.onrender.com` | `backend/src/sockets` |
| **Admin Control Panel** | Vercel Edge SPA | `https://kwickly-app.vercel.app` | `admin/` |
| **Primary Database** | MongoDB Atlas Cluster | Managed Atlas (Replica Set / Transactions) | Cloud |
| **Distributed Cache & Locks**| Upstash Cloud Redis | `< 2ms` Latency Hot-Cache & Mutex Locks | Cloud |
| **Release Android APK** | Universal Release APK | Sideloaded / Standalone APK | `mobile/` |

---

## 🛡️ Core Business Rules & Non-Negotiable Invariants

1. **0% Partner Commission (100% Net Payout)**:
   - **Service Workers**: Earn **100% of their accepted quote**. Platform fee + GST are charged to the customer (or deducted from worker wallet on cash jobs).
   - **Shops**: Earn **100% of Net Product Sales + Delivery Fee**. Platform fee + GST are charged to the customer.
2. **Zero-Trust UPI Financial Architecture**:
   - Platform never auto-credits an account on raw client assertions.
   - All UPI topups and payments submit a 12-digit UTR, enter `PENDING_VERIFICATION`, and are credited only after automated bank SMS webhook verification or platform admin bank-statement confirmation.
3. **Double-Entry Platform Ledger**:
   - Double-entry bookkeeping in `PlatformLedger` with unique sparse idempotency keys (`settle_job_{id}`, `settle_order_{id}`). Replays and duplicate credits are strictly impossible.
4. **Timing-Safe OTP Verification**:
   - 4-digit arrival and completion OTPs are strictly checked using `crypto.timingSafeEqual` in Node.js to eliminate side-channel timing attacks.
5. **Anti-Spoof GPS Streaming**:
   - Workers streaming real-time location (`WORKER_LOCATION_UPDATE`) must be validated against the active Redis lock `job:{id}:assigned_worker` before routing to the customer room.

---

## 👥 Unified 4-Role Flow Summary

```
                      ┌────────────────────────────────────────────────────────┐
                      │                 Kwickly Unified Platform               │
                      └────────┬──────────────┬─────────────┬─────────────┬────┘
                               │              │             │             │
                               ▼              ▼             ▼             ▼
                          [CUSTOMER]      [WORKER]       [SHOP]        [ADMIN]
```

### 1. Customer (`CUSTOMER`)
- **Service Job**: Describe Job ➔ Radius Broadcast (25km ➔ 50km ➔ 75km) ➔ Receive Quotes ➔ Accept ➔ Live Track ➔ Arrival OTP ➔ Completion OTP ➔ Pay ➔ Review.
- **Shop Orders**: Nearby Shops ➔ Single-Shop Cart ➔ Checkout (Wallet / UPI / Cash) ➔ Live Order Track ➔ Delivery Handover OTP ➔ Review.
- **Wallet**: Direct UPI intent ➔ 12-Digit UTR ➔ Zero-trust approval ➔ PDF Invoices & Receipts.

### 2. Service Professional (`WORKER`)
- **Duty Gate**: Online toggle strictly verifies: `isOnline: true` + active subscription/trial + wallet ≥ ₹100.
- **Bidding**: Real-time alerts via `NEW_JOB_ALERT` ➔ Submit quote ➔ Accept ➔ Stream GPS ➔ Arrival OTP ➔ Work execution ➔ 100% earnings credit.
- **Payouts**: Request withdrawal to UPI VPA or Bank Account with UTR verification.

### 3. Hyperlocal Merchant (`SHOP`)
- **Store Setup**: 14-day free trial on signup. KYC edits permanently forced to `PENDING` (no self-approval).
- **Inventory**: Atomic stock reservations on checkout (`$inc: -qty`); automatic restoration on cancel (`$inc: +qty`).
- **Logistics**: Custom radius, delivery fees, and delivery staff management (guarded against deletion during active delivery).
- **Orders**: `NEW` ➔ `CONFIRMED` ➔ `PACKING` ➔ `OUT_FOR_DELIVERY` ➔ Delivery Handover OTP ➔ Instant settlement.

### 4. Platform Administrator (`ADMIN`)
- **Control Center**: React 18 + Vite SPA with 22 functional modules.
- **Unified KYC Queue**: Merges workers and shops in a single paginated review desk.
- **Financial Governance**: Zero-trust UTR verification desk, payout approvals, double-entry `PlatformLedger`, and Admin Treasury.
- **Live Sync**: Connected to `admin_dashboard` socket room for instant metric updates.

---

## ⏱️ Multi-Node Background Cron Engine

| Lock Key | Schedule | Purpose |
| :--- | :--- | :--- |
| `cron:broadcast_sweep` | Every 1 min | Expands worker search radius dynamically (1× ➔ 2× ➔ 3× `maxRadius`) per configured wait interval; cancels if unfulfilled after 3 rounds. |
| `cron:job_sweep` | Every 1 min | Cancels ghost jobs in `QUOTES_RECEIVED` older than 2 hours without customer action. |
| `cron:order_sweep` | Every 5 min | Cancels unconfirmed shop orders older than 30 mins; restores stock atomically and refunds wallet. |
| `cron:worker_sweep` | Every 10 min | Forces expired workers and shops offline (`FORCED_OFFLINE`). |
| `cron:subscription_sweep` | Daily 00:00 | Sends 3-day advance subscription expiry warnings and deactivates expired accounts. |
| `cron:upi_reconcile_sweep` | Every 3 min | Reconciles pending automated UPI payments against provider webhooks. |

---

## 💻 Local Development Setup

### Backend API
```bash
cd backend
npm install
npm run dev
# Runs at http://localhost:5000
```

### Admin Control Panel
```bash
cd admin
npm install
npm run dev
# Runs at http://localhost:5173
```

### Mobile Application
```bash
cd mobile
npm install
npm start
# Press 'a' for Android, 'i' for iOS
```

---

## 🛡️ License & Operational Integrity
**Kwickly Platform** is privately licensed. All core state machines, zero-trust ledgers, and zero-breakage invariants are strictly enforced.
