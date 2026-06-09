# Kwickly – Software Requirements Specification (SRS) v4.1

**Date:** June 2026  
**Document Version:** 4.1  
**Tagline:** *Every Service. Anytime. Near You.*

---

## 1. Overview

Kwickly is a multi-role, on-demand services + hyperlocal shop marketplace for iOS and Android (built once via TanStack Start + Capacitor / React Native shell). Four roles share a single app shell with role-based screens.

| Role     | Purpose |
|----------|---------|
| **Customer** | Books services (real-time bidding) and buys shop products |
| **Worker**   | Receives job alerts, places bids, executes service, gets paid |
| **Shop**     | Registers shop, manages products & orders, fulfils deliveries |
| **Admin**    | Configures platform, KYC, categories, commissions, payouts |

---

## 2. Theme & Design System

- **Font:** Plus Jakarta Sans (400/500/600/700/800)
- **Brand colors:** `#0e9aa7` (brand teal), `#43e3eb` (accent cyan from logo), `#7ed957` (success green), `#0f1b3d` (deep navy)
- **Light + Dark mode** via `data-theme` attribute, tokens defined in CSS custom props (`--bg`, `--surface`, `--text`, `--brand`…)
- **Mobile-first**, `viewport-fit=cover`, safe-area insets, native bottom tab bar
- Logo: black square with cyan speed-arrow ⏱ — used in splash, top bar, login

---

## 3. Roles & Functional Flows

### 3.1 Customer — Service Booking (Real-time Bidding)
1. Browse / search categories → sub-categories  
2. Describe issue + upload **photos + video** + address (GPS/Manual) + time slot (or urgent). *(Budget input removed)*
3. **Post Job** → push-notify all eligible nearby workers.
4. **Live Bids screen** — bids stream in (name, rating, jobs, distance, ETA, price)  
5. Customer **Accepts** one worker → all other bidders auto-notified "job taken"  
6. **Live Tracking** map + ETA + chat/call + 4-digit **Arrival OTP**  
7. Worker arrives → customer shares OTP → worker enters → work timer starts  
8. Worker uploads **before/after photos + video** → marks complete  
9. Customer reviews completion media → pays online (UPI/Card/Wallet)  
10. **Auto-split**: Worker wallet credited (amount − commission), platform wallet credited  
11. **Rate worker** (1–5 ★) + optional review  

### 3.2 Customer — Shop Flow & Profile Management
- **Shop Flow:** Browse nearby shops, add products to cart, checkout with online payment. Live tracking (New → Packing → Out → Delivered).
- **Bookings & Invoices:** View detailed booking and shop order history with downloadable invoices.
- **Profile Management:** Edit profile image/details. Manage multiple addresses (GPS/map picker, set primary). Manage Payment Methods (add/update/delete cards/UPI, set primary). Refer & Earn, Help & Support.

### 3.3 Worker
- **Onboarding:** KYC + bank + service categories. Can suggest missing categories/sub-categories to admin for approval.
- **Subscription Plans:** Workers top up their account via subscription plans (Monthly, Quarterly, Half-Yearly, Yearly) instead of per-bid fees. Shows remaining free trial days.
- **Job Alerts:** Receives push alerts with job description, customer media, distance, and location. (Customer budget is hidden).
- **Place Bid:** Worker submits Bid Amount, Note, and **Current Location** (GPS or manual). No bid fees deducted.
- **My Bids:** View all past/current bids with filters (All, Pending, Won, Lost) and detailed bid view screens.
- **Job Execution:** If accepted: navigate → arrival OTP → timer → completion media → mark complete. Auto-credit (bid − commission) on customer payment.
- **Wallet & Payouts:** View earnings, subscribe to plans, withdraw to bank.

### 3.4 Shop Owner
- **Shop Profile:** Edit shop details and upload shop image logo.
- **Address & Business:** Set address via GPS/Map, manage business hours and delivery settings.
- **KYC & Payouts:** Upload PDF/JPG documents for GST/Registration, view/download them. Add/update/delete multiple payout methods (Bank Accounts & UPI) and set primary.
- **Products CRUD:** Add/edit products with name, price, stock, min qty, and **Image Uploads**.
- **Orders Dashboard:** Functional filters (All, New, Packing, Out, Delivered) with status update buttons.
- **Wallet:** Recent transactions list with clickable detailed invoices (downloadable).
- **Analytics:** Filter by date range, sort by parameters, view top categories, and generate/download PDF reports.

### 3.5 Admin
- Dashboard: users, workers, shops, revenue, bookings trend
- User management: search, view, verify, block
- Category Management: CRUD categories, approve/reject worker-suggested categories.
- Payouts & Approvals: review, approve, batch-process worker/shop withdrawals and KYC docs.
- Settings: commission %, default free-delivery threshold, referral bonus, trial durations.

---

## 4. Notification Matrix

| Event | Recipient(s) |
|-------|-------------|
| Customer posts job | All matching online workers with active subscriptions |
| Worker places bid | Customer |
| Customer accepts worker | Accepted worker (assigned) + all other bidders (job taken) |
| Worker arrives / OTP entered | Customer |
| Work completed | Customer |
| Payment received | Worker (credit) + Admin |
| Shop receives order | Shop owner |
| Order status changed | Customer |

---

## 5. Data Models (key entities)

- `User { id, role, name, phone, email, avatar, kyc_status, wallet_balance, rating, addresses[], payment_methods[] }`
- `Worker { user_id, categories[], radius_km, online, kyc_docs[], subscription_days_left, bank }`
- `Shop { id, owner_user_id, name, logo, address, geo, hours, free_delivery_min, delivery_fee, kyc_docs[], payout_methods[] }`
- `Product { id, shop_id, name, price, stock, min_qty, image_url, active }`
- `Booking { id, customer_id, category, subcategory, description, media[], address, geo, time_slot, status, accepted_worker_id, arrival_otp, completion_media[], amount, commission }`
- `Bid { id, booking_id, worker_id, amount, note, worker_location, status }`
- `ShopOrder { id, shop_id, customer_id, items[], total, status, delivery_otp }`
- `WalletTxn { id, user_id, type, amount, ref_id, invoice_url, created_at }`
- `Category { id, name, icon, subs[], status (active/pending) }`

---

## 6. Settlement / Money

- **Commission** (configurable, default 10%) deducted from worker payout on job completion.
- **Worker Subscriptions** replace per-bid fees. Workers buy duration-based plans.
- **Wallet** is the single ledger; withdrawals to verified bank accounts or UPI IDs.

---

## 7. Tech Stack (recommendation)

- Frontend: TanStack Start (web) + Capacitor wrapper for iOS/Android, Plus Jakarta Sans
- Backend: Lovable Cloud (Supabase) — auth, Postgres w/ RLS, storage for media, edge functions
- Realtime: Supabase Realtime for bids + tracking
- Push: FCM (Android) + APNs (iOS) via Capacitor Push Notifications
- Maps: Google Maps / Mapbox
- Payments: Razorpay / Stripe with payout split

---

## 8. Screens Implemented in Prototype v4

**Auth:** Splash, Login (mobile OTP + Google/Apple), OTP, Role Onboard

**Customer:** Home, All Categories, Sub-categories, Describe Job + Media, Live Bids, Live Tracking + OTP, Completion + Pay, Rate, Bookings list, Booking Details/Invoice, Shops list, Shop detail, Cart, Wallet, Profile, Manage Address, Manage Payments.

**Worker:** Home + Job Alert, Job Detail + Bid (with GPS location), Navigate, Arrival OTP, In-Progress timer, Completion upload, Done + earnings, Rate customer, My Bids (with filters & detail views), Earnings/Subscription Plans, My Services (with suggestions), Profile.

**Shop:** Dashboard, Orders list (with filters) + detail, Products list + add/edit image modal, Wallet + Invoice modal, Shop Settings (Image upload, GPS Address, KYC PDF viewer, Bank/UPI methods, Analytics PDF).

**Admin:** Overview + charts, Users, Categories (with approvals), Payouts approval, Platform Settings.

---

*End of SRS v4.1*
