# Kwickly Backend Documentation

This document provides a comprehensive technical overview of the Kwickly backend, built on Node.js and Express.js. It details the architecture, request lifecycle, data stores, real-time layers, and the exact purpose and business logic of every module.

---

## 1. Folder Structure

The backend follows a domain-driven, modular architecture:

```text
/backend/src
├── /config        // Database and core configuration (db.js)
├── /constants     // Application-wide static strings and messages
├── /cron          // Scheduled automated jobs (e.g., subscriptions)
├── /helpers       // Shared utility functions and service integrations
├── /middleware    // Express middlewares (auth, validation, errors)
├── /modules       // Domain-driven feature modules (controllers, models, routes)
├── /services      // External API service wrappers (e.g., sms.service.js)
├── /sockets       // Socket.io initialization and event handlers
├── /validators    // Joi validation schemas for incoming requests
├── /workers       // Background processing scripts and engines
└── /__tests__     // Unit and integration test suites
```

---

## 2. Core Architectural Components

### Routes
Routes are defined in `[module].routes.js`. They mount middleware (Auth, Roles, Validation) and map HTTP endpoints to controller methods. The `app.js` file centrally mounts all module routes under `/api/v1/`.

### Controllers
Controllers (`[module].controller.js`) contain the core business logic. They are wrapped in `catchAsync` to eliminate `try/catch` boilerplate. Controllers interact with Mongoose models, external helpers (Redis, Sockets), and return data via a standard `successResponse` or `errorResponse`.

### Services & Repositories
*   **Repositories**: Mongoose models (`[module].model.js`) act as the repository layer, defining the schema, indexes, and virtuals.
*   **Services**: Complex logic spanning multiple domains or external APIs is abstracted into `/helpers` (e.g., `razorpay.helper.js`, `notifyUser.helper.js`) and `/services`.

### Middleware
*   **Auth**: `authMiddleware.js` verifies JWT tokens.
*   **Role**: `role.middleware.js` enforces Role-Based Access Control (RBAC).
*   **Validation**: `validate.middleware.js` intercepts requests and validates them against Joi schemas.
*   **Rate Limiting**: `rateLimit.middleware.js` uses `express-rate-limit` to prevent abuse.
*   **Upload**: `upload.middleware.js` handles multipart/form-data via Multer.
*   **Error**: `error.middleware.js` catches all exceptions and normalizes them into standard JSON responses.

### Validation
Incoming requests (body, params, query) are validated using `Joi` schemas defined in `src/validators/`. If validation fails, the `validate` middleware immediately returns a 400 Bad Request.

### Authentication
Authentication is stateless and uses **JSON Web Tokens (JWT)**.
*   Users log in or register via OTP (Twilio).
*   Upon verification, a JWT is issued with a 30-day expiry.
*   The `authMiddleware` decodes the JWT and attaches the `req.user` object to the request.

### Authorization
Handled by `authorize(...roles)` middleware. The system supports `ADMIN`, `CUSTOMER`, `WORKER`, and `SHOP` roles. Endpoints strictly define which roles can access them.

### Database Access
Uses **MongoDB** with **Mongoose**.
*   **Transactions**: Critical financial operations (like paying for a job or processing wallet debits) use MongoDB ACID Transactions (`session.startTransaction()`) to prevent race conditions and data corruption.
*   **Geospatial Queries**: Uses MongoDB `$geoWithin` and `$nearSphere` heavily for locating workers and shops.

### Redis Usage
Uses `ioredis` for:
*   **Caching**: App settings, Admin dashboard statistics, and eligible worker lists are cached to reduce DB load. TTLs (Time-to-Live) are actively managed.
*   **Pub/Sub**: Socket.io adapter (implied for multi-instance scaling).

### Socket Usage
Socket.io is used for real-time interactivity.
*   **Rooms**: Users join role-specific rooms (e.g., `worker_123`, `customer_456`, `admin_dashboard`).
*   **Events**: `emitToRoom` and `emitToAll` are used by controllers to push live updates for Chat, Job Status changes, and location tracking.

### Cron & Background Jobs
*   **Cron**: `subscription.cron.js` runs periodically to check for expired worker/shop subscriptions and downgrade their statuses.
*   **Background Jobs**: Utility scripts (e.g., `check_notifs.js`, `cleanup-images.js`) handle asynchronous data maintenance.

### Config & Environment Variables
Configuration is loaded via `dotenv`. Key variables include `MONGO_URI`, `JWT_SECRET`, `RAZORPAY_KEY`, `TWILIO_SID`, and `FCM_SERVER_KEY`.

### Shared Helpers
*   `response.helper.js`: Standardizes all API responses (`successResponse`, `errorResponse`).
*   `async.helper.js`: Wraps async controller functions to catch unhandled rejections.
*   `logger.helper.js`: Winston-based structured logging.
*   `notifyUser.helper.js`: Orchestrates saving a notification to DB, emitting a socket event, and sending an FCM push notification simultaneously.

---

## 3. Module Breakdown

### Auth Module
*   **Purpose**: Handles user registration, login, and token generation.
*   **Input**: Phone numbers, OTPs, Role selection.
*   **Output**: JWT Tokens, User Profiles.
*   **Dependencies**: Twilio (SMS), Customer Model.
*   **Business Logic**: Generates 4-digit OTPs, caches them in Redis (or DB), verifies them, and issues JWTs. Creates new user records if the phone number is new.

### Admin & AdminWallet Module
*   **Purpose**: Centralized dashboard controls and platform revenue tracking.
*   **Input**: Admin actions (approve KYC, view metrics, resolve disputes).
*   **Output**: Aggregated stats, lists of users, platform earnings.
*   **Dependencies**: Almost all models.
*   **Business Logic**: Calculates platform fees, handles manual job reassignments, approves worker KYCs, and views overall ledger.

### Job Module
*   **Purpose**: Core logic for booking and executing service requests.
*   **Input**: Service category, coordinates, preferred dates.
*   **Output**: Job details, eligible workers, status updates.
*   **Dependencies**: Customer, Quote, Wallet, Razorpay, FCM, Sockets, Redis.
*   **Business Logic**:
    *   Finds eligible workers based on 8 strict criteria (KYC, Subscription, Wallet Balance, Radius, etc.).
    *   Broadcasts to eligible workers via WebSockets.
    *   Implements GPS spoofing mitigation (Haversine distance check < 200m upon arrival).
    *   Handles financial splitting (Platform Fee vs Worker Payout) inside MongoDB transactions.
    *   Handles Partial Payment disputes.

### Quote Module
*   **Purpose**: Allows workers to bid on broadcasted jobs.
*   **Input**: Bid amount, ETA, counter-offer details.
*   **Output**: Quote lists for customers to review.
*   **Dependencies**: Job, Worker.
*   **Business Logic**: Ensures a worker hasn't already bid, notifies the customer of a new bid, and locks the job once a customer accepts a quote.

### Wallet & Payout Module
*   **Purpose**: Manages virtual balances and real-world bank withdrawals.
*   **Input**: Top-up amounts, withdrawal requests, Razorpay signatures.
*   **Output**: Transaction ledgers, updated balances.
*   **Dependencies**: Razorpay API, Job module.
*   **Business Logic**: Integrates Razorpay Webhooks to verify top-ups. Processes payouts by communicating with RazorpayX (or manual admin approval) and debits the virtual wallet.

### Shop & ShopOrder Module
*   **Purpose**: E-commerce layer for local stores.
*   **Input**: Store setup, product creation, cart checkouts.
*   **Output**: Store listings, order tracking.
*   **Dependencies**: DeliveryStaff, Product, Cart.
*   **Business Logic**: Allows stores to list products. Customers browse via geospatial queries. Orders are processed, and delivery staff are assigned for fulfillment.

### Customer & Worker Modules
*   **Purpose**: Profile management.
*   **Input**: Profile images, KYC documents, active locations, category selections.
*   **Output**: Sanitized public profiles, KYC statuses.
*   **Dependencies**: Auth, Upload Middleware.
*   **Business Logic**: Manages active states (isOnline). Workers must upload specific documents which trigger admin review pipelines.

### Chat Module
*   **Purpose**: Text communication between Customer, Worker, and Admin.
*   **Input**: Text messages, image uploads.
*   **Output**: Paginated message history.
*   **Dependencies**: Socket.io.
*   **Business Logic**: Saves messages to DB and immediately emits them to the recipient's personal socket room for real-time delivery.

### Dispute & Support Module
*   **Purpose**: Conflict resolution.
*   **Input**: Dispute reasons, evidence images.
*   **Output**: Admin resolution states.
*   **Dependencies**: Job, Wallet.
*   **Business Logic**: Freezes job payouts if a dispute is raised. Allows admins to refund customers or manually credit workers based on evidence.

### Notification Module
*   **Purpose**: Centralized alerting system.
*   **Input**: Notification payloads from other controllers.
*   **Output**: FCM pushes, DB records, Unread counts.
*   **Dependencies**: Firebase Admin SDK.
*   **Business Logic**: Abstracts the complexity of sending push notifications and maintaining a persistent bell-icon history for users.

### Category Module
*   **Purpose**: Manages the taxonomy of services (e.g., Plumbing, Electrician).
*   **Input**: Category names, icons, commissions.
*   **Output**: Hierarchical category trees.
*   **Dependencies**: Redis (highly cached).
*   **Business Logic**: Serves the primary navigation UI for customers. Defines the base commission rate the platform takes for specific service types.

### Subscription Module
*   **Purpose**: Monetization of the Worker/Shop tiers.
*   **Input**: Payment for monthly/yearly plans.
*   **Output**: Extended `expiryDate` on user profiles.
*   **Dependencies**: Razorpay, Cron.
*   **Business Logic**: Validates payment success and activates premium features (ability to view jobs). The cron engine automatically downgrades users whose expiry dates have passed.
