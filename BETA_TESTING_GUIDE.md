# 🧪 Kwickly Beta Testing Guide

**Beta Version:** 1.0.0-beta  
**Date:** July 31, 2026  
**Status:** ✅ **READY FOR BETA TESTING**

---

## 🌐 Live Deployment

### Backend API
- **URL:** https://5000-90071f46fd2b7814.monkeycode-ai.live
- **Status:** ✅ Running
- **Port:** 5000
- **Environment:** Test

### Admin Panel
- **URL:** https://4173-90071f46fd2b7814.monkeycode-ai.live
- **Status:** ✅ Running
- **Port:** 4173
- **Features:** All 22 modules functional

---

## 👥 Test Accounts

All accounts are pre-seeded and ready for immediate testing.

### 🔐 Admin Account

| Email | Password | Access |
|-------|----------|--------|
| admin@kwickly.com | admin123 | Full admin panel access |

**Test at:** https://4173-90071f46fd2b7814.monkeycode-ai.live

---

### 🛒 Customer Accounts (Password: customer123)

| Phone | Name | Wallet | Email | Test Scenarios |
|-------|------|--------|-------|----------------|
| 9000000001 | Rahul Sharma | ₹1,000 | customer1@kwickly.com | Browse, Order, Track |
| 9000000003 | Priya Singh | ₹500 | customer2@kwickly.com | Cart, Wallet Topup |
| 9000000004 | Arjun Patel | ₹2,000 | customer3@kwickly.com | Premium user testing |
| 9000000005 | Sneha Reddy | ₹750 | customer4@kwickly.com | Regular user |

---

### 🔧 Worker Accounts (Password: worker123)

| Phone | Name | KYC | Plan | Wallet | Skills |
|-------|------|-----|------|--------|--------|
| 9876543210 | Amit Kumar | ✅ Approved | Pro | ₹500 | Plumbing, Electrical |
| 9876543211 | Rajan Verma | ⏳ Pending | Free | ₹250 | Carpentry, Painting |
| 9876543212 | Vikram Singh | ⏳ Pending | Free | ₹0 | AC Repair |
| 9876543213 | Suresh Yadav | ✅ Approved | Pro | ₹1,200 | Cleaning, Pest Control |
| 9876543214 | Mohd. Akram | ✅ Approved | Monthly | ₹800 | Beauty, Salon |

---

### 🏪 Shop Accounts (Password: shop123)

| Phone | Shop Name | Category | Wallet | Products |
|-------|-----------|---------|--------|----------|
| 9000000002 | Kwickly Mart | Grocery | ₹5,000 | 5 items |
| 9000000006 | Fresh Groceries Express | Grocery | ₹3,000 | 5 items |
| 9000000007 | Electronics Hub | Electronics | ₹10,000 | 4 items |

---

## ✅ Beta Testing Checklist

### Phase 1: Authentication (30 mins)

- [ ] Admin login at https://4173-90071f46fd2b7814.monkeycode-ai.live
- [ ] Customer login via mobile API
- [ ] Worker login via mobile API
- [ ] Shop login via mobile API
- [ ] Test password-based login
- [ ] Test OTP flow (uses static OTP: 1234)
- [ ] Verify JWT tokens work
- [ ] Test logout functionality

**Expected:** All logins successful, tokens valid

---

### Phase 2: Admin Panel Testing (1 hour)

**URL:** https://4173-90071f46fd2b7814.monkeycode-ai.live

#### Dashboard
- [ ] View overall statistics
- [ ] Check metrics display
- [ ] Verify data accuracy

#### User Management
- [ ] View all customers (4 accounts)
- [ ] View all workers (5 accounts)
- [ ] View all shops (3 accounts)
- [ ] Edit user details
- [ ] Test search functionality

#### KYC Management
- [ ] View pending KYC (2 workers)
- [ ] Approve/Reject KYC
- [ ] Verify KYC documents display

#### Orders & Jobs
- [ ] View all shop orders
- [ ] View all service jobs
- [ ] Filter by status
- [ ] Track order history

#### Financial
- [ ] View settlements
- [ ] Check payouts
- [ ] Verify wallet transactions
- [ ] Admin wallet operations

#### Other Modules
- [ ] Categories management
- [ ] Promotions
- [ ] Subscriptions
- [ ] Notifications
- [ ] Support chat
- [ ] Reports
- [ ] Settings

**Expected:** All 22 modules functional, no errors

---

### Phase 3: Customer Flow Testing (1 hour)

**Login as:** 9000000001 / customer123

#### Browse & Search
- [ ] View all categories (15 categories)
- [ ] Browse subcategories
- [ ] Search for services
- [ ] Filter by category

#### Shop Testing
- [ ] View available shops
- [ ] Browse shop products
- [ ] View shop details
- [ ] Check ratings

#### Cart & Orders
- [ ] Add products to cart
- [ ] Update cart quantities
- [ ] Remove items
- [ ] Place shop order
- [ ] Track order status
- [ ] Cancel order (if pending)
- [ ] Rate completed order

#### Service Booking
- [ ] Select service category
- [ ] Describe job requirements
- [ ] Choose preferred date/time
- [ ] Submit job request
- [ ] View received quotes
- [ ] Accept a quote
- [ ] Track job progress

#### Wallet
- [ ] Check wallet balance (₹1,000)
- [ ] View transaction history
- [ ] Test topup (Razorpay test mode)
- [ ] Test withdrawal

#### Profile Management
- [ ] View profile details
- [ ] Update profile information
- [ ] Add delivery addresses
- [ ] Set default address
- [ ] Update notification preferences

**Expected:** Smooth browsing to order completion, no crashes

---

### Phase 4: Worker Flow Testing (1 hour)

**Login as:** 9876543210 / worker123

#### Profile Setup
- [ ] View worker dashboard
- [ ] Check KYC status (Approved)
- [ ] Update services offered
- [ ] Set working hours
- [ ] Update location

#### Job Management
- [ ] Go online (toggle status)
- [ ] View available jobs nearby
- [ ] Place quotes on jobs
- [ ] View quote status
- [ ] Accept assigned jobs
- [ ] Update job status (Arrived → Started → Complete)
- [ ] Rate customer after completion

#### Earnings
- [ ] View earnings summary
- [ ] Check earnings chart
- [ ] View transaction history
- [ ] Request withdrawal

#### Subscription
- [ ] View subscription plans
- [ ] Check current plan (Pro)
- [ ] Upgrade subscription (test payment)

#### Profile Management
- [ ] Update profile photo
- [ ] Edit personal details
- [ ] Update bank details
- [ ] Add address

**Expected:** Complete job lifecycle from quote to payment

---

### Phase 5: Shop Flow Testing (1 hour)

**Login as:** 9000000002 / shop123

#### Shop Management
- [ ] View shop dashboard
- [ ] Check shop statistics
- [ ] Update shop details
- [ ] Configure delivery settings

#### Product Management
- [ ] View existing products (5 items)
- [ ] Add new product
- [ ] Edit product details
- [ ] Update pricing
- [ ] Manage inventory stock
- [ ] Delete product

#### Order Processing
- [ ] View incoming orders
- [ ] Accept order
- [ ] Update order status (Preparing → Ready → Out for Delivery → Delivered)
- [ ] Assign delivery staff
- [ ] Generate invoice

#### Financial
- [ ] Check wallet balance (₹5,000)
- [ ] View settlements
- [ ] Request payout
- [ ] Check transaction history

#### Shop Settings
- [ ] Update delivery radius
- [ ] Set delivery charges
- [ ] Configure free delivery threshold
- [ ] Manage shop hours
- [ ] Update notification settings

**Expected:** Complete order fulfillment cycle

---

### Phase 6: Error Handling Testing (30 mins)

**Test Error Scenarios:**

#### Network Errors
- [ ] Turn off internet and try login
- [ ] Verify user-friendly error message
- [ ] Check error doesn't crash app

#### Validation Errors
- [ ] Submit form with invalid email
- [ ] Enter wrong pincode format
- [ ] Test invalid phone number
- [ ] Submit empty required fields
- [ ] Verify validation messages appear

#### Authentication Errors
- [ ] Login with wrong password
- [ ] Use expired token
- [ ] Access protected route without auth
- [ ] Verify 401 handling

#### Server Errors
- [ ] Test with backend stopped
- [ ] Verify 500 error handling
- [ ] Check retry mechanism

**Expected:** User-friendly messages, no crashes, proper logging

---

### Phase 7: API Testing (30 mins)

**Test Key Endpoints:**

```bash
# Categories
GET https://5000-90071f46fd2b7814.monkeycode-ai.live/api/v1/categories

# Settings
GET https://5000-90071f46fd2b7814.monkeycode-ai.live/api/v1/settings/public

# Auth
POST https://5000-90071f46fd2b7814.monkeycode-ai.live/api/v1/auth/login
Body: {"phone":"9000000001","password":"customer123","role":"CUSTOMER"}

# Customer Profile (with token)
GET https://5000-90071f46fd2b7814.monkeycode-ai.live/api/v1/customers/me/profile
```

**Verify:**
- [ ] All endpoints return JSON
- [ ] Status codes are correct (200, 201, 400, 401, 404, 500)
- [ ] Response times < 100ms
- [ ] Error messages are descriptive

---

## 📊 Expected Results

### Success Criteria

| Component | Success Rate | Status |
|-----------|-------------|--------|
| Authentication | 100% login success | ✅ Required |
| Admin Panel | 22/22 modules working | ✅ Required |
| Customer Flow | 95% completion rate | ✅ Required |
| Worker Flow | 95% completion rate | ✅ Required |
| Shop Flow | 95% completion rate | ✅ Required |
| API Endpoints | >99% uptime | ✅ Required |
| Error Handling | No crashes | ✅ Required |
| Response Time | <100ms average | ✅ Required |

---

## 🐛 Bug Reporting Template

When you find a bug, report it using this format:

```markdown
### Bug Title
[Brief description]

### Steps to Reproduce
1. Login as [role]
2. Navigate to [page]
3. Click on [button]
4. See error

### Expected Behavior
[What should happen]

### Actual Behavior
[What actually happened]

### Environment
- Device: [Mobile/Desktop]
- Role: [Customer/Worker/Shop/Admin]
- Account: [phone/email]
- Browser: [Chrome/Safari/etc]

### Screenshots/Logs
[Attach if available]

### Severity
- [ ] Critical (blocks entire flow)
- [ ] High (feature broken)
- [ ] Medium (workaround exists)
- [ ] Low (cosmetic)
```

---

## 🔧 Technical Support

### Access Logs
```bash
# Backend logs
cat /tmp/terminal_term_1785474368179_9.log

# Admin logs
cat /tmp/terminal_term_1785474374776_10.log
```

### Health Check
```bash
curl https://5000-90071f46fd2b7814.monkeycode-ai.live/api/v1/categories
```

### Contact
For technical issues, check:
- Backend: `/tmp/backend_beta.log`
- Admin: `/tmp/admin_beta.log`
- Repository: https://github.com/chauhan1199/kwickly-app

---

## 📝 Beta Testing Report Template

At the end of beta testing, compile results:

```markdown
# Beta Testing Report - Kwickly v1.0.0

## Testing Summary
- Duration: [X hours/days]
- Testers: [Number]
- Test Accounts Used: [List]

## Results
- Total Test Cases: [Number]
- Passed: [Number] ([%])
- Failed: [Number] ([%])
- Blocked: [Number] ([%])

## Bugs Found
- Critical: [Number]
- High: [Number]
- Medium: [Number]
- Low: [Number]

## Performance Metrics
- Avg Response Time: [X]ms
- Peak Response Time: [X]ms
- API Uptime: [%]

## Recommendations
[List recommendations for improvements]

## Go/No-Go Decision
[Recommend proceeding to public launch or not]
```

---

## ✅ Pre-Beta Verification

Complete this before starting beta testing:

- [ ] Backend server running (https://5000-90071f46fd2b7814.monkeycode-ai.live)
- [ ] Admin panel running (https://4173-90071f46fd2b7814.monkeycode-ai.live)
- [ ] MongoDB connected ✅
- [ ] Redis connected ✅
- [ ] All test accounts accessible ✅
- [ ] Error handling tested ✅
- [ ] API validators working ✅

---

## 🎯 Next Steps After Beta

### If Beta Successful (≥95% pass rate):
1. Fix reported bugs
2. Prepare for public launch
3. Set up production environment
4. Configure monitoring
5. Plan rollout strategy

### If Beta Issues (<95% pass rate):
1. Prioritize critical bugs
2. Fix and retest
3. Extend beta period
4. Gather more feedback
5. Re-evaluate launch timeline

---

## 📚 Additional Documentation

- **Platform Docs:** `/workspace/KWICKLY_PLATFORM_DOCS.md`
- **API Tests:** `/workspace/MOBILE_APP_TEST_REPORT.md`
- **Critical Fixes:** `/workspace/CRITICAL_FIXES_COMPLETED.md`
- **Pending Analysis:** `/workspace/PENDING_ITEMS_ANALYSIS.md`
- **Mobile Build:** `/workspace/mobile/README_BUILD.md`

---

**Beta Testing Start Date:** July 31, 2026  
**Expected Duration:** 1-2 weeks  
**Target Launch:** After successful beta completion  

**Status:** 🟢 **READY FOR BETA TESTING**

---

**Prepared By:** AI Coding Assistant  
**Version:** 1.0.0-beta  
**Last Updated:** July 31, 2026
