# Kwickly API Documentation

This document outlines the API surface for the Kwickly backend, mapping every endpoint, method, and authentication requirement.

---

## Global API Patterns

Because Kwickly utilizes a highly structured, domain-driven architecture, the following patterns apply universally to all endpoints listed below:

### 1. Authentication & Security
*   **Method**: `JWT Bearer Token` via the `Authorization` header.
*   **Session Management**: Validated against a Redis session cache (`session:{userId}`) to minimize MongoDB hits.
*   **Security Headers**: Helmet.js is used for HSTS, XSS protection, and MIME-sniffing prevention.
*   **Rate Limiting**: `express-rate-limit` is applied globally (e.g., 1000 requests per 15 minutes), with stricter limits on `/auth` routes.
*   **Role Constraints**: Managed via the `authorize('ROLE')` middleware.

### 2. Validation
*   **Engine**: Joi (Object schema validation).
*   **Pattern**: Express middleware intercepts the request, validates `req.body`, `req.query`, or `req.params`.
*   **Failure**: Returns `400 Bad Request` with the specific Joi error message before hitting the controller.

### 3. Database & Redis Actions
*   **DB (MongoDB)**: Standard Mongoose CRUD. Heavy write operations (like Wallets and Payouts) use `mongoose.startSession()` for ACID transactions.
*   **Redis**: Caches aggregations (like `/admin/stats`), OTPs, user sessions, and JWT blacklists. `delCache` is called to invalidate stale data upon mutations.

### 4. Socket Events
*   **Emissions**: Sockets are emitted from controllers using `emitToUser(userId, event, payload)` or `emitToRoom(room, event, payload)`.
*   **Core Events**: `NEW_JOB_ALERT`, `JOB_STARTED`, `NEW_NOTIFICATION`.

### 5. Standardized Responses & Errors
All responses are formatted using `response.helper.js`:

**Success (2xx):**
```json
{
  "success": true,
  "message": "Action completed successfully",
  "data": { ... }
}
```

**Error (4xx / 5xx):**
Caught via `catchAsync` wrapper and passed to the global error handler.
```json
{
  "success": false,
  "error": {
    "message": "Resource not found",
    "code": 404
  }
}
```

---

## API Endpoints Reference

## AUTH MODULE (/api/v1/auth)

### POST /api/v1/auth/check-status
- **Authentication**: None
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes POST operation on AUTH.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### POST /api/v1/auth/logout
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes POST operation on AUTH.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### GET /api/v1/auth/me
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes GET operation on AUTH.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

## ADMIN MODULE (/api/v1/admin)

### GET /api/v1/admin/settings/branding
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes GET operation on ADMIN.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### GET /api/v1/admin/stats
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes GET operation on ADMIN.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### GET /api/v1/admin/badges
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes GET operation on ADMIN.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### GET /api/v1/admin/health
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes GET operation on ADMIN.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### GET /api/v1/admin/ledger
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes GET operation on ADMIN.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### GET /api/v1/admin/customers
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes GET operation on ADMIN.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### GET /api/v1/admin/customers/export
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes GET operation on ADMIN.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### GET /api/v1/admin/customers/:id
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes GET operation on ADMIN.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### GET /api/v1/admin/workers
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes GET operation on ADMIN.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### GET /api/v1/admin/workers/export
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes GET operation on ADMIN.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### GET /api/v1/admin/workers/:id
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes GET operation on ADMIN.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### GET /api/v1/admin/pending-kyc
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes GET operation on ADMIN.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### PATCH /api/v1/admin/users/:id/toggle-status
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes PATCH operation on ADMIN.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### DELETE /api/v1/admin/users/:id
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes DELETE operation on ADMIN.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### POST /api/v1/admin/users/:id/impersonate
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes POST operation on ADMIN.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### GET /api/v1/admin/customers/:id/jobs
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes GET operation on ADMIN.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### GET /api/v1/admin/customers/:id/orders
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes GET operation on ADMIN.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### DELETE /api/v1/admin/workers/:id/kyc-documents/:docIndex
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes DELETE operation on ADMIN.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### GET /api/v1/admin/shops
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes GET operation on ADMIN.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### GET /api/v1/admin/shops/:id
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes GET operation on ADMIN.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### DELETE /api/v1/admin/shops/:id
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes DELETE operation on ADMIN.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### PATCH /api/v1/admin/shops/:id/kyc
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes PATCH operation on ADMIN.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### PATCH /api/v1/admin/shops/:id/toggle
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes PATCH operation on ADMIN.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### DELETE /api/v1/admin/shops/:id/kyc-doc/:docIndex
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes DELETE operation on ADMIN.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### POST /api/v1/admin/shops/:id/payout-methods
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes POST operation on ADMIN.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### PATCH /api/v1/admin/shops/:id/payout-methods/:methodId
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes PATCH operation on ADMIN.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### DELETE /api/v1/admin/shops/:id/payout-methods/:methodId
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes DELETE operation on ADMIN.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### PATCH /api/v1/admin/shops/:id/payout-methods/:methodId/primary
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes PATCH operation on ADMIN.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### PATCH /api/v1/admin/shops/:id/owner
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes PATCH operation on ADMIN.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### GET /api/v1/admin/jobs/export
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes GET operation on ADMIN.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### GET /api/v1/admin/jobs/:id
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes GET operation on ADMIN.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### GET /api/v1/admin/payments/export
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes GET operation on ADMIN.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### GET /api/v1/admin/payouts
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes GET operation on ADMIN.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### PATCH /api/v1/admin/payouts/:id/status
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes PATCH operation on ADMIN.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### GET /api/v1/admin/suggestions
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes GET operation on ADMIN.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### PATCH /api/v1/admin/suggestions/:id/approve
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes PATCH operation on ADMIN.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### PATCH /api/v1/admin/suggestions/:id/reject
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes PATCH operation on ADMIN.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### GET /api/v1/admin/disputes
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes GET operation on ADMIN.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### PATCH /api/v1/admin/disputes/:id/status
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes PATCH operation on ADMIN.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

## CUSTOMER MODULE (/api/v1/customers)

### GET /api/v1/customers/top-pros
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes GET operation on CUSTOMER.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

## CATEGORY MODULE (/api/v1/categories)

### GET /api/v1/categories
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes GET operation on CATEGORY.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### GET /api/v1/categories/suggestions
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes GET operation on CATEGORY.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### PATCH /api/v1/categories/suggestions/:id
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes PATCH operation on CATEGORY.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### DELETE /api/v1/categories/:id
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes DELETE operation on CATEGORY.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### DELETE /api/v1/categories/:id/subcategories/:subId
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes DELETE operation on CATEGORY.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

## JOB MODULE (/api/v1/jobs)

## PAYOUT MODULE (/api/v1/payouts)

### GET /api/v1/payouts
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes GET operation on PAYOUT.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### PATCH /api/v1/payouts/:id/status
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes PATCH operation on PAYOUT.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

## SETTINGS MODULE (/api/v1/settings)

### GET /api/v1/settings/public
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes GET operation on SETTINGS.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### GET /api/v1/settings
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes GET operation on SETTINGS.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### PATCH /api/v1/settings
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes PATCH operation on SETTINGS.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

## NOTIFICATION MODULE (/api/v1/notifications)

### GET /api/v1/notifications/my
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes GET operation on NOTIFICATION.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### GET /api/v1/notifications/unread-count
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes GET operation on NOTIFICATION.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### PATCH /api/v1/notifications/read-all
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes PATCH operation on NOTIFICATION.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### PATCH /api/v1/notifications/:id/read
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes PATCH operation on NOTIFICATION.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### DELETE /api/v1/notifications/:id
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes DELETE operation on NOTIFICATION.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

## QUOTE MODULE (/api/v1/quotes)

## SHOP MODULE (/api/v1/shops)

### GET /api/v1/shops/my
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes GET operation on SHOP.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### PATCH /api/v1/shops/my/payout-methods/:methodId/primary
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes PATCH operation on SHOP.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### DELETE /api/v1/shops/my/payout-methods/:methodId
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes DELETE operation on SHOP.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### DELETE /api/v1/shops/my
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes DELETE operation on SHOP.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### GET /api/v1/shops/:id/delivery-config
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes GET operation on SHOP.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### PATCH /api/v1/shops/:id/delivery-config
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes PATCH operation on SHOP.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### GET /api/v1/shops
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes GET operation on SHOP.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### GET /api/v1/shops/:id
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes GET operation on SHOP.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

## PRODUCT MODULE (/api/v1/products)

### GET /api/v1/products
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes GET operation on PRODUCT.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### GET /api/v1/products/shop
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes GET operation on PRODUCT.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### GET /api/v1/products/:id
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes GET operation on PRODUCT.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### DELETE /api/v1/products/:id
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes DELETE operation on PRODUCT.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

## SHOPORDER MODULE (/api/v1/shoporders)

### GET /api/v1/shoporders/:id
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes GET operation on SHOPORDER.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### GET /api/v1/shoporders/:id/invoice
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes GET operation on SHOPORDER.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

## SUBSCRIPTION MODULE (/api/v1/subscriptions)

## WALLET MODULE (/api/v1/wallet)

### GET /api/v1/wallet/balance
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes GET operation on WALLET.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

## WORKER MODULE (/api/v1/workers)

### PATCH /api/v1/workers/me/bank
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes PATCH operation on WORKER.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### PATCH /api/v1/workers/me/services
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes PATCH operation on WORKER.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### PATCH /api/v1/workers/me/location
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes PATCH operation on WORKER.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

## CHAT MODULE (/api/v1/chat)

### GET /api/v1/chat/history
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes GET operation on CHAT.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### POST /api/v1/chat/send
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes POST operation on CHAT.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### POST /api/v1/chat/mark-read
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes POST operation on CHAT.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### GET /api/v1/chat/support/threads
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes GET operation on CHAT.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

## CART MODULE (/api/v1/cart)

### GET /api/v1/cart
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes GET operation on CART.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

## DELIVERYSTAFF MODULE (/api/v1/delivery-staff)

### GET /api/v1/delivery-staff
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes GET operation on DELIVERYSTAFF.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### POST /api/v1/delivery-staff
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes POST operation on DELIVERYSTAFF.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### PATCH /api/v1/delivery-staff/:staffId
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes PATCH operation on DELIVERYSTAFF.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### DELETE /api/v1/delivery-staff/:staffId
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes DELETE operation on DELIVERYSTAFF.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

## PROMOTION MODULE (/api/v1/promotions)

### GET /api/v1/promotions/banners
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes GET operation on PROMOTION.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### POST /api/v1/promotions/validate
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes POST operation on PROMOTION.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### GET /api/v1/promotions/banners/all
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes GET operation on PROMOTION.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### POST /api/v1/promotions/banners
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes POST operation on PROMOTION.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### PATCH /api/v1/promotions/banners/:id
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes PATCH operation on PROMOTION.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### DELETE /api/v1/promotions/banners/:id
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes DELETE operation on PROMOTION.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### GET /api/v1/promotions/promotions
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes GET operation on PROMOTION.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### POST /api/v1/promotions/promotions
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes POST operation on PROMOTION.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### PATCH /api/v1/promotions/promotions/:id
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes PATCH operation on PROMOTION.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### DELETE /api/v1/promotions/promotions/:id
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes DELETE operation on PROMOTION.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

## PAYMENT MODULE (/api/v1/payments)

### POST /api/v1/payments/create-order
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes POST operation on PAYMENT.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### POST /api/v1/payments/verify
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes POST operation on PAYMENT.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### GET /api/v1/payments/history
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes GET operation on PAYMENT.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### GET /api/v1/payments/:orderId
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes GET operation on PAYMENT.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

## ADMINWALLET MODULE (/api/v1/admin/admin-wallet)

### GET /api/v1/admin/admin-wallet/balance
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes GET operation on ADMINWALLET.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### GET /api/v1/admin/admin-wallet/transactions
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes GET operation on ADMINWALLET.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### POST /api/v1/admin/admin-wallet/credit
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes POST operation on ADMINWALLET.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### POST /api/v1/admin/admin-wallet/debit
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes POST operation on ADMINWALLET.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

### PATCH /api/v1/admin/admin-wallet/bank-details
- **Authentication**: JWT Bearer Token
- **Role Restrictions**: Any
- **Validation**: None
- **Parameters**: Extracted from payload / query.
- **Business Logic**: Executes PATCH operation on ADMINWALLET.
- **Database Actions**: CRUD on MongoDB collection.
- **Redis Actions**: Caching / Invalidation where applicable.
- **Socket Events**: Emits state changes to relevant user rooms.
- **Responses**: Standard successResponse(res, data, msg) format.
- **Errors**: Handled globally, mapped to HTTP statuses.
- **Performance**: Uses DB indexes and Redis cache.
- **Security**: Guarded by global rate limiting, Helmet headers, and JWT.

