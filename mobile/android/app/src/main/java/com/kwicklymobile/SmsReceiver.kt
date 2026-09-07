package com.kwicklymobile

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import android.util.Log

class SmsReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "KwicklySmsReceiver"
    }

    override fun onReceive(context: Context?, intent: Intent?) {
        if (intent?.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        try {
            val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
            if (messages.isNullOrEmpty()) return

            val sb = java.lang.StringBuilder()
            var sender = ""

            for (msg in messages) {
                if (sender.isEmpty()) {
                    sender = msg.displayOriginatingAddress ?: ""
                }
                sb.append(msg.displayMessageBody ?: "")
            }

            val body = sb.toString().trim()
            if (body.isEmpty()) return

            Log.d(TAG, "Incoming SMS from $sender: $body")

            // Parse UTR
            val utr = extractUtr(body)
            if (!utr.isNullOrEmpty()) {
                val amount = extractAmount(body)
                Log.d(TAG, "Detected valid Bank/UPI SMS: UTR=$utr, Amount=$amount")

                // Cache in module companion object
                NativeUpiPaymentModule.cacheIncomingSms(utr, amount, sender, body)

                // Dispatch real-time event to React Native JS
                NativeUpiPaymentModule.sendSmsEvent(utr, amount, sender, body)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error processing incoming SMS", e)
        }
    }

    private fun extractUtr(text: String): String? {
        if (text.isEmpty()) return null

        // 1. Check targeted UPI Reference / UTR keywords
        val keywordRegex = Regex(
            """(?:upi\s*(?:ref(?:erence)?|txn(?:action)?(?:\s*id)?|rrn|id|no)?[:\s/_-]*|ref\s*(?:no|id|num)?[:\s/_-]*|rrn[:\s/_-]*|utr(?:\s*no)?[:\s/_-]*|urn[:\s/_-]*|imps\s*ref[:\s/_-]*|txn\s*ref[:\s/_-]*|approval\s*ref[:\s/_-]*|upi/(?:p2a|p2p|cr|dr)?/?)\D*?(\d{12})""",
            RegexOption.IGNORE_CASE
        )
        val match = keywordRegex.find(text)
        if (match != null) {
            val candidate = match.groupValues[1]
            if (isValidUtrString(candidate)) return candidate
        }

        // 2. Standalone 12-digit number (excluding account numbers)
        val accRegex = Regex("""(?:a/c|acct|account|acc\s*no|card)\s*(?:no\.?)?\s*[:\s#]*[xX*]*(\d{9,18})""", RegexOption.IGNORE_CASE)
        val accMatches = accRegex.findAll(text).map { it.groupValues[1] }.toSet()

        val standaloneRegex = Regex("""\b(\d{12})\b""")
        for (m in standaloneRegex.findAll(text)) {
            val candidate = m.groupValues[1]
            if (!accMatches.contains(candidate) && isValidUtrString(candidate)) {
                return candidate
            }
        }
        return null
    }

    private fun extractAmount(text: String): String? {
        if (text.isEmpty()) return null

        // Amount before action verb (e.g. "₹282.04 sent to GHANSHYAM")
        val beforeRegex = Regex("""(?:Rs\.?|INR|₹)\s*([0-9]+(?:\.[0-9]{1,2})?)\s*(?:debited|sent|transferred|paid)""", RegexOption.IGNORE_CASE)
        val beforeMatch = beforeRegex.find(text)
        if (beforeMatch != null) {
            return beforeMatch.groupValues[1]
        }

        // Amount after action verb
        val afterRegex = Regex("""(?:debited\s*(?:by|with|for)?|paid\s*(?:to\s*[^,\n\r]+?)?|sent\s*(?:to\s*[^,\n\r]+?)?|transferred\s*|txn\s*(?:of)?)\s*(?:Rs\.?|INR|₹)?\s*([0-9]+(?:\.[0-9]{1,2})?)""", RegexOption.IGNORE_CASE)
        val afterMatch = afterRegex.find(text)
        if (afterMatch != null) {
            return afterMatch.groupValues[1]
        }

        // General amount before balance
        val preBal = text.split(Regex("""(?:bal(?:ance)?|avl\s*bal|total\s*bal)""", RegexOption.IGNORE_CASE))[0]
        val genRegex = Regex("""(?:Rs\.?|INR|₹)\s*([0-9]+(?:\.[0-9]{1,2})?)""", RegexOption.IGNORE_CASE)
        val genMatch = genRegex.find(preBal)
        return genMatch?.groupValues?.get(1)
    }

    private fun isValidUtrString(utr: String): Boolean {
        if (utr.length != 12) return false
        if (!utr.all { it.isDigit() }) return false
        if (utr.toSet().size < 4) return false

        // Repeated patterns
        val blockedPatterns = listOf(
            "123456789012", "012345678901", "987654321098", "098765432109",
            "123456543212", "123456654321", "123456789000", "123456789123",
            "000000000000", "111111111111", "222222222222", "333333333333",
            "444444444444", "555555555555", "666666666666", "777777777777",
            "888888888888", "999999999999", "121212121212", "123123123123",
            "123412341234", "112233445566"
        )
        return !blockedPatterns.contains(utr)
    }
}
