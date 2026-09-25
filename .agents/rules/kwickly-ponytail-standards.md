# Kwickly Workspace Rules: Minimalist Engineering & System Invariants

## Ponytail Execution Ladder
1. **YAGNI**: Reject speculative features and unnecessary wrappers.
2. **Codebase Reuse**: Inspect `backend/src/models/`, `backend/src/helpers/`, and existing UI components before authoring new utilities.
3. **Standard Library**: Prefer native modern JS/Node features over external packages.
4. **Platform First**: Use native React Native / Expo primitives on mobile and native HTML5 on web/admin.
5. **No Package Bloat**: Do not install new dependencies in `backend`, `mobile`, or `admin` unless explicitly directed.
6. **One-Line / Simple**: Implement the cleanest, most concise solution.
7. **Minimal Diffs**: Make targeted, surgical edits.

## Invariant Protections
- **No Logic Breaks**: Preserve all state machines from `docs/PRODUCT-FLOWS.md` for Jobs (`BROADCASTING` → `CLOSED`) and Shop Orders (`NEW` → `DELIVERED`).
- **Zero Latency**: Maintain Upstash Redis hot-path caches, distributed locks, lean Mongoose queries (`.lean()`, `.select()`), and lightweight WebSocket payloads.
- **Admin & Mobile Sync**: Ensure any backend status update emits the exact corresponding Socket.io event to synchronize Admin and Mobile clients simultaneously.
- **Role Parity**: Guarantee that Customer, Worker, Shop, and Admin flows retain all validation gates (OTP verification, zero-trust UTR checks, double-entry ledger idempotency, and subscription checks).
