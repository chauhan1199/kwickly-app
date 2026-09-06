'use strict';

const {
  isValidUtr,
  extractSmsAmount,
  verifyIntentResponse,
  isAuthenticBankDebitSms
} = require('../src/helpers/upi.helper');

console.log('=== TEST SUITE: UPI VERIFICATION & FRAUD PREVENTION ===\n');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${message}`);
    failed++;
  }
}

// 1. Manually typed fake UTR without intent proof or bank SMS
const testFakeManualUtr = verifyIntentResponse({
  isIntentVerified: false,
  intentStatus: undefined,
  responseCode: undefined,
  rawResponse: undefined,
  utr: '661505298778'
});
assert(testFakeManualUtr === false, 'Fake manually typed UTR 661505298778 has NO valid intent proof');

const testFakeManualSms = isAuthenticBankDebitSms({
  rawMessage: '',
  utr: '661505298778',
  expectedAmount: 12
});
assert(testFakeManualSms === false, 'Empty SMS text has NO valid bank debit SMS proof');

const testFakeManualSmsOnlyUtr = isAuthenticBankDebitSms({
  rawMessage: '661505298778',
  utr: '661505298778',
  expectedAmount: 12
});
assert(testFakeManualSmsOnlyUtr === false, 'Just typing 12 digits into SMS field is rejected (< 25 chars, no debit keywords)');

// 2. Intent Proof from Google Pay / PhonePe
const realGPayResponse = 'txnId=UPI661505298779&responseCode=00&Status=SUCCESS&txnRef=KWIK_123456&ApprovalRefNo=661505298779';
const testRealIntent = verifyIntentResponse({
  isIntentVerified: true,
  intentStatus: 'SUCCESS',
  responseCode: '00',
  rawResponse: realGPayResponse,
  utr: '661505298779'
});
assert(testRealIntent === true, 'Real Google Pay intent response with Status=SUCCESS and ApprovalRefNo passes');

// 3. Spoofed intent response with Status=FAILURE
const testFailedIntent = verifyIntentResponse({
  isIntentVerified: true,
  intentStatus: 'FAILURE',
  responseCode: 'ZM',
  rawResponse: 'txnId=UPI123&Status=FAILURE&responseCode=ZM',
  utr: '661505298778'
});
assert(testFailedIntent === false, 'Failed intent response is rejected');

// 4. Genuine Kotak Bank Debit SMS
const realKotakSms = 'Dear UPI user A/C X6789 debited by 12.0 on 06-Sep-26 by transfer to KWICKLY PVT LTD Ref No 661505298779';
const testRealSms = isAuthenticBankDebitSms({
  rawMessage: realKotakSms,
  utr: '661505298779',
  expectedAmount: 12
});
assert(testRealSms === true, 'Authentic Kotak bank debit SMS with matching amount and UTR passes');

// 5. Genuine SBI Debit SMS
const realSbiSms = 'Your A/C XXXXXX debited by INR 105.00 on 06Sep26 transfer to KWICKLY PVT LTD Ref No 661406151223 -SBI';
const testRealSbiSms = isAuthenticBankDebitSms({
  rawMessage: realSbiSms,
  utr: '661406151223',
  expectedAmount: 105
});
assert(testRealSbiSms === true, 'Authentic SBI bank debit SMS for ₹105 passes');

// 6. Old SMS of ₹10 used for ₹105 payment (Amount Mismatch)
const testMismatchSms = isAuthenticBankDebitSms({
  rawMessage: 'Dear Customer, A/c debited by Rs 10.00 on 05-Sep-26 UPI/661421173965',
  utr: '661421173965',
  expectedAmount: 105
});
assert(testMismatchSms === false, 'SMS with amount ₹10 is rejected when expected payment is ₹105');

// 7. SMS with modified UTR (last digit changed from 9 to 8)
const testTamperedUtrSms = isAuthenticBankDebitSms({
  rawMessage: realKotakSms, // contains 661505298779
  utr: '661505298778',      // user submitted 661505298778
  expectedAmount: 12
});
assert(testTamperedUtrSms === false, 'SMS containing 661505298779 is rejected when user submits 661505298778');

// 9. Off-by-one UTR tampering detection
const { isAdjacentOrTamperedUtr } = require('../src/helpers/upi.helper');
const recentUtrs = ['661505298779', '661027352322', '661119487216'];

const testTamperedOffByOne = isAdjacentOrTamperedUtr('661505298778', recentUtrs);
assert(testTamperedOffByOne === true, 'Off-by-one UTR (661505298778 vs 661505298779) is detected as tampered');

const testTamperedPlusOne = isAdjacentOrTamperedUtr('661505298780', recentUtrs);
assert(testTamperedPlusOne === true, 'Off-by-one positive UTR (661505298780 vs 661505298779) is detected as tampered');

const testGenuineNewUtr = isAdjacentOrTamperedUtr('661513309006', recentUtrs);
assert(testGenuineNewUtr === false, 'Genuine fresh UTR (661513309006, sequence diff 8M) is accepted as non-adjacent');

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
