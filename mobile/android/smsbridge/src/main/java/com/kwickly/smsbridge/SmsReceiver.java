package com.kwickly.smsbridge;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.provider.Telephony;
import android.telephony.SmsMessage;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Receives every incoming SMS and queues bank credit messages for forwarding. */
public class SmsReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) return;
        SmsMessage[] parts = Telephony.Sms.Intents.getMessagesFromIntent(intent);
        if (parts == null) return;

        // A long SMS arrives in several parts; join them per sender.
        Map<String, StringBuilder> bySender = new LinkedHashMap<>();
        for (SmsMessage part : parts) {
            if (part == null) continue;
            String sender = String.valueOf(part.getOriginatingAddress());
            StringBuilder body = bySender.get(sender);
            if (body == null) {
                body = new StringBuilder();
                bySender.put(sender, body);
            }
            body.append(part.getMessageBody());
        }
        List<String> credits = new ArrayList<>();
        for (StringBuilder body : bySender.values()) {
            String text = body.toString();
            if (Forwarder.isBankCredit(text)) credits.add(text);
        }
        if (credits.isEmpty()) return;

        // Send right away when the server is awake; the phone may hold queued jobs back for minutes.
        // Anything not delivered within the receiver's time budget goes to the retry queue.
        PendingResult pending = goAsync();
        new Thread(() -> {
            try {
                for (String text : credits) {
                    int code = Forwarder.post(text, 8_000);
                    if (code >= 200 && code < 300) Forwarder.record(context, "Sent OK: " + Forwarder.preview(text));
                    else if (code == 401) Forwarder.record(context, "REJECTED (wrong secret): " + Forwarder.preview(text));
                    else Forwarder.enqueue(context, text);
                }
            } finally {
                pending.finish();
            }
        }).start();
    }
}
