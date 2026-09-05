package com.kwicklymobile

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log

/**
 * KwicklyNotificationListener
 * Android NotificationListenerService to auto-detect incoming UPI payment reference
 * numbers (12-digit UTR/RRN) from Bank SMS and UPI apps (CRED, GPay, Paytm, PhonePe).
 * 
 * Uses standard Android Notification Listener API:
 * - ZERO telephony/SMS permissions (Play Protect approved)
 * - Intercepts in real-time when bank debit notification or PSP receipt arrives
 */
class KwicklyNotificationListener : NotificationListenerService() {

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        super.onNotificationPosted(sbn)
        if (sbn == null) return

        try {
            val packageName = sbn.packageName ?: ""
            val extras = sbn.notification?.extras ?: return

            val title = extras.getString("android.title")
                ?: extras.getCharSequence("android.title")?.toString() ?: ""
            val text = extras.getString("android.text")
                ?: extras.getCharSequence("android.text")?.toString() ?: ""
            val bigText = extras.getCharSequence("android.bigText")?.toString() ?: ""
            val subText = extras.getCharSequence("android.subText")?.toString() ?: ""

            val fullContent = "$title $text $bigText $subText"

            val utr = extractUtr(fullContent)
            if (utr != null && utr.length == 12) {
                Log.d("KwicklyNotification", "Captured UTR: $utr from $packageName")
                val amount = extractAmount(fullContent)
                NativeUpiPaymentModule.sendSmsEvent(utr, amount, packageName, fullContent)
            }
        } catch (e: Exception) {
            Log.e("KwicklyNotification", "Error processing notification", e)
        }
    }

    private fun extractUtr(text: String): String? {
        if (text.isEmpty()) return null

        // 1. Match Indian bank SMS keywords: UPI Ref, Ref No, UTR, RRN, Txn ID
        val keywordRegex = Regex("""(?:upi\s*(?:ref(?:erence)?|txn(?:action)?(?:\s*id)?)(?:\s*no)?|ref\s*(?:no|id)?|rrn|utr)\D*?(\d{12})""", RegexOption.IGNORE_CASE)
        val match = keywordRegex.find(text)
        if (match != null) {
            val candidate = match.groupValues[1]
            if (isValidCandidate(candidate)) return candidate
        }

        // 2. Standalone 12-digit number (Kotak, HDFC, SBI, ICICI, etc.)
        val standaloneRegex = Regex("""\b(\d{12})\b""")
        val standaloneMatches = standaloneRegex.findAll(text)
        for (m in standaloneMatches) {
            val candidate = m.groupValues[1]
            if (isValidCandidate(candidate)) return candidate
        }

        return null
    }

    private fun extractAmount(text: String): String? {
        val amountRegex = Regex("""(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)""", RegexOption.IGNORE_CASE)
        val match = amountRegex.find(text)
        return match?.groupValues?.get(1)?.replace(",", "")
    }

    private fun isValidCandidate(candidate: String): Boolean {
        if (candidate.length != 12) return false
        if (candidate.all { it == candidate[0] }) return false
        if (candidate.toSet().size < 3) return false
        return true
    }
}
