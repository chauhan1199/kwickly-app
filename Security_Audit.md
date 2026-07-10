# Kwickly Security Audit

This document provides an exhaustive security audit of the Kwickly platform, evaluating authentication mechanisms, request sanitation, and server configurations. Issues are ranked by severity.

---

## 1. Authentication & Authorization

*   **JWT Implementation (Secure)**: JWTs are used exclusively via the `Authorization: Bearer` header, meaning the API is immune to standard CSRF attacks (which target session cookies). JWT secrets are securely loaded via `process.env`.
*   **Role-Based Access Control (RBAC) (Secure)**: The `role.middleware.js` correctly limits access. For example, customers cannot hit admin endpoints.
*   **Stateless Session Invalidation (Secure)**: A major flaw in many JWT systems is the inability to log out. Kwickly correctly utilizes a Redis-based JWT Blacklist to guarantee token revocation.

## 2. Injection & Sanitation

*   **XSS (Secure)**: The backend utilizes `helmet` to set restrictive Content-Security-Policies (CSP). The React/Vite frontends natively escape data during rendering, preventing Cross-Site Scripting.
*   **SQL Injection (N/A)**: MongoDB is used, so SQL injection is irrelevant.
*   **MongoDB Injection (Vulnerable)**: The application has **commented out** `express-mongo-sanitize` in `app.js` due to an incompatibility with Express 5 getters. While Joi validation stops most bad payloads, any endpoint reading directly from `req.query` without strict Joi validation is vulnerable to operator injection (e.g., `?phone[$ne]=null`).

## 3. Network & Infrastructure

*   **CORS (Secure)**: Configured strictly using a whitelist (`process.env.ALLOWED_ORIGINS`). Requests from unknown origins are properly rejected.
*   **Headers (Secure)**: `helmet()` applies modern security headers (HSTS, NoSniff, Frameguard).
*   **Secrets / Env Vars (Secure)**: All sensitive configurations (JWT_SECRET, Mongo URI, Twilio Keys, Razorpay Secrets) are abstracted into `.env` files and omitted from source control.
*   **Encryption (Secure)**: Passwords (fallback for admins) are hashed securely using `bcryptjs` with a high cost factor (12 salt rounds).

## 4. File Uploads (`multer`)

*   **Configuration (Moderate)**: The `upload.middleware.js` is reasonably secure. It limits file size to 5MB and forces a unique, safe filename generation to prevent Path Traversal. 
*   **Flaw**: It validates the file type solely by checking the `file.mimetype` property sent in the HTTP request (`file.mimetype.startsWith('image/')`). This can be trivially spoofed by a malicious user uploading an executable file renamed to `.php` or `.js` with a forged `image/png` content-type header.

## 5. Rate Limiting

*   **Configuration (Vulnerable)**: Kwickly uses `express-rate-limit` with strict rules (e.g., 3 OTP attempts per 10 minutes). However, the implementation uses the **default in-memory store**.
*   **Flaw**: If Kwickly scales horizontally (e.g., behind a load balancer with 5 Node.js instances), the rate limits are tracked independently per instance. A malicious actor could hit the API 15 times before being blocked across all 5 instances. Since Redis is already deeply integrated into the stack, failing to use `rate-limit-redis` is an architectural oversight.

---

## 6. Vulnerability Rankings

### 🔴 CRITICAL
**1. Socket.IO Room Privilege Escalation** *(Identified in Socket Audit)*
*   **Issue**: Manual `socket.on('JOIN_*')` listeners allow unauthenticated or unauthorized users to arbitrarily subscribe to `admin_dashboard` or other users' private websocket rooms.
*   **Fix**: Remove these listeners. Rely solely on the initial authenticated connection to join users to their designated rooms.

### 🟠 HIGH
**2. Missing MongoDB Sanitization**
*   **Issue**: `express-mongo-sanitize` is disabled. Any endpoint missing strict Joi validation could be susceptible to NoSQL operator injection (e.g., bypassing password checks via `$gt`).
*   **Fix**: Either strictly enforce Joi across 100% of routes, or downgrade `express` / replace the package with one compatible with Express 5 to globally sanitize keys containing `$` and `.`.

### 🟡 MEDIUM
**3. In-Memory Rate Limiter in a Scaled Environment**
*   **Issue**: `express-rate-limit` uses server RAM to track IPs. If deployed across multiple pods, rate limits multiply proportionally to the number of pods.
*   **Fix**: Implement `rate-limit-redis` utilizing the existing Redis cluster to ensure global, synchronized IP tracking.

**4. Worker "Ghosting" on Disconnect**
*   **Issue**: Sockets disconnecting do not update the DB `isOnline` flag to false.
*   **Fix**: Add an asynchronous MongoDB update inside the Socket.io `disconnect` handler to switch the worker offline.

### 🟢 LOW
**5. Mimetype Spoofing on File Uploads**
*   **Issue**: Multer checks the client-provided mimetype string rather than the actual file binary magic numbers.
*   **Fix**: Integrate a library like `file-type` to read the first few bytes of the uploaded buffer to guarantee it is genuinely an image before saving it to disk.
