package com.kwicklymobile

import android.app.Activity
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.*
import android.graphics.pdf.PdfDocument
import android.net.Uri
import android.os.Environment
import android.print.PrintAttributes
import android.print.PrintManager
import android.provider.Settings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.app.NotificationManagerCompat
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
        private var cachedUtr: String = ""
        private var cachedAmount: String = ""
        private var cachedBody: String = ""
        private var cachedTimestamp: Long = 0L

        fun cacheIncomingSms(utr: String, amount: String?, sender: String, body: String) {
            cachedUtr = utr
            cachedAmount = amount ?: ""
            cachedBody = body
            cachedTimestamp = System.currentTimeMillis()
        }

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
        val map = Arguments.createMap().apply {
            putString("utr", "")
            putString("amount", "")
            putString("body", "")
            putDouble("timestamp", 0.0)
            putBoolean("hasUtr", false)
        }
        promise.resolve(map)
    }

    @ReactMethod
    fun clearSmsCache(promise: Promise) {
        promise.resolve(true)
    }

    @ReactMethod
    fun getClipboardUtr(promise: Promise) {
        val activity = reactCtx.currentActivity
        val runnable = Runnable {
            try {
                val clipboard = reactCtx.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
                val clip = clipboard?.primaryClip
                val map = Arguments.createMap()
                if (clip != null && clip.itemCount > 0) {
                    val text = clip.getItemAt(0)?.text?.toString() ?: ""
                    val utr = extractUtrFromText(text)
                    map.putString("text", text)
                    map.putString("utr", utr ?: "")
                    map.putBoolean("hasUtr", !utr.isNullOrEmpty())
                } else {
                    map.putString("text", "")
                    map.putString("utr", "")
                    map.putBoolean("hasUtr", false)
                }
                promise.resolve(map)
            } catch (e: Exception) {
                val map = Arguments.createMap().apply {
                    putString("text", "")
                    putString("utr", "")
                    putBoolean("hasUtr", false)
                }
                promise.resolve(map)
            }
        }

        if (activity != null) {
            activity.runOnUiThread(runnable)
        } else {
            runnable.run()
        }
    }

    @ReactMethod
    fun isNotificationListenerEnabled(promise: Promise) {
        try {
            val isEnabled = NotificationManagerCompat.getEnabledListenerPackages(reactCtx)
                .contains(reactCtx.packageName)
            promise.resolve(isEnabled)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun openNotificationListenerSettings(promise: Promise) {
        val activity = reactCtx.currentActivity
        if (activity == null) {
            promise.resolve(false)
            return
        }
        try {
            val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
            activity.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.resolve(false)
        }
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

            val hasPackage = !appPackage.isNullOrEmpty() && appPackage != "generic"
            if (hasPackage) {
                intent.setPackage(appPackage)
            }

            pendingPromise = promise
            try {
                // No app picked: always show every installed UPI app (CRED, PhonePe, GPay, BHIM...)
                val launch = if (hasPackage) intent else Intent.createChooser(intent, "Pay via UPI")
                activity.startActivityForResult(launch, UPI_PAYMENT_REQUEST_CODE)
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
            val sb = StringBuilder(responseString)
            if (sb.isNotEmpty() && !sb.endsWith("&")) {
                sb.append("&")
            }
            for (key in extras.keySet()) {
                val value = extras.get(key)
                sb.append(key).append("=").append(value).append("&")
            }
            responseString = sb.toString()
        }

        if (responseString.isEmpty() && data?.data != null) {
            responseString = data.data.toString()
        }

        resultMap.putString("rawResponse", responseString)
        resultMap.putInt("resultCode", resultCode)

        val parsed = parseUpiResponse(responseString)
        var status = parsed["status"] ?: parsed["Status"] ?: ""
        var approvalRefNo = parsed["approvalrefno"] ?: parsed["ApprovalRefNo"] ?: parsed["approvalRefNo"]
            ?: parsed["rrn"] ?: parsed["RRN"] ?: parsed["refid"] ?: parsed["refId"] ?: parsed["bankrrn"]
            ?: parsed["banktxnid"] ?: parsed["upirefno"] ?: ""
        val txnId = parsed["txnid"] ?: parsed["txnId"] ?: parsed["TxnId"] ?: ""
        val responseCode = parsed["responsecode"] ?: parsed["responseCode"] ?: ""

        // If no explicit approvalRefNo, regex search responseString for any 12-digit number (bank RRN)
        if (approvalRefNo.isEmpty() && responseString.isNotEmpty()) {
            val rrnMatch = Regex("\\b([0-9]{12})\\b").find(responseString)
            if (rrnMatch != null) {
                approvalRefNo = rrnMatch.groupValues[1]
            }
        }

        // RESULT_OK with no status proves nothing: treat it as PENDING (ask for the UTR)
        if (status.isEmpty() && isResultOk) {
            status = "PENDING"
        }

        resultMap.putString("status", status.uppercase())
        resultMap.putString("approvalRefNo", approvalRefNo)
        resultMap.putString("txnId", txnId)
        resultMap.putString("responseCode", responseCode)

        if (status.equals("SUBMITTED", ignoreCase = true) || status.equals("PENDING", ignoreCase = true)) {
            resultMap.putBoolean("isSuccessful", false)
            resultMap.putString("status", "PENDING")
            resultMap.putString("message", "Payment submitted and pending bank settlement.")
            promise.resolve(resultMap)
        } else if (status.equals("SUCCESS", ignoreCase = true)) {
            resultMap.putBoolean("isSuccessful", true)
            resultMap.putString("status", "SUCCESS")
            promise.resolve(resultMap)
        } else if (status.equals("FAILURE", ignoreCase = true) || status.equals("FAILED", ignoreCase = true)) {
            resultMap.putBoolean("isSuccessful", false)
            resultMap.putString("message", "Payment failed in UPI app.")
            promise.resolve(resultMap)
        } else if (resultCode == Activity.RESULT_CANCELED && responseString.isEmpty()) {
            resultMap.putString("status", "CANCELLED")
            resultMap.putString("approvalRefNo", "")
            resultMap.putBoolean("isSuccessful", false)
            resultMap.putString("message", "User returned from UPI app without payment confirmation.")
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

            // Official Kwickly Logo Icon & Wordmark
            var textStartX = 36f
            try {
                val logoDrawableId = reactCtx.resources.getIdentifier("splash_logo", "drawable", reactCtx.packageName)
                if (logoDrawableId != 0) {
                    val logoBitmap = BitmapFactory.decodeResource(reactCtx.resources, logoDrawableId)
                    if (logoBitmap != null) {
                        // White rounded container for maximum contrast on purple gradient
                        val logoBoxPaint = Paint().apply {
                            color = Color.WHITE
                            isAntiAlias = true
                        }
                        val logoBox = RectF(36f, 32f, 92f, 88f)
                        canvas.drawRoundRect(logoBox, 14f, 14f, logoBoxPaint)

                        val logoDest = RectF(40f, 36f, 88f, 84f)
                        canvas.drawBitmap(logoBitmap, null, logoDest, Paint(Paint.FILTER_BITMAP_FLAG).apply { isAntiAlias = true })
                        textStartX = 104f
                    }
                }
            } catch (e: Exception) {
                textStartX = 36f
            }

            // Wordmark: Kwick (White) + ly (Light Purple #DDD6FE)
            val kwickPaint = Paint().apply {
                color = Color.WHITE
                textSize = 28f
                typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
                isAntiAlias = true
            }
            val lyPaint = Paint().apply {
                color = Color.parseColor("#DDD6FE")
                textSize = 28f
                typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
                isAntiAlias = true
            }
            canvas.drawText("Kwick", textStartX, 62f, kwickPaint)
            val kwickWidth = kwickPaint.measureText("Kwick")
            canvas.drawText("ly", textStartX + kwickWidth, 62f, lyPaint)

            val subTitlePaint = Paint().apply {
                color = Color.parseColor("#E0E7FF")
                textSize = 10.5f
                typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
                isAntiAlias = true
            }
            canvas.drawText("OFFICIAL TRANSACTION RECEIPT & AUDIT LEDGER", textStartX, 82f, subTitlePaint)

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
     * Saves a server-generated PDF (base64) to the cache folder and opens the
     * share sheet for it, so WhatsApp, Gmail, Drive etc. receive a real .pdf file.
     */
    @ReactMethod
    fun sharePdfBase64(params: ReadableMap, promise: Promise) {
        try {
            val base64 = if (params.hasKey("base64")) params.getString("base64") ?: "" else ""
            if (base64.isEmpty()) {
                promise.reject("PDF_ERROR", "Empty receipt")
                return
            }
            val rawName = if (params.hasKey("fileName")) params.getString("fileName") ?: "Kwickly_Receipt.pdf" else "Kwickly_Receipt.pdf"
            val fileName = rawName.replace("[^a-zA-Z0-9._-]".toRegex(), "_")
            val title = if (params.hasKey("title")) params.getString("title") ?: "Kwickly Receipt" else "Kwickly Receipt"

            val bytes = android.util.Base64.decode(base64, android.util.Base64.DEFAULT)
            val file = File(reactCtx.cacheDir, fileName)
            FileOutputStream(file).use { it.write(bytes) }

            val contentUri = FileProvider.getUriForFile(reactCtx, "${reactCtx.packageName}.fileprovider", file)
            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                setType("application/pdf")
                putExtra(Intent.EXTRA_STREAM, contentUri)
                putExtra(Intent.EXTRA_SUBJECT, title)
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

    private fun extractAmountFromText(text: String): String? {
        if (text.isEmpty()) return null

        // 1. Amount before action verb (e.g. "₹282.04 sent to GHANSHYAM", "Rs 282 debited")
        val beforeRegex = Regex("""(?:Rs\.?|INR|₹)\s*([0-9]+(?:\.[0-9]{1,2})?)\s*(?:debited|sent|transferred|paid)""", RegexOption.IGNORE_CASE)
        val beforeMatch = beforeRegex.find(text)
        if (beforeMatch != null) {
            return beforeMatch.groupValues[1]
        }

        // 2. Amount after action verb
        val afterRegex = Regex("""(?:debited\s*(?:by|with|for)?|paid\s*(?:to\s*[^,\n\r]+?)?|sent\s*(?:to\s*[^,\n\r]+?)?|transferred\s*|txn\s*(?:of)?)\s*(?:Rs\.?|INR|₹)?\s*([0-9]+(?:\.[0-9]{1,2})?)""", RegexOption.IGNORE_CASE)
        val afterMatch = afterRegex.find(text)
        if (afterMatch != null) {
            return afterMatch.groupValues[1]
        }

        // 3. General amount before balance
        val preBal = text.split(Regex("""(?:bal(?:ance)?|avl\s*bal|total\s*bal)""", RegexOption.IGNORE_CASE))[0]
        val genRegex = Regex("""(?:Rs\.?|INR|₹)\s*([0-9]+(?:\.[0-9]{1,2})?)""", RegexOption.IGNORE_CASE)
        val genMatch = genRegex.find(preBal)
        return genMatch?.groupValues?.get(1)
    }

    private fun getNativeClipboardUtrSync(): String? {
        try {
            val clipboard = reactCtx.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
            val clip = clipboard?.primaryClip
            if (clip != null && clip.itemCount > 0) {
                val text = clip.getItemAt(0)?.text?.toString() ?: ""
                return extractUtrFromText(text)
            }
        } catch (e: Exception) {
            // Ignore
        }
        return null
    }

    private fun extractUtrFromText(text: String): String? {
        if (text.isEmpty()) return null

        // 1. Check targeted UPI Reference / UTR keywords
        val keywordRegex = Regex(
            """(?:upi\s*(?:ref(?:erence)?|txn(?:action)?(?:\s*id)?|rrn|id|no)?[:\s/_-]*|ref\s*(?:no|id|num)?[:\s/_-]*|rrn[:\s/_-]*|utr(?:\s*no)?[:\s/_-]*|urn[:\s/_-]*|imps\s*ref[:\s/_-]*|txn\s*ref[:\s/_-]*|approval\s*ref[:\s/_-]*|upi/(?:p2a|p2p|cr|dr)?/?)\D*?(\d{12})""",
            RegexOption.IGNORE_CASE
        )
        val match = keywordRegex.find(text)
        if (match != null) {
            val candidate = match.groupValues[1]
            if (candidate.length == 12 && candidate.toSet().size >= 3) return candidate
        }

        // 2. Standalone 12-digit candidate, excluding account numbers
        val accRegex = Regex("""(?:a/c|acct|account|acc\s*no|card)\s*(?:no\.?)?\s*[:\s#]*[xX*]*(\d{9,18})""", RegexOption.IGNORE_CASE)
        val accMatches = accRegex.findAll(text).map { it.groupValues[1] }.toSet()

        val standaloneRegex = Regex("""\b(\d{12})\b""")
        val standaloneMatches = standaloneRegex.findAll(text)
        for (m in standaloneMatches) {
            val candidate = m.groupValues[1]
            if (!accMatches.contains(candidate) && candidate.length == 12 && candidate.toSet().size >= 3) {
                return candidate
            }
        }
        return null
    }
}
