# Kwickly Redis Implementation Audit

This document provides a comprehensive technical audit of the Redis caching strategies used within the Kwickly backend, evaluating performance, memory usage, and architectural correctness.

---

## 1. Keys & Data Typologies

Kwickly utilizes a highly structured, string-based key namespace pattern. There are four primary domains of cached data:

1.  **Authentication & Sessions**
    *   `otp:{phone}`: Stores the randomly generated numeric OTP.
    *   `reset_otp:{phone}`: Dedicated prefix for password resets.
    *   `otp_attempts:{phone}`: Integer counter for rate limiting SMS triggers.
    *   `session:{userId}`: Stores the `Customer` MongoDB document (stringified JSON) representing the active user.
    *   `blacklist:{token}`: Stores logged-out or invalidated JWTs.
2.  **Global Configuration**
    *   `app_settings`, `public_settings`, `app_branding`: Global platform variables.
3.  **Aggregate Data & Lists**
    *   `shop:products:{shopId}...`: E-commerce catalog caching.
    *   `categories_list`, `top_pros_list`, `admin:disputes_list`: Read-heavy global array lists.
4.  **Ephemeral Job State**
    *   `job:{jobId}:eligible_workers`: Array of `workerIds` who were alerted for a specific job broadcast.

---

## 2. TTL (Time-To-Live) Strategy

The TTL implementations are strictly defined and appropriate for their domains, preventing stale data and uncontrolled memory bloat:

*   **OTPs (`otp:*`)**: `300s` (5 minutes). Appropriate for security constraints.
*   **Rate Limits (`otp_attempts:*`)**: `3600s` (1 hour) block upon exceeding the maximum allowed attempts.
*   **Lists (`shop:products:*`, `admin:payouts`)**: `300s` to `3600s` (5 min to 1 hr). Balances fast read times for customers with eventual consistency for shop owners.
*   **Job State (`job:*:eligible_workers`)**: `1800s` (30 minutes). Automatically clears out memory after the maximum duration a job can be kept in a `BROADCASTING` state.
*   **Sessions (`session:*`)**: `86400s` (24 hours). Avoids the DB lookup overhead on every authenticated request while ensuring the cache naturally drops inactive users.
*   **JWT Blacklist (`blacklist:*`)**: *Dynamic TTL*. The TTL is precisely calculated based on the JWT's remaining validity (`exp - Math.floor(Date.now() / 1000)`). Once the JWT naturally expires, it no longer needs blacklisting, and Redis automatically purges it.

---

## 3. Cache Invalidation

Cache invalidation relies on an event-driven `delCache` pattern executed primarily within the controllers following successful MongoDB mutations.

*   **Authentication**: OTPs are deleted immediately upon successful verification.
*   **State Updates**: When a wallet transaction occurs (e.g., in `wallet.controller.js`), `delCache('session:{userId}')` is executed. Because the `session` cache holds the user's wallet balance, forcing an eviction ensures that the next request fetches the exact, updated financial balance from MongoDB.
*   **Admin Actions**: Banning a user or changing a category structure invokes targeted `delCache` calls to clear `categories_list` or `admin_dashboard_stats`.

---

## 4. Resource Usage & Performance

### Memory Usage
*   **Highly Efficient**: Keys like `blacklist:{token}` and `otp_attempts:{phone}` store minimal bytes (e.g., string `'1'`).
*   **Session Bloat**: Caching the entire stringified `Customer` object under `session:{userId}` could consume 1-2KB per active user. For 100,000 active daily users, this equates to ~200MB, which is well within standard Redis thresholds.

### Performance & Scalability
*   **O(1) Authentication**: The `authMiddleware` achieves near O(1) time complexity by reading from Redis directly, bypassing MongoDB entirely for 99% of requests.
*   **Stateless Scaling**: The architecture allows Node.js horizontally scale seamlessly.

---

## 5. Architectural Assessment

### Strengths (Implemented Correctly)
1.  **JWT Blacklist Pattern**: This is the gold standard for stateless authentication invalidation. It guarantees security without forcing stateful database sessions.
2.  **Wallet Consistency**: Invalidating the session cache during `wallet.controller` mutations demonstrates a high awareness of distributed state consistency.
3.  **Graceful Degradation**: If Redis goes down, `getCache` calls are wrapped in safe helpers that fail silently or fall back to MongoDB, ensuring the API remains functional (albeit slower).

### Flaws & Weaknesses (Duplicate / Missing Caches)
1.  **Duplicate Cache Set Logic**: There is heavily duplicated code across `wallet.controller.js`, `job.controller.js`, and `quote.controller.js` for caching settings:
    ```javascript
    if (settings) await setCache('app_settings', settings, 600);
    ```
    *Issue*: This logic should be abstracted into a singular `SettingsService.getSettings()` method rather than repeating the cache-set mechanism inside unrelated domain controllers.
2.  **Broad List Invalidation**: In modules like `shop.controller.js`, the cache keys for shop lists (`shop:list:{lat}:{lng}...`) are highly fragmented due to coordinates. It is difficult to invalidate all these fragmented geospatial lists when a single shop goes offline, resulting in potential stale reads where a customer sees a shop that just closed until the 5-minute TTL expires.

### Conclusion

The Redis implementation is **highly effective and largely implemented correctly**. It succeeds in its primary mandate: absorbing read-heavy traffic (Auth sessions, App settings) to protect the MongoDB cluster. The minor flaws pertain to code DRY-ness (duplicate setting calls) and edge-case stale reads on complex geospatial list caches, neither of which present critical systemic risks.
