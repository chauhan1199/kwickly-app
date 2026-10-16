package com.kwickly.smsbridge;

import android.app.job.JobInfo;
import android.app.job.JobScheduler;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.PersistableBundle;

import org.json.JSONObject;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.regex.Pattern;

/** Decides which SMS to forward, queues them, and posts them to the backend webhook. */
final class Forwarder {
    static final String PREFS = "bridge";
    // Only bank credit messages leave the phone; everything else stays private.
    private static final Pattern CREDIT = Pattern.compile("credited|received|deposited", Pattern.CASE_INSENSITIVE);

    private Forwarder() {}

    static boolean isBankCredit(String body) {
        return body != null && CREDIT.matcher(body).find();
    }

    /** Queues one SMS; JobScheduler retries until the network and the (possibly sleeping) server answer. */
    static void enqueue(Context context, String body) {
        PersistableBundle extras = new PersistableBundle();
        extras.putString("message", body);
        int jobId = (int) (System.currentTimeMillis() & 0x7fffffff);
        JobInfo job = new JobInfo.Builder(jobId, new ComponentName(context, ForwardJobService.class))
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .setBackoffCriteria(30_000, JobInfo.BACKOFF_POLICY_EXPONENTIAL)
                .setPersisted(true)
                .setExtras(extras)
                .build();
        context.getSystemService(JobScheduler.class).schedule(job);
        record(context, "Queued: " + preview(body));
    }

    /** Posts one message. Returns the HTTP status, or -1 when the server could not be reached. */
    static int post(String message) {
        HttpURLConnection conn = null;
        try {
            JSONObject json = new JSONObject();
            json.put("message", message);
            json.put("secret", BuildConfig.WEBHOOK_SECRET);
            byte[] bytes = json.toString().getBytes(StandardCharsets.UTF_8);

            conn = (HttpURLConnection) new URL(BuildConfig.WEBHOOK_URL).openConnection();
            conn.setRequestMethod("POST");
            // The free Render server can take about a minute to wake up.
            conn.setConnectTimeout(90_000);
            conn.setReadTimeout(90_000);
            conn.setDoOutput(true);
            conn.setRequestProperty("Content-Type", "application/json");
            try (OutputStream out = conn.getOutputStream()) {
                out.write(bytes);
            }
            int code = conn.getResponseCode();
            InputStream in = code < 400 ? conn.getInputStream() : conn.getErrorStream();
            if (in != null) in.close();
            return code;
        } catch (Exception e) {
            return -1;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    static void record(Context context, String line) {
        String time = new SimpleDateFormat("dd MMM HH:mm:ss", Locale.US).format(new Date());
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String log = time + "  " + line + "\n" + prefs.getString("log", "");
        if (log.length() > 4000) log = log.substring(0, 4000);
        prefs.edit().putString("log", log).apply();
    }

    static String preview(String body) {
        String oneLine = body.replace('\n', ' ');
        return oneLine.length() > 60 ? oneLine.substring(0, 60) + "..." : oneLine;
    }
}
