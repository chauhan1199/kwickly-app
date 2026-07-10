# Kwickly Refactoring Roadmap

This document outlines a prioritized strategy for refactoring the Kwickly platform, addressing critical vulnerabilities, architectural bottlenecks, and codebase maintainability. Initiatives are ranked by immediate impact on system stability and security.

---

## 🔴 Phase 1: Critical Security & Stability (Immediate)

*These items patch immediate vulnerabilities and prevent system crashes.*

1.  **Patch Socket.IO Room Privilege Escalation**
    *   **Action**: Remove the manual `JOIN_ADMIN_ROOM`, `JOIN_WORKER_ROOM`, and `JOIN_CUSTOMER_ROOM` listeners from `socket.helper.js`.
    *   **Impact**: Closes a P0 vulnerability allowing unauthenticated users to sniff gig/dashboard data and eliminates a massive Memory Leak vector (OOM crash).
2.  **Synchronize Worker Presence (Ghost Workers)**
    *   **Action**: Inside the `socket.on('disconnect')` handler, add an asynchronous MongoDB call to set the disconnected user's `isOnline` flag to `false`.
    *   **Impact**: Fixes the gig-matching engine broadcast logic, preventing it from wasting time waiting for bids from workers whose phones are dead.
3.  **Migrate Rate Limiting to Redis**
    *   **Action**: Replace the default in-memory store in `rateLimit.middleware.js` with `rate-limit-redis`.
    *   **Impact**: Prevents brute-force attacks across horizontally scaled multi-pod deployments.

---

## 🟠 Phase 2: Architectural Decoupling (High Impact)

*These items address "God Controllers" and violate the Single Responsibility Principle.*

1.  **Extract a Service Layer**
    *   **Action**: Refactor monolithic controllers (specifically `job.controller.js` and `shoporder.controller.js`) by moving business logic, socket emissions, and MongoDB aggregation pipelines into dedicated services (e.g., `JobService.js`, `LedgerService.js`).
    *   **Impact**: Dramatically improves maintainability. Controllers will exclusively handle HTTP request validation and response formatting.
2.  **Abstract Caching Logic (DRY)**
    *   **Action**: Remove duplicated `app_settings` caching blocks scattered across multiple controllers. Create a singular `SettingsService.getSettings()` that internally manages the Redis `getCache`/`setCache` lifecycle.
    *   **Impact**: Reduces duplicate code and ensures cache invalidation rules are managed in exactly one place.

---

## 🟡 Phase 3: Infrastructure Scaling (Medium Impact)

*These items prepare the backend to scale past 100k users.*

1.  **Migrate from `node-cron` to `BullMQ`**
    *   **Action**: Replace the database-polling `cronEngine.js` with a robust Redis-backed queue system like BullMQ.
    *   **Impact**: Ensures background tasks (like auto-cancelling ghost orders) execute exactly once across a clustered Node.js environment, eliminating severe race conditions and database locks.
2.  **Introduce an Image Processing Pipeline**
    *   **Action**: Modify `upload.middleware.js` to pipe uploaded files through a processing library (like `sharp`) to generate compressed, WebP thumbnails.
    *   **Impact**: Drastically reduces mobile bandwidth consumption and fixes UI stuttering on list screens containing heavy raw camera photos.
3.  **Socket.IO Redis Adapter**
    *   **Action**: Install `@socket.io/redis-adapter` into the Socket initialization.
    *   **Impact**: Allows real-time events to broadcast seamlessly across multiple Node.js server instances behind a load balancer.

---

## 🟢 Phase 4: Performance & Testing (Long-Term)

1.  **Cursor-Based Pagination**
    *   **Action**: Refactor heavy endpoints (like Historical Notifications and Chat Logs) from offset-based `.skip(page * limit)` to cursor-based `_id: { $lt: lastSeenId }`.
    *   **Impact**: Prevents severe database latency degradation as users accumulate thousands of historical records.
2.  **Implement Dependency Injection for Testing**
    *   **Action**: Pass Mongoose models and third-party wrappers (Twilio, Razorpay) into the newly created Service Layer via a Dependency Injection container or constructor parameters.
    *   **Impact**: Eliminates the need for brittle `jest.mock()` intercepts, enabling robust, isolated unit testing for all critical business logic.
3.  **Strict TypeScript/JSDoc Typing**
    *   **Action**: Migrate the backend to TypeScript, or comprehensively document all controller inputs/outputs with JSDoc types.
    *   **Impact**: Eliminates runtime type errors and provides self-documenting code contracts for future developers.
