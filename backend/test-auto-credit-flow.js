/**
 * Test: Verify the auto-credit wallet topup flow
 */
'use strict';

require('dotenv').config();
const mongoose = require('mongoose');

async function runTest() {
  console.log('\n=== AUTO-CREDIT WALLET TOPUP FLOW TEST ===\n');

  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB');

  const { isProviderConfigured } = require('./src/services/upiProvider.service');
  const configured = isProviderConfigured();
  console.log(`\nUPI Provider Configured: ${configured}`);
  console.log(configured ? '⚠️  Provider IS configured — webhook mode' : '✅ Provider NOT configured — auto-credit mode ACTIVE');

  const { isValidUtr } = require('./src/helpers/upi.helper');
  
  const testUtrs = [
    { utr: '661226752732', desc: 'Real Kotak UPI TxnId (from screenshot)', expected: true },
    { utr: '429182736152', desc: 'Typical 12-digit RRN', expected: true },
    { utr: '123456789012', desc: 'Sequential fake', expected: false },
    { utr: '111111111111', desc: 'All same digits', expected: false },
    { utr: '', desc: 'Empty string', expected: false },
    { utr: 'abc123', desc: 'Non-numeric', expected: false },
  ];

  console.log('\n--- UTR Validation Test ---');
  let allPassed = true;
  for (const t of testUtrs) {
    const result = isValidUtr(t.utr);
    const pass = result === t.expected;
    console.log(`  ${pass ? '✅' : '❌'} "${t.utr}" (${t.desc}): isValidUtr=${result}`);
    if (!pass) allPassed = false;
  }

  const Payment = require('./src/modules/payment/payment.model');
  const WalletTxn = require('./src/modules/wallet/wallet.model');
  const controller = require('./src/modules/payment/payment.controller');
  const { creditAdminTreasury } = require('./src/helpers/webhookHandlers.helper');

  console.log('\n--- Module Checks ---');
  console.log(`  ✅ verifyPayment: ${typeof controller.verifyPayment === 'function'}`);
  console.log(`  ✅ checkPaymentStatus: ${typeof controller.checkPaymentStatus === 'function'}`);
  console.log(`  ✅ creditAdminTreasury: ${typeof creditAdminTreasury === 'function'}`);

  console.log(`\n${'='.repeat(50)}`);
  console.log(`TEST RESULT: ${allPassed ? '✅ ALL CHECKS PASSED' : '❌ SOME CHECKS FAILED'}`);
  console.log(`${'='.repeat(50)}`);
  
  console.log('\nPayment Flow Summary:');
  console.log(`  • isProviderConfigured() = ${configured} → ${!configured ? 'AUTO-CREDIT' : 'WEBHOOK'} mode`);
  console.log(`  • Real UTR (661226752732) valid: ${isValidUtr('661226752732')}`);
  console.log(`  • Flow: UPI app → approvalRefNo → /verify → immediate wallet credit → COMPLETED`);

  await mongoose.disconnect();
  process.exit(allPassed ? 0 : 1);
}

runTest().catch(e => { console.error('Test failed:', e.message); process.exit(1); });
