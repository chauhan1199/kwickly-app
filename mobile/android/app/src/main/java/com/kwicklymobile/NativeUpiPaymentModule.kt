package com.kwicklymobile

import android.app.Activity
import android.content.Intent
import android.net.Uri
import com.facebook.react.bridge.*

class NativeUpiPaymentModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), ActivityEventListener {

    private var pendingPromise: Promise? = null
    private val UPI_PAYMENT_REQUEST_CODE = 4852

    init {
        reactContext.addActivityEventListener(this)
    }

    override fun getName(): String = "NativeUpiPayment"

    @ReactMethod
    fun startPayment(params: ReadableMap, promise: Promise) {
        val currentActivity = currentActivity
        if (currentActivity == null) {
            promise.reject("ACTIVITY_NULL", "Current Activity is null")
            return
        }

        if (pendingPromise != null) {
            promise.reject("PENDING_PAYMENT", "Another payment is already in progress")
            return
        }

        try {
            val vpa = if (params.hasKey("vpa")) params.getString("vpa") ?: "" else ""
            val name = if (params.hasKey("name")) params.getString("name") ?: "Kwickly Admin" else "Kwickly Admin"
            val amount = if (params.hasKey("amount")) params.getString("amount") ?: "0" else "0"
            val txnRef = if (params.hasKey("txnRef")) params.getString("txnRef") ?: "KWIK_${System.currentTimeMillis()}" else "KWIK_${System.currentTimeMillis()}"
            val note = if (params.hasKey("note")) params.getString("note") ?: "Kwickly Payment" else "Kwickly Payment"
            val appPackage = if (params.hasKey("appPackage") && !params.isNull("appPackage")) params.getString("appPackage") else null

            val uriBuilder = Uri.Builder()
                .scheme("upi")
                .authority("pay")
                .appendQueryParameter("pa", vpa)
                .appendQueryParameter("pn", name)
                .appendQueryParameter("mc", "")
                .appendQueryParameter("tr", txnRef)
                .appendQueryParameter("tn", note)
                .appendQueryParameter("am", amount)
                .appendQueryParameter("cu", "INR")

            val uri = uriBuilder.build()
            val intent = Intent(Intent.ACTION_VIEW, uri)

            if (!appPackage.isNullOrEmpty() && appPackage != "generic") {
                intent.setPackage(appPackage)
            }

            if (intent.resolveActivity(currentActivity.packageManager) == null) {
                // If specific app not found, try fallback to any UPI handler
                intent.setPackage(null)
                if (intent.resolveActivity(currentActivity.packageManager) == null) {
                    promise.reject("NO_UPI_APP", "No supported UPI app found on this device")
                    return
                }
            }

            pendingPromise = promise
            currentActivity.startActivityForResult(intent, UPI_PAYMENT_REQUEST_CODE)
        } catch (e: Exception) {
            pendingPromise = null
            promise.reject("INTENT_ERROR", e.message, e)
        }
    }

    override fun onActivityResult(
        activity: Activity?,
        requestCode: Int,
        resultCode: Int,
        data: Intent?
    ) {
        if (requestCode != UPI_PAYMENT_REQUEST_CODE) return

        val promise = pendingPromise ?: return
        pendingPromise = null

        val resultMap = Arguments.createMap()
        var responseString = data?.getStringExtra("response") ?: ""

        if (responseString.isEmpty()) {
            val extras = data?.extras
            if (extras != null) {
                val sb = StringBuilder()
                for (key in extras.keySet()) {
                    sb.append(key).append("=").append(extras.get(key)).append("&")
                }
                responseString = sb.toString()
            }
        }

        if (responseString.isEmpty() && data?.data != null) {
            responseString = data.data.toString()
        }

        resultMap.putString("rawResponse", responseString)

        val parsed = parseUpiResponse(responseString)
        val status = parsed["status"] ?: parsed["Status"] ?: ""
        val approvalRefNo = parsed["approvalrefno"] ?: parsed["ApprovalRefNo"] ?: parsed["approvalRefNo"] ?: parsed["rrn"] ?: parsed["RRN"] ?: ""
        val txnId = parsed["txnid"] ?: parsed["txnId"] ?: parsed["TxnId"] ?: ""
        val responseCode = parsed["responsecode"] ?: parsed["responseCode"] ?: ""

        resultMap.putString("status", status.uppercase())
        resultMap.putString("approvalRefNo", approvalRefNo)
        resultMap.putString("txnId", txnId)
        resultMap.putString("responseCode", responseCode)

        if (status.equals("SUCCESS", ignoreCase = true)) {
            resultMap.putBoolean("isSuccessful", true)
            promise.resolve(resultMap)
        } else if (status.equals("SUBMITTED", ignoreCase = true)) {
            resultMap.putBoolean("isSuccessful", false)
            resultMap.putString("message", "Payment submitted and pending bank settlement.")
            promise.resolve(resultMap)
        } else if (status.equals("FAILURE", ignoreCase = true) || status.equals("FAILED", ignoreCase = true)) {
            resultMap.putBoolean("isSuccessful", false)
            resultMap.putString("message", "Payment failed or was cancelled in UPI app.")
            promise.resolve(resultMap)
        } else if (responseString.isEmpty()) {
            resultMap.putString("status", "CANCELLED")
            resultMap.putBoolean("isSuccessful", false)
            resultMap.putString("message", "User cancelled or closed UPI app without completing payment.")
            promise.resolve(resultMap)
        } else {
            resultMap.putBoolean("isSuccessful", false)
            resultMap.putString("message", "Payment incomplete: $responseString")
            promise.resolve(resultMap)
        }
    }

    override fun onNewIntent(intent: Intent?) {}

    private fun parseUpiResponse(response: String): Map<String, String> {
        val map = mutableMapOf<String, String>()
        if (response.isEmpty()) return map

        val clean = if (response.contains("?")) response.substringAfter("?") else response
        val pairs = clean.split("&")
        for (pair in pairs) {
            val idx = pair.indexOf("=")
            if (idx > 0) {
                val key = pair.substring(0, idx).trim()
                val value = pair.substring(idx + 1).trim()
                map[key.lowercase()] = value
                map[key] = value
            }
        }
        return map
    }
}
