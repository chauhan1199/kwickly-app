# Kwickly Comprehensive Bug Report

This document outlines all bugs, architectural flaws, and vulnerabilities identified across the backend and frontend during the comprehensive codebase audit.

---

## 1. Security Bugs

*   **[Critical] Arbitrary Socket Room Sniffing (Privilege Escalation)**
    *   **Description**: In `socket.helper.js`, custom listeners (`JOIN_ADMIN_ROOM`, `JOIN_WORKER_ROOM`) do not validate whether the user emitting the event has the correct JWT role or matching `userId`.
    *   **Impact**: Any authenticated customer can manually emit `JOIN_ADMIN_ROOM` via a custom client and intercept real-time dashboard aggregates, or join a competitor's worker room to intercept gig coordinates.
*   **[High] NoSQL Operator Injection Exposure**
    *   **Description**: `express-mongo-sanitize` is disabled in `app.js` due to an Express 5 incompatibility.
    *   **Impact**: If any endpoint parses `req.query` or `req.body` without strict Joi validation covering every single field, a malicious user can inject MongoDB operators (e.g., `?price[$gt]=0`) to bypass logic checks or extract unintended data.
*   **[Low] Mimetype Spoofing**
    *   **Description**: `upload.middleware.js` verifies file safety by checking `file.mimetype` rather than reading the file buffer's magic numbers.
    *   **Impact**: Malicious scripts renamed to `.jpg` can be uploaded to the server, though they cannot be executed natively without server misconfiguration.

---

## 2. Memory Leaks & Potential Crashes

*   **[High] OOM Crash via Socket Room Spam (Memory Leak)**
    *   **Description**: Because the socket `JOIN_*_ROOM` handlers are unvalidated, a malicious actor can loop an emit event requesting to join millions of dynamically generated room strings.
    *   **Impact**: Socket.IO will allocate memory for every imaginary room until the Node.js V8 engine runs out of RAM, crashing the server.

---

## 3. Race Conditions & Data Integrity Issues

*   **[High] Multi-Node Cron Execution (Race Condition)**
    *   **Description**: The `cronEngine.js` uses local memory boolean locks (`isJobSweepRunning`) to prevent overlapping executions on the *same* instance. However, if deployed across 3 Kubernetes pods, all 3 pods will execute the cron sweep simultaneously.
    *   **Impact**: Three pods will attempt to run `sweepGhostOrders` simultaneously. While MongoDB ACID transactions mitigate double-refunding, the simultaneous execution will cause database lock contention, massive CPU spikes, and potential race conditions in socket emissions (a user receives 3 "Order Cancelled" notifications at once).

---

## 4. Logic Bugs

*   **[Medium] Ghost Workers (Presence Desynchronization)**
    *   **Description**: When a worker's socket disconnects (e.g., phone dies, app force-closed), `socket.helper.js` simply logs the disconnect. It does not update the `Customer` document's `isOnline` flag to `false`.
    *   **Impact**: The DB still considers the worker online. The matching engine will continuously broadcast new jobs to a worker who is completely offline, degrading the customer experience by wasting the 3-minute broadcast round waiting for quotes from a dead phone.

---

## 5. Performance Bugs

*   **[Medium] In-Memory Rate Limiting**
    *   **Description**: `express-rate-limit` relies on the default in-memory store.
    *   **Impact**: In a multi-instance deployment, rate limits are fractured. A limit of 5 OTPs per 15 minutes becomes 25 OTPs per 15 minutes if load-balanced across 5 pods, defeating brute-force protection.
*   **[Low] Redundant Cache Operations**
    *   **Description**: Multiple controllers (Quote, Wallet, Job) duplicate the logic to fetch and `setCache` for `app_settings`.
    *   **Impact**: Minor performance degradation and violation of DRY principles.

---

## 6. API, UI, & Navigation Issues

*   **[Low] Offset Pagination Degradation**
    *   **Description**: APIs use `.skip(page * limit)`. For large datasets (e.g., thousands of historical notifications), `skip()` forces MongoDB to scan and discard documents, degrading API response times significantly on deep pages.
*   **[Low] Heavy Image Payloads**
    *   **Description**: The UI renders raw images from `/uploads` without server-side compression/resizing middleware (like `sharp`).
    *   **Impact**: Rendering a list of 20 shops with 4MB raw camera photos will consume excessive mobile data and cause UI stuttering on the React Native client.

---

## Recommendation Summary

1.  **Immediate**: Remove the manual `JOIN_*_ROOM` listeners from `socket.helper.js`.
2.  **Immediate**: Implement a `socket.on('disconnect')` handler that sets `isOnline: false` for workers in MongoDB.
3.  **Short-term**: Replace `node-cron` with `bullmq` + Redis to ensure background tasks are distributed, preventing multi-node race conditions. Use `rate-limit-redis`.
4.  **Long-term**: Implement cursor-based pagination and a dynamic image-resizing pipeline.
