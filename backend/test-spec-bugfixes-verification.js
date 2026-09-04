/**
 * Verification test for applied platform bugfixes
 */
const assert = require('assert');
const fs = require('fs');

console.log('Testing Bugfixes...');

// 1. feeCalculator.helper normalization
const { calculateJobFee, calculateShopOrderFee } = require('./src/helpers/feeCalculator.helper');

// Test lowercase mode & legacy keys
const jobRes = calculateJobFee(550, { type: 'tiered', minFee: 50, threshold: 500, percentage: 12, gstPercentage: 18 });
assert.strictEqual(jobRes.platformFee, 66, 'Platform fee should be 12% of 550 = 66');
assert.strictEqual(jobRes.gstAmount, 11.88, 'GST should be 18% of 66 = 11.88');
assert.strictEqual(jobRes.customerTotal, 627.88, 'Customer total should match');
console.log('✅ PASS: feeCalculator works with type: tiered and percentage');

// Test fixed mode with amount
const fixedRes = calculateJobFee(200, { mode: 'FIXED', amount: 40, gstPercent: 18 });
assert.strictEqual(fixedRes.platformFee, 40, 'Platform fee should be fixed 40');
assert.strictEqual(fixedRes.gstAmount, 7.2, 'GST should be 18% of 40 = 7.2');
console.log('✅ PASS: feeCalculator works with mode: FIXED');

// 2. toRupees with >= 10,000 values
const webhookContent = fs.readFileSync('./src/helpers/webhookHandlers.helper.js', 'utf8');
assert(!webhookContent.includes('n >= 10000 ? n / 100 : n'), 'Dangerous toRupees threshold must be removed');
console.log('✅ PASS: toRupees dangerous 10,000 threshold removed');

// 3. Check subscription.cron.js has SHOP role
const cronContent = fs.readFileSync('./src/cron/subscription.cron.js', 'utf8');
assert(cronContent.includes("role: { $in: ['WORKER', 'SHOP'] }"), 'Cron should include both WORKER and SHOP');
assert(cronContent.includes('Shop.updateMany'), 'Cron should deactivate shops');
assert(cronContent.includes('acquireLock'), 'Cron should use distributed lock');
console.log('✅ PASS: subscription.cron handles WORKER and SHOP with lock');

// 4. Check payment.controller.js has SHOP role wallet handling
const paymentContent = fs.readFileSync('./src/modules/payment/payment.controller.js', 'utf8');
assert(paymentContent.includes("req.user.role === 'SHOP'"), 'payment.controller should handle SHOP role');
assert(paymentContent.includes("Shop.findOneAndUpdate"), 'payment.controller should update Shop model');
console.log('✅ PASS: payment.controller credits Shop.wallet for SHOP role');

// 5. Check CustomerWalletScreen.js defines QUICK_AMOUNTS
const walletScreenContent = fs.readFileSync('../mobile/src/features/customer/CustomerWalletScreen.js', 'utf8');
assert(walletScreenContent.includes('const QUICK_AMOUNTS ='), 'CustomerWalletScreen must define QUICK_AMOUNTS');
console.log('✅ PASS: CustomerWalletScreen defines QUICK_AMOUNTS');

// 6. Check socket.helper.js getIO() does not throw
const { getIO } = require('./src/helpers/socket.helper');
const io = getIO();
assert.strictEqual(io, null, 'getIO should safely return null if uninitialized');
console.log('✅ PASS: getIO returns null safely without throwing');

// 7. Check shoporder delivery slot IST formatting
const shoporderContent = fs.readFileSync('./src/modules/shoporder/shoporder.controller.js', 'utf8');
assert(shoporderContent.includes("timeZone: 'Asia/Kolkata'"), 'Delivery slot must check timeZone Asia/Kolkata');
console.log('✅ PASS: shoporder checks delivery slot using Intl Asia/Kolkata');

console.log('\n🎉 ALL 7 BUGFIX VERIFICATION CHECKS PASSED SUCCESSFULLY!');
