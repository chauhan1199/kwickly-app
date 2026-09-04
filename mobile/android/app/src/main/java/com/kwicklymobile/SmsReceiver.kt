package com.kwicklymobile

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import android.util.Log

/**
 * BroadcastReceiver for automatically intercepting transactional bank SMS
 * messages (Kotak, SBI, HDFC, ICICI, Axis, Paytm, CRED, PhonePe, etc.)
 * and extracting the 12-digit UPI Reference (UTR / RRN) and debited amount.
 */
class SmsReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "KwicklySmsReceiver"
        
        @Volatile
        var latestUtr: String? = null
            private set
        @Volatile
        var latestAmount: String? = null
            private set
        @Volatile
        var latestTimestamp: Long = 0
            private set

        fun clearCache() {
            latestUtr = null
            latestAmount = null
            latestTimestamp = 0
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        try {
            val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
            if (messages.isNullOrEmpty()) return

            val sender = messages[0].originatingAddress ?: ""
            val fullBody = StringBuilder()
            for (sms in messages) {
                fullBody.append(sms.messageBody)
            }
            val body = fullBody.toString()
            Log.d(TAG, "SMS Received from: $sender - Body: $body")

            val utr = extractUtr(body)
            val amount = extractAmount(body)

            if (!utr.isNullOrEmpty()) {
                Log.d(TAG, "✓ Extracted Bank UTR: $utr, Amount: $amount from $sender")
                latestUtr = utr
                latestAmount = amount
                latestTimestamp = System.currentTimeMillis()

                // Emit real-time event to React Native
                NativeUpiPaymentModule.sendSmsEvent(utr, amount, sender, body)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error processing SMS: ${e.message}", e)
        }
    }

    private fun extractUtr(body: String): String? {
        // 1. Keyword-based matching: "UPI Ref", "Ref No", "UTR", "RRN", "Txn ID", etc.
        val keywordRegex = Regex("(?i)(?:upi\\s*(?:ref(?:erence)?|txn(?:action)?(?:\\s*id)?)(?:\\s*no)?|ref\\s*(?:no|id)?|rrn|utr)\\D*?(\\d{12})")
        val match = keywordRegex.find(body)
        if (match != null) {
            return match.groupValues[1]
        }

        // 2. Standalone 12-digit number (NPCI standard RRN/UTR format)
        val standaloneRegex = Regex("\\b([0-9]{12})\\b")
        val fallbackMatch = standaloneRegex.find(body)
        if (fallbackMatch != null) {
            return fallbackMatch.groupValues[1]
        }

        return null
    }

    private fun extractAmount(body: String): String? {
        val amountRegex = Regex("(?i)(?:rs\\.?|inr)\\s*([0-9]+(?:\\.[0-9]{1,2})?)")
        val match = amountRegex.find(body)
        return match?.groupValues?.get(1)
    }
}
