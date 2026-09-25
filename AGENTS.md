# Kwickly AI Development Standards (Ponytail Mindset + Zero-Breakage Architecture)

> **Core Philosophy**: Think like the senior engineer who writes the minimum code necessary to deliver maximum reliability. Never over-engineer, never bloat dependencies, and never break existing business logic, real-time sync, or low-latency contracts.

---

## 🧗 The 7-Rung Ponytail Decision Ladder

Before writing any new code or modifying existing files, the agent must evaluate this hierarchy:

1. **Does this need to exist? (YAGNI)**: If the feature or abstraction is speculative, skip it.
2. **Already in this codebase?**: Always search and reuse existing models (`backend/src/models/`), route controllers, helpers (`logger.helper.js`, `response.helper.js`), Redis clients, and mobile/admin UI components.
3. **Standard library does it?**: Prefer native JavaScript (ES2022+ / Node built-ins: `crypto`, `fs/promises`, `URL`, array methods) over installing new npm packages.
4. **Native platform feature?**: Use built-in React Native / Expo components (`TextInput`, `FlatList`, `ActivityIndicator`) or standard HTML/DOM features in Admin before adding external wrapper libraries.
5. **Installed dependency?**: Check `package.json` across `/backend`, `/mobile`, and `/admin`. If an installed package (`axios`, `lucide-react`, `lucide-react-native`, `socket.io-client`, `recharts`, `react-native-maps`) already does the job, use it. Do NOT install new packages without explicit user instruction.
6. **Can it be done in one line or a clean helper?**: Write the simplest, most readable implementation.
7. **Only then: write the minimum code that works.** Surgical, minimal git diffs only.

> **CRITICAL RULE**: "Lazy about writing code, NEVER lazy about reading code." Always inspect existing files, schemas, and sockets before making changes.

---

## 🛡️ Non-Negotiable Architectural Invariants

### 1. Zero Business Logic Breakage (Flow & Role Preservation)
The platform manages four distinct roles (`CUSTOMER`, `WORKER`, `SHOP`, `ADMIN`). Every lifecycle defined in [`docs/PRODUCT-FLOWS.md`](file:///d:/kwickly/11-4-26/docs/PRODUCT-FLOWS.md) must be strictly preserved:

* **Job Lifecycle State Machine**:
  `BROADCASTING → QUOTES_RECEIVED → ALLOCATED → ARRIVING → IN_PROGRESS → COMPLETED → PAID → CLOSED`
  *(Side exits: `CANCELLED`, `DISPUTED`)*. Never bypass states or mutate transitions arbitrarily.
* **Shop Order State Machine**:
  `NEW → CONFIRMED → PACKING → OUT_FOR_DELIVERY → DELIVERED`
  *(Side exit: `CANCELLED` with automatic stock restoration `$inc: { stock: +qty }`)*.
* **4-Digit Completion & Arrival OTP**: Always verified with `crypto.timingSafeEqual` to prevent timing attacks.
* **Zero-Trust Payments & Ledger**:
  - UPI 12-digit UTR validation with replay and dummy blacklist checks.
  - Double-entry bookkeeping in `PlatformLedger` with unique idempotent keys (`settle_job_{id}`) to prevent double-crediting.
  - Escrow settlement is atomic.
* **Worker & Shop Eligibility Gates**:
  - Workers: Online status + active subscription (`WorkerSubscription`) + wallet ≥ minimum balance (`settings.wallet.minimumBalance`).
  - Shops: Active subscription + verified KYC (`PENDING` on resubmission, owner cannot self-approve).

---

### 2. Zero Latency & High Concurrency Performance
* **Redis Hot-Path (<2ms)**:
  - Preserve Upstash Redis caching for hot reads: `otp:{phone}`, `session:{userId}`, `top_pros_list`, `job:{id}:assigned_worker`.
  - Use Redis distributed locks for concurrent critical actions (bidding, job assignment, wallet debits).
* **Database Optimization**:
  - MongoDB/Mongoose: Always use `.lean()` on read-only queries and `.select()` for field projection.
  - Never run unbounded queries or return full documents when only IDs or status flags are needed.
  - Respect existing compound indexes (`userId`, `status`, `createdAt`, `coordinates`).
* **Minimal Socket Payloads**:
  - When emitting real-time events, transmit only the delta (IDs, new status, timestamp). Never emit multi-megabyte hydrated documents over WebSockets.

---

### 3. Real-Time Mobile & Admin Synchronization
The Admin Panel (`/admin`) and Mobile App (`/mobile`) communicate with the same Backend Engine (`/backend`):

* **Event Parity**: When updating any order, job, payout, or KYC state on the server, the corresponding Socket.io event MUST be emitted to the appropriate room:
  - `admin`: Global metrics and KYC queues.
  - `worker_{workerId}`: `NEW_JOB_ALERT`, `WALLET_CREDIT`, `FORCED_OFFLINE`.
  - `customer_{customerId}`: `NEW_QUOTE`, `WORKER_LOCATION`, `ORDER_STATUS`.
  - `shop_{shopId}`: `ORDER_PLACED`, `ORDER_STATUS`.
  - `job_{jobId}`: Chat messages (`SEND_MESSAGE` → `NEW_MESSAGE`).
* **API Contract Integrity**: Never rename or drop fields in backend responses without updating both `/mobile/src/` screens and `/admin/src/` dashboard components simultaneously.
* **Security & CORS**: Never tamper with `FIRST_PARTY_ORIGINS` or production URL configurations in [`backend/src/app.js`](file:///d:/kwickly/11-4-26/backend/src/app.js).

---

### 4. Code Change Hygiene
* Do not introduce sprawling refactors when fixing a bug.
* Keep edits focused and surgical.
* Preserve existing comments, logging, and error-handling middleware.
