package com.kwickly.smsbridge;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.graphics.Typeface;
import android.os.Bundle;
import android.view.Gravity;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/** One screen: grant SMS access, run a connection test, and see what was forwarded. */
public class MainActivity extends Activity {
    private static final int REQ_SMS = 7;
    private TextView status;
    private TextView log;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        int pad = (int) (20 * getResources().getDisplayMetrics().density);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(pad, pad * 2, pad, pad);

        TextView title = new TextView(this);
        title.setText("Kwickly SMS Bridge");
        title.setTextSize(22);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        root.addView(title);

        TextView about = new TextView(this);
        about.setText("Forwards bank \"credited\" SMS to Kwickly so UPI payments confirm automatically. Other SMS never leave this phone.");
        about.setPadding(0, pad / 2, 0, pad / 2);
        root.addView(about);

        status = new TextView(this);
        status.setTextSize(16);
        status.setPadding(0, 0, 0, pad / 2);
        root.addView(status);

        Button allow = new Button(this);
        allow.setText("Allow SMS access");
        allow.setOnClickListener(v -> requestPermissions(new String[]{Manifest.permission.RECEIVE_SMS}, REQ_SMS));
        root.addView(allow);

        Button test = new Button(this);
        test.setText("Test connection");
        test.setOnClickListener(v -> runTest());
        root.addView(test);

        log = new TextView(this);
        log.setTypeface(Typeface.MONOSPACE);
        log.setTextSize(12);
        log.setPadding(0, pad, 0, 0);
        log.setGravity(Gravity.START);
        root.addView(log);

        ScrollView scroll = new ScrollView(this);
        scroll.addView(root);
        setContentView(scroll);
    }

    @Override
    protected void onResume() {
        super.onResume();
        refresh();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        refresh();
    }

    private void runTest() {
        status.setText("Testing... (the server may take up to a minute to wake up)");
        new Thread(() -> {
            // Not a credit SMS: the server checks the secret, then ignores it. Nothing is paid or changed.
            int code = Forwarder.post("Kwickly SMS Bridge connection test");
            String result;
            if (code >= 200 && code < 300) result = "Test OK: server accepted the secret";
            else if (code == 401) result = "Test FAILED: server rejected the secret";
            else if (code == -1) result = "Test FAILED: server not reachable";
            else result = "Test FAILED: server answered " + code;
            Forwarder.record(this, result);
            runOnUiThread(this::refresh);
        }).start();
    }

    private void refresh() {
        boolean granted = checkSelfPermission(Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED;
        boolean hasSecret = !BuildConfig.WEBHOOK_SECRET.isEmpty();
        String state;
        if (!hasSecret) state = "NOT READY: this build has no webhook secret";
        else if (!granted) state = "NOT READY: tap \"Allow SMS access\"";
        else state = "ACTIVE: bank credit SMS will be forwarded";
        status.setText(state);
        log.setText(getSharedPreferences(Forwarder.PREFS, MODE_PRIVATE).getString("log", ""));
    }
}
