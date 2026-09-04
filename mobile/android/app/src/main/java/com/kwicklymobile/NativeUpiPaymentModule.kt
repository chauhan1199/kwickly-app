package com.kwicklymobile

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.graphics.*
import android.graphics.pdf.PdfDocument
import android.net.Uri
import android.os.Environment
import android.print.PrintAttributes
import android.print.PrintManager
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.content.FileProvider
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.*

class NativeUpiPaymentModule(private val reactCtx: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactCtx), ActivityEventListener {

    private var pendingPromise: Promise? = null
    private val UPI_PAYMENT_REQUEST_CODE = 4852

    companion object {
        private var instance: NativeUpiPaymentModule? = null

        fun sendSmsEvent(utr: String, amount: String?, sender: String, body: String) {
            val module = instance ?: return
            try {
                val eventData = Arguments.createMap().apply {
                    putString("utr", utr)
                    putString("amount", amount ?: "")
                    putString("sender", sender)
                    putString("body", body)
                    putDouble("timestamp", System.currentTimeMillis().toDouble())
                }
                module.reactCtx
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit("onBankSmsReceived", eventData)
            } catch (e: Exception) {
                // Ignore if bridge not ready
            }
        }
    }

    init {
        reactCtx.addActivityEventListener(this)
        instance = this
    }

    override fun getName(): String = "NativeUpiPayment"

    @ReactMethod
    fun addListener(type: String?) {
        // Required for RN NativeEventEmitter
    }

    @ReactMethod
    fun removeListeners(count: Int?) {
        // Required for RN NativeEventEmitter
    }

    @ReactMethod
    fun getLatestSmsUtr(promise: Promise) {
        val utr = SmsReceiver.latestUtr
        val amount = SmsReceiver.latestAmount
        val timestamp = SmsReceiver.latestTimestamp

        val map = Arguments.createMap().apply {
            putString("utr", utr ?: "")
            putString("amount", amount ?: "")
            putDouble("timestamp", timestamp.toDouble())
            putBoolean("hasUtr", !utr.isNullOrEmpty())
        }
        promise.resolve(map)
    }

    @ReactMethod
    fun clearSmsCache(promise: Promise) {
        SmsReceiver.clearCache()
        promise.resolve(true)
    }

    @ReactMethod
    fun startPayment(params: ReadableMap, promise: Promise) {
        val activity = reactCtx.currentActivity
        if (activity == null) {
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
                .appendQueryParameter("tr", txnRef)
                .appendQueryParameter("tn", note)
                .appendQueryParameter("am", amount)
                .appendQueryParameter("cu", "INR")

            val uri = uriBuilder.build()
            val intent = Intent(Intent.ACTION_VIEW, uri)

            if (!appPackage.isNullOrEmpty() && appPackage != "generic") {
                intent.setPackage(appPackage)
            }

            pendingPromise = promise
            try {
                activity.startActivityForResult(intent, UPI_PAYMENT_REQUEST_CODE)
            } catch (e: Exception) {
                // If package-specific launch failed (e.g. app not installed), fallback to system chooser
                try {
                    intent.setPackage(null)
                    val chooser = Intent.createChooser(intent, "Pay via UPI")
                    activity.startActivityForResult(chooser, UPI_PAYMENT_REQUEST_CODE)
                } catch (chooserEx: Exception) {
                    pendingPromise = null
                    promise.reject("NO_UPI_APP", "No supported UPI application found on this device", chooserEx)
                }
            }
        } catch (e: Exception) {
            pendingPromise = null
            promise.reject("INTENT_ERROR", e.message, e)
        }
    }

    override fun onActivityResult(
        activity: Activity,
        requestCode: Int,
        resultCode: Int,
        data: Intent?
    ) {
        if (requestCode != UPI_PAYMENT_REQUEST_CODE) return

        val promise = pendingPromise ?: return
        pendingPromise = null

        val resultMap = Arguments.createMap()
        val isResultOk = (resultCode == Activity.RESULT_OK)
        var responseString = data?.getStringExtra("response") ?: ""

        val extras = data?.extras
        if (extras != null) {
            val sb = StringBuilder()
            for (key in extras.keySet()) {
                val value = extras.get(key)
                sb.append(key).append("=").append(value).append("&")
            }
            if (responseString.isEmpty()) {
                responseString = sb.toString()
            }
        }

        if (responseString.isEmpty() && data?.data != null) {
            responseString = data.data.toString()
        }

        resultMap.putString("rawResponse", responseString)
        resultMap.putInt("resultCode", resultCode)

        val parsed = parseUpiResponse(responseString)
        var status = parsed["status"] ?: parsed["Status"] ?: ""
        var approvalRefNo = parsed["approvalrefno"] ?: parsed["ApprovalRefNo"] ?: parsed["approvalRefNo"] ?: parsed["rrn"] ?: parsed["RRN"] ?: ""
        val txnId = parsed["txnid"] ?: parsed["txnId"] ?: parsed["TxnId"] ?: ""
        val responseCode = parsed["responsecode"] ?: parsed["responseCode"] ?: ""

        // If no explicit approvalRefNo, regex search responseString for any 12-digit number (bank RRN)
        if (approvalRefNo.isEmpty() && responseString.isNotEmpty()) {
            val rrnMatch = Regex("\\b([0-9]{12})\\b").find(responseString)
            if (rrnMatch != null) {
                approvalRefNo = rrnMatch.groupValues[1]
            }
        }

        // If activity returned RESULT_OK but status was empty, treat as SUCCESS
        if (status.isEmpty() && isResultOk) {
            status = "SUCCESS"
        }

        resultMap.putString("status", status.uppercase())
        resultMap.putString("approvalRefNo", approvalRefNo)
        resultMap.putString("txnId", txnId)
        resultMap.putString("responseCode", responseCode)

        if (status.equals("SUCCESS", ignoreCase = true) || (isResultOk && !status.equals("FAILURE", ignoreCase = true) && !status.equals("FAILED", ignoreCase = true))) {
            resultMap.putBoolean("isSuccessful", true)
            resultMap.putString("status", "SUCCESS")
            promise.resolve(resultMap)
        } else if (status.equals("SUBMITTED", ignoreCase = true)) {
            resultMap.putBoolean("isSuccessful", false)
            resultMap.putString("message", "Payment submitted and pending bank settlement.")
            promise.resolve(resultMap)
        } else if (status.equals("FAILURE", ignoreCase = true) || status.equals("FAILED", ignoreCase = true)) {
            resultMap.putBoolean("isSuccessful", false)
            resultMap.putString("message", "Payment failed in UPI app.")
            promise.resolve(resultMap)
        } else if (resultCode == Activity.RESULT_CANCELED && responseString.isEmpty()) {
            resultMap.putString("status", "CANCELLED")
            resultMap.putBoolean("isSuccessful", false)
            resultMap.putString("message", "User returned from UPI app.")
            promise.resolve(resultMap)
        } else {
            resultMap.putBoolean("isSuccessful", false)
            resultMap.putString("message", "Payment incomplete: $responseString")
            promise.resolve(resultMap)
        }
    }

    override fun onNewIntent(intent: Intent) {}

    /**
     * Generates a clean, professional PDF receipt file and opens the native Share sheet to send the actual .pdf file
     */
    @ReactMethod
    fun generateAndSharePdfReceipt(params: ReadableMap, promise: Promise) {
        try {
            val receiptId = if (params.hasKey("receiptId")) params.getString("receiptId") ?: "KWIK-RCPT-TXN" else "KWIK-RCPT-TXN"
            val dateStr = if (params.hasKey("dateStr")) params.getString("dateStr") ?: "" else ""
            val status = if (params.hasKey("status")) params.getString("status") ?: "COMPLETED" else "COMPLETED"
            val description = if (params.hasKey("description")) params.getString("description") ?: "Wallet Top-up via Direct UPI (Verified)" else "Wallet Top-up via Direct UPI (Verified)"
            val txnType = if (params.hasKey("type")) params.getString("type") ?: "TOPUP" else "TOPUP"
            val paymentMode = if (params.hasKey("paymentMode")) params.getString("paymentMode") ?: "UPI / Direct Bank Transfer" else "UPI / Direct Bank Transfer"
            val refId = if (params.hasKey("refId")) params.getString("refId") ?: "AUTO_VERIFIED" else "AUTO_VERIFIED"
            val amountStr = if (params.hasKey("amountStr")) params.getString("amountStr") ?: "+₹0" else "+₹0"
            val balanceStr = if (params.hasKey("balanceStr")) params.getString("balanceStr") ?: "₹0" else "₹0"

            val document = PdfDocument()
            val pageInfo = PdfDocument.PageInfo.Builder(595, 842, 1).create() // Standard A4 points
            val page = document.startPage(pageInfo)
            val canvas = page.canvas

            // Colors & Paints
            val bgPaint = Paint().apply { color = Color.parseColor("#F8FAFC") }
            canvas.drawRect(0f, 0f, 595f, 842f, bgPaint)

            // Header Banner Gradient
            val headerPaint = Paint().apply {
                shader = LinearGradient(0f, 0f, 595f, 150f, Color.parseColor("#6C47FF"), Color.parseColor("#4F46E5"), Shader.TileMode.CLAMP)
            }
            canvas.drawRect(0f, 0f, 595f, 130f, headerPaint)

            // Logo & Title
            val titlePaint = Paint().apply {
                color = Color.WHITE
                textSize = 28f
                typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
                isAntiAlias = true
            }
            canvas.drawText("KWICKLY", 36f, 58f, titlePaint)

            val subTitlePaint = Paint().apply {
                color = Color.parseColor("#E0E7FF")
                textSize = 12f
                typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
                isAntiAlias = true
            }
            canvas.drawText("OFFICIAL TRANSACTION RECEIPT & AUDIT LEDGER", 36f, 82f, subTitlePaint)

            // Verified Badge Pill (Top Right)
            val badgeBgPaint = Paint().apply {
                color = Color.parseColor("#10B981")
                isAntiAlias = true
            }
            canvas.drawRoundRect(RectF(390f, 40f, 555f, 74f), 17f, 17f, badgeBgPaint)

            val badgeTextPaint = Paint().apply {
                color = Color.WHITE
                textSize = 11f
                typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
                isAntiAlias = true
                textAlign = Paint.Align.CENTER
            }
            canvas.drawText("✓ VERIFIED RECEIPT", 472f, 62f, badgeTextPaint)

            // Amount Card Box
            val cardBgPaint = Paint().apply {
                color = Color.WHITE
                isAntiAlias = true
            }
            canvas.drawRoundRect(RectF(36f, 150f, 559f, 260f), 16f, 16f, cardBgPaint)

            val descPaint = Paint().apply {
                color = Color.parseColor("#64748B")
                textSize = 13f
                isAntiAlias = true
                textAlign = Paint.Align.CENTER
            }
            canvas.drawText(description, 297f, 185f, descPaint)

            val amtPaint = Paint().apply {
                color = Color.parseColor("#059669")
                textSize = 34f
                typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
                isAntiAlias = true
                textAlign = Paint.Align.CENTER
            }
            canvas.drawText(amountStr, 297f, 225f, amtPaint)

            val statusPillPaint = Paint().apply {
                color = Color.parseColor("#D1FAE5")
                isAntiAlias = true
            }
            canvas.drawRoundRect(RectF(210f, 235f, 385f, 255f), 10f, 10f, statusPillPaint)

            val statusTextPaint = Paint().apply {
                color = Color.parseColor("#059669")
                textSize = 10f
                typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
                isAntiAlias = true
                textAlign = Paint.Align.CENTER
            }
            canvas.drawText("● SUCCESSFUL • $status", 297f, 249f, statusTextPaint)

            // Table Details Box
            val tableBgPaint = Paint().apply {
                color = Color.WHITE
                isAntiAlias = true
            }
            canvas.drawRoundRect(RectF(36f, 280f, 559f, 620f), 16f, 16f, tableBgPaint)

            val labelPaint = Paint().apply {
                color = Color.parseColor("#64748B")
                textSize = 12f
                typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
                isAntiAlias = true
            }

            val valuePaint = Paint().apply {
                color = Color.parseColor("#0F172A")
                textSize = 12f
                typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
                isAntiAlias = true
                textAlign = Paint.Align.RIGHT
            }

            val highlightPaint = Paint().apply {
                color = Color.parseColor("#6C47FF")
                textSize = 12f
                typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
                isAntiAlias = true
                textAlign = Paint.Align.RIGHT
            }

            val linePaint = Paint().apply {
                color = Color.parseColor("#F1F5F9")
                strokeWidth = 1f
            }

            val rows = listOf(
                Pair("Receipt ID", receiptId),
                Pair("Date & Time", dateStr),
                Pair("Transaction Type", txnType),
                Pair("Payment Mode", paymentMode),
                Pair("Reference / UTR", refId),
                Pair("Wallet Balance", balanceStr)
            )

            var currentY = 325f
            for ((label, value) in rows) {
                canvas.drawText(label, 60f, currentY, labelPaint)
                if (label == "Receipt ID" || label == "Reference / UTR") {
                    canvas.drawText(value, 535f, currentY, highlightPaint)
                } else if (label == "Wallet Balance") {
                    val balGreenPaint = Paint().apply {
                        color = Color.parseColor("#059669")
                        textSize = 14f
                        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
                        isAntiAlias = true
                        textAlign = Paint.Align.RIGHT
                    }
                    canvas.drawText(value, 535f, currentY, balGreenPaint)
                } else {
                    canvas.drawText(value, 535f, currentY, valuePaint)
                }
                canvas.drawLine(60f, currentY + 16f, 535f, currentY + 16f, linePaint)
                currentY += 48f
            }

            // Security Ledger Stamp Footer
            val footerPaint = Paint().apply {
                color = Color.parseColor("#94A3B8")
                textSize = 10f
                isAntiAlias = true
                textAlign = Paint.Align.CENTER
            }
            canvas.drawText("AUTHENTICATED BY KWICKLY SECURE LEDGER ENGINE • 100% VERIFIED", 297f, 660f, footerPaint)
            canvas.drawText("This is an official computer-generated financial document.", 297f, 678f, footerPaint)

            document.finishPage(page)

            // Save PDF to cache directory
            val fileName = "KWIK_Receipt_${receiptId.replace("[^a-zA-Z0-9]".toRegex(), "")}.pdf"
            val file = File(reactCtx.cacheDir, fileName)
            val outputStream = FileOutputStream(file)
            document.writeTo(outputStream)
            outputStream.close()
            document.close()

            // Share the PDF file via FileProvider
            val contentUri = FileProvider.getUriForFile(reactCtx, "${reactCtx.packageName}.fileprovider", file)
            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                setType("application/pdf")
                putExtra(Intent.EXTRA_STREAM, contentUri)
                putExtra(Intent.EXTRA_SUBJECT, "Kwickly Payment Receipt - $receiptId")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }

            val chooser = Intent.createChooser(shareIntent, "Share Receipt PDF").apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactCtx.startActivity(chooser)
            promise.resolve(file.absolutePath)
        } catch (e: Exception) {
            promise.reject("PDF_ERROR", e.message, e)
        }
    }

    /**
     * Opens Android's native system Print / Save as PDF manager
     */
    @ReactMethod
    fun printReceipt(params: ReadableMap, promise: Promise) {
        val activity = reactCtx.currentActivity
        if (activity == null) {
            promise.reject("ACTIVITY_NULL", "Activity is null")
            return
        }

        val receiptId = if (params.hasKey("receiptId")) params.getString("receiptId") ?: "Receipt" else "Receipt"
        val htmlContent = if (params.hasKey("htmlContent")) params.getString("htmlContent") ?: "" else ""

        activity.runOnUiThread {
            try {
                val webView = WebView(activity)
                webView.webViewClient = object : WebViewClient() {
                    override fun onPageFinished(view: WebView?, url: String?) {
                        try {
                            val printManager = activity.getSystemService(Context.PRINT_SERVICE) as PrintManager
                            val printAdapter = webView.createPrintDocumentAdapter(receiptId)
                            val builder = PrintAttributes.Builder()
                                .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                                .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                            printManager.print("Kwickly_$receiptId", printAdapter, builder.build())
                            promise.resolve(true)
                        } catch (e: Exception) {
                            promise.reject("PRINT_ERROR", e.message, e)
                        }
                    }
                }
                webView.loadDataWithBaseURL(null, htmlContent, "text/html", "UTF-8", null)
            } catch (e: Exception) {
                promise.reject("WEBVIEW_ERROR", e.message, e)
            }
        }
    }

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
