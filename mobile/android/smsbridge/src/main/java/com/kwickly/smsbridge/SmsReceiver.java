package com.kwickly.smsbridge;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.provider.Telephony;
import android.telephony.SmsMessage;

import java.util.LinkedHashMap;
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
        for (StringBuilder body : bySender.values()) {
            String text = body.toString();
            if (Forwarder.isBankCredit(text)) Forwarder.enqueue(context, text);
        }
    }
}
