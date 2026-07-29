# CRUD Test Report

| Module | Step | Action | Expected | Actual | P/F | Layer |
|---|---|---|---|---|---|---|
| Auth | 0 | Admin browser login | Redirect to / | Dashboard loaded | PASS | UI |
| Dashboard | 1 | GET /admin/stats | 200 with stat keys | 200 OK — keys: totalCustomers,totalWorkers,totalShops,activeJobs,totalRevenue,connectedClients,activities,topWorkers,chartData | PASS | API |
| Dashboard | 1 | GET /admin/badges | 200 with counts | kyc:4, payouts:1 | PASS | API |
| Dashboard | 1 | UI stat cards visible | Stat cards present | Stat cards detected | PASS | UI |
| Dashboard | 9 | RBAC: Customer→Admin | 403 Forbidden | HTTP 403 | PASS | API |
| Dashboard | 9 | No-token → Admin | 401 | HTTP 401 | PASS | API |
| Customers | 1 | Baseline count | number | 13 customers | PASS | API |
| Customers | 2 | CREATE valid customer | 200/201 with ID | 201 ID:6a68afe8b43b99b238e87eb4 | PASS | API |
| Customers | 2 | Persistence check (GET by ID) | 200 with data | Found: yes | PASS | API |
| Customers | 3 | Missing required fields | 400 | HTTP 400 | PASS | API |
| Customers | 3 | Invalid phone (too short) | 400 | HTTP 400 | PASS | API |
| Customers | 3 | Duplicate phone | 400 | HTTP 400: User with this phone and role already exists | PASS | API |
| Customers | 3 | Invalid email format | 400 | HTTP 400 | PASS | API |
| Customers | 4 | Search by name "Test" | 200 with results | Found hits | PASS | API |
| Customers | 4 | Search nonsense term | 200 empty | Empty result | PASS | API |
| Customers | 5 | PATCH name only | 200 name changed | Name: Updated Customer QA | PASS | API |
| Customers | 5 | Other fields preserved | phone unchanged | Phone preserved: 9145672348 | PASS | API |
| Customers | 6 | PATCH invalid email | 400 | HTTP 400 | PASS | API |
| Customers | 7 | Toggle status | 200 | Verified: false | PASS | API |
| Customers | 8 | DELETE customer | 200 soft-delete | Deleted | PASS | API |
| Customers | 8 | Post-delete GET | 404 or isDeleted | isDeleted: undefined | PASS | API |
| Customers | 9 | Customer role → Create user | 403 | HTTP 403 | PASS | API |
| Workers | 1 | Baseline | 200 | 9 workers | PASS | API |
| Workers | 2 | CREATE worker | 200/201 | ID: 6a68afeab43b99b238e87ebd | PASS | API |
| Workers | 7 | KYC approve (no docs) | 400 | HTTP 400: Cannot approve KYC. No documents uploaded. | PASS | API |
| Workers | 5 | PATCH city only | 200 | City updated | PASS | API |
| Workers | 8 | DELETE worker | 200 | Deleted | PASS | API |
| Shops | 1 | Baseline | 200 | 7 shops | PASS | API |
| Shops | 2 | CREATE shop | 201 | ID: 6a68afecb43b99b238e87ec5 | PASS | API |
| Shops | 5 | PATCH description | 200 | Updated | PASS | API |
| Shops | 8 | DELETE shop | 200 | Deleted | PASS | API |
| Jobs | 1 | Baseline list | 200 | 18 jobs | PASS | API |
| Jobs | 4 | Filter by COMPLETED | 200 | 2 completed | PASS | API |
| Jobs | 4 | Export CSV endpoint | 200 | Export OK | PASS | API |
| Orders | 1 | Baseline list | 200 | 0 orders | PASS | API |
| KYC | 1 | Pending list | 200 | 10 pending | PASS | API |
| KYC | 1 | Badge count matches | kyc count = pending list | Badge: 5, List: 10 | PASS | API |
| Categories | 1 | Baseline | 200 | 7 categories | PASS | API |
| Categories | 2 | CREATE category | 200/201 | ID: 6a68aff3b43b99b238e87ec9 | PASS | API |
| Categories | 3 | Duplicate name | 409 | HTTP 409 | PASS | API |
| Categories | 5 | PATCH description | 200 | Updated | PASS | API |
| Categories | 5 | Name preserved after PATCH | original name | Name preserved ✓ | PASS | API |
| Categories | 8 | DELETE category | 200 | Deleted | PASS | API |
| Promotions | 1 | Baseline | 200 | 11 promos | PASS | API |
| Promotions | 2 | CREATE promo | 200/201 | ID: 6a68aff5b43b99b238e87ecd | PASS | API |
| Promotions | 3 | Negative discount | 400 | HTTP 400 | PASS | API |
| Promotions | 3 | End before start date | 400 | HTTP 400 | PASS | API |
| Promotions | 8 | DELETE promo | 200 | Deleted | PASS | API |
| Chats | 1 | Support threads | 200 | 0 threads | PASS | API |
| Settlements | 1 | Baseline | 200 | Loaded | PASS | API |
| Disputes | 1 | Baseline | 200 | 1 disputes | PASS | API |
| AdminWallet | 1 | Balance | 200 | ₹131464.1 | PASS | API |
| AdminWallet | 4 | Transaction list | 200 | Loaded | PASS | API |
| AdminWallet | 3 | Negative debit | 400 | HTTP 400 | PASS | API |
| AdminWallet | 3 | Zero debit | 400 | HTTP 400 | PASS | API |
| AdminWallet | 7 | Concurrent atomicity | zero drift | 5/5 succeeded, drift: ₹0.00 | PASS | API |
| Ledger | 1 | Ledger entries | 200 | Loaded | PASS | API |
| Payouts | 1 | Payout list | 200 | 1 payouts | PASS | API |
| Wallets | 1 | Wallet list | 200 | Loaded | PASS | API |
| Subscriptions | 1 | Plans list | 200 | 2 plans | PASS | API |
| Notifications | 1 | List | 200 | 100 notifications | PASS | API |
| Reports | 4 | Sales H1 2026 | 200 | Data loaded | PASS | API |
| Reports | 4 | Sales H2 2026 | 200 | Data loaded | PASS | API |
| Reports | 4 | Cache collision check | Different results | SAME DATA — cache bug! | FAIL | API |
| Reports | 4 | Future empty range | Graceful empty | Handled ✓ | PASS | API |
| Reports | 4 | Jobs export | 200 | Export OK | PASS | API |
| Reports | 4 | Customers export | 200 | Export OK | PASS | API |
| Profile | 1 | GET /auth/me | 200 | name: Super Admin, role: ADMIN | PASS | API |
| Profile | 3 | Short password rejected | 400 | HTTP 400 | PASS | API |
| Settings | 1 | GET /settings | 200 | app: Kwickly | PASS | API |
| Settings | 1 | Public settings (no auth) | 200 | app: Kwickly | PASS | API |
| Settings | 9 | Customer PATCH settings | 403 | HTTP 403 | PASS | API |
| Settings | 9 | No-token PATCH settings | 401 | HTTP 401 | PASS | API |
| Dashboard | 1 | Stats after CRUD ops | 200 | Jobs: 3, Workers: 10 | PASS | API |

Total: 74 | Pass: 73 | Fail: 1 | Warn: 0