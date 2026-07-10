# Kwickly Socket.IO Implementation Audit

This document provides a comprehensive technical audit of the real-time websocket layer powering Kwickly's live tracking, bidding system, and admin dashboard updates.

---

## 1. Connection & Authentication

Kwickly relies on the standard `socket.io` and `socket.io-client` packages, allowing fallback to HTTP long-polling if WebSockets are blocked by proxies.

*   **Namespaces**: The system utilizes a single root namespace (`/`). Persona isolation is achieved strictly through Rooms rather than separate Namespaces.
*   **Authentication Flow**: 
    1. A JWT is passed either via `socket.handshake.auth.token` or the `Authorization` header.
    2. An `io.use()` middleware intercepts the connection, verifies the JWT, and binds `socket.userId` and `socket.userRole`.
    3. If verification fails or is missing, the connection is **not rejected**. Instead, the socket is flagged with `isAuthenticated = false`. 

---

## 2. Rooms Strategy

Upon a successful authenticated connection, the server automatically joins the socket to a persona-specific room.

*   **Customer Rooms**: `customer_{userId}`
*   **Worker Rooms**: `worker_{userId}`
*   **Shop Rooms**: `shop_{shopId}`
*   **Job Rooms**: `job_{jobId}` (Used to broadcast to all rejected bidders when a job is taken).
*   **Admin Room**: `admin_dashboard` (Receives high-frequency platform aggregates).

---

## 3. Core Events (Emitters & Listeners)

The backend emits various events triggered by standard HTTP controller mutations.

### Job Lifecycle (Gig Economy)
*   **`NEW_JOB_ALERT`**: Emitted to a targeted radius of eligible `worker_{userId}` rooms when a Customer broadcasts a job.
*   **`NEW_QUOTE`**: Sent to the `customer_{userId}` when a worker places a bid.
*   **`QUOTE_ACCEPTED`**: Sent to the winning `worker_{userId}`.
*   **`JOB_TAKEN`**: Sent to the `job_{jobId}` room, telling all other workers who bid that the job is no longer available.
*   **`JOB_STARTED` / `JOB_COMPLETED` / `JOB_PAID`**: Emitted to the `customer_{userId}` keeping the app UI synchronized as the worker progresses through the gig.

### E-Commerce & Notifications
*   **`NEW_ORDER`**: Alerts a Shop owner (`shop_{shopId}`) to an incoming purchase.
*   **`ORDER_STATUS`**: Updates the customer when an order is packed or dispatched.
*   **`NEW_NOTIFICATION`**: Pushed to specific user rooms alongside a persistent MongoDB insert.
*   **`DASHBOARD_UPDATE`**: Broadcasted to `admin_dashboard` when critical entities mutate.

---

## 4. Presence & Online Users

*   **Missing Disconnect Handlers**: Currently, the `disconnect` event inside `socket.helper.js` simply logs the disconnection (`logger.info`). **It does not update the MongoDB `Customer` record to `isOnline: false`.** 
*   **Implication**: The system relies on HTTP-based heartbeats or manual user toggles to determine worker presence. If a worker's phone dies abruptly, they may remain `isOnline: true` in MongoDB and continue to receive job assignments they cannot fulfill, until a background cron job potentially cleans up stale workers.

---

## 5. Security Vulnerabilities & Race Conditions

### P0 Privilege Escalation (Room Sniffing)
In `socket.helper.js`, the server listens for manual join events:
```javascript
socket.on('JOIN_CUSTOMER_ROOM', (data) => socket.join(`customer_${data.userId}`));
socket.on('JOIN_WORKER_ROOM', (data) => socket.join(`worker_${data.userId}`));
socket.on('JOIN_ADMIN_ROOM', () => socket.join('admin_dashboard'));
```
**Flaw**: These listeners do not verify if `socket.userId === data.userId` or if `socket.userRole === 'ADMIN'`. A malicious user can write a basic socket client, emit `JOIN_ADMIN_ROOM`, and successfully intercept sensitive dashboard aggregates, or emit `JOIN_WORKER_ROOM` for a competitor's ID to intercept their private gig data.

### Race Conditions
There are no major race conditions inside the socket layer itself, as Socket.IO is primarily used as a fire-and-forget notification system rather than a source of truth for state mutations. The actual state transitions (e.g., accepting a quote) run through HTTP and are locked via MongoDB ACID transactions.

---

## 6. Performance & Memory Leaks

*   **Tuning**: The ping timeout is set to `20000ms` and interval to `25000ms`, which is slightly aggressive but suitable for real-time mobile tracking where dropping a stale connection quickly is valuable.
*   **Memory Leaks**: Because of the vulnerability mentioned above, a malicious client could emit `JOIN_CUSTOMER_ROOM` with a million different generated UUIDs in a loop. Socket.IO will happily bind the single socket to a million rooms, exhausting the Node.js RAM and causing an Out Of Memory (OOM) crash.

---

## 7. Assessment & Recommendations

While the architectural pattern of isolating personas into prefixed rooms is correct and scales well with Redis adapters in the future, the **authorization perimeter is breached**. 

**Required Fixes:**
1.  **Remove Manual Joins**: Delete the `socket.on('JOIN_*_ROOM')` listeners entirely. The automatic `socket.join()` performed during the `connection` event based on the verified JWT is sufficient and secure.
2.  **Handle Disconnects**: Implement logic inside `socket.on('disconnect')` to query MongoDB and set `isOnline = false` for workers to prevent ghost workers from receiving job broadcasts.
