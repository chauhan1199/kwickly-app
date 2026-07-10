# Kwickly Background Jobs & Cron Execution

This document details the architecture of background task execution, scheduling, job retries, and failure recovery in the Kwickly platform.

---

## 1. Engine Architecture

Kwickly does not utilize an external message broker (like RabbitMQ or Redis/BullMQ) for its background processing. Instead, it relies on a **Database-Polling Cron Engine** implemented using `node-cron`.

### Location
*   **Path**: `backend/src/workers/cronEngine.js`
*   **Initialization**: Bootstrapped when the main Node.js process starts (`startCronEngine()`).

### Concurrency Locks
Because standard `node-cron` can trigger a new execution before the previous one finishes (leading to race conditions), the engine employs simple boolean memory locks (`isBroadcastSweepRunning`, `isOrderSweepRunning`) to guarantee mutually exclusive execution per worker node.

---

## 2. Scheduled Sweeps

The engine runs four primary database sweeps to handle timeouts, retries, and state transitions that users abandoned.

### 2.1 Broadcasting Sweep (Runs Every Minute)
*   **Purpose**: Manages the reverse-bidding radius expansion algorithm.
*   **Logic**: Finds all jobs in `BROADCASTING` state where the last attempt was > 1 minute ago.
*   **Retries (Radius Expansion)**: Increases the search radius incrementally up to 3 rounds. Re-queries MongoDB for newly eligible workers in the expanded radius and fires `NEW_JOB_ALERT` websockets.
*   **Dead Lettering**: If round > 3, the job is declared "dead". It is transitioned to `CANCELLED`, and a failure push notification is dispatched to the Customer.
*   **Exception**: If a job is scheduled for the future (`preferredDate`), it is not cancelled. Instead, its `lastAttemptAt` is delayed by 30 minutes to pause broadcasting spam until the time approaches.

### 2.2 Ghost Quotes Sweep (Runs Every Minute)
*   **Purpose**: Cleans up abandoned bids.
*   **Logic**: Finds jobs in `QUOTES_RECEIVED` state where the customer hasn't selected a worker for > 2 hours.
*   **Action**: Transitions the job to `CANCELLED` and emits a status change socket. Prevents workers from having their time indefinitely held up by an unresponsive customer.

### 2.3 Ghost Orders Sweep (Runs Every 5 Minutes)
*   **Purpose**: Cancels ignored E-Commerce orders.
*   **Logic**: Finds `ShopOrder` documents in `NEW` state older than 30 minutes.
*   **Failure Recovery (ACID Refunds)**: Uses `mongoose.startSession()` and `session.startTransaction()`.
    *   Marks order as `CANCELLED`.
    *   If the order was `PAID`, credits the customer's virtual wallet and creates a `WalletTxn` record.
    *   If any step fails, `session.abortTransaction()` reverts the refund, and the script uses a `try/catch` with a `continue` statement to safely skip the bad order without crashing the entire cron loop.

### 2.4 Subscription Sweep (Runs Every 10 Minutes)
*   **Purpose**: Enforces paywalls for workers and shops.
*   **Logic**: Queries for users where `role` is `WORKER` or `SHOP`, `isOnline` is true, and their subscription `expiryDate` has passed.
*   **Action**: Forces `isOnline = false` in the database and emits a `FORCED_OFFLINE` websocket, immediately preventing them from receiving new gigs or processing orders.

---

## 3. Analysis & Scaling Constraints

### 3.1 What Works Well
*   **Simplicity**: Polling the database is highly reliable, requiring no additional infrastructure (like Kafka or RabbitMQ) to monitor.
*   **Atomic Rollbacks**: The use of MongoDB ACID transactions inside the `sweepGhostOrders` cron guarantees financial integrity when auto-refunding customers.

### 3.2 Current Limitations (Scaling to Multi-Node)
*   **No Distributed Locks**: If the Kwickly Node.js backend is scaled horizontally (e.g., running 5 pods in Kubernetes), **all 5 pods will run `cronEngine.js` simultaneously**. This will cause massive race conditions (e.g., 5 pods attempting to refund the same ghost order simultaneously).
*   **Recommendation**: 
    1. Migrate to a proper distributed queue (like BullMQ via Redis) where jobs are pushed onto a queue exactly once.
    2. *Alternatively*, if sticking to `node-cron`, implement Redis-based distributed locks (e.g., Redlock) around the sweep functions so only one pod processes the DB sweep per minute.
