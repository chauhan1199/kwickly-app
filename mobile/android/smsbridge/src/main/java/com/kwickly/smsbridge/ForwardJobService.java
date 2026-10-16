package com.kwickly.smsbridge;

import android.app.job.JobParameters;
import android.app.job.JobService;

/** Sends one queued SMS to the backend; asks JobScheduler to retry on network or server errors. */
public class ForwardJobService extends JobService {
    @Override
    public boolean onStartJob(JobParameters params) {
        String message = params.getExtras().getString("message");
        if (message == null) return false;
        new Thread(() -> {
            int code = Forwarder.post(message);
            boolean retry = code == -1 || code >= 500;
            if (code >= 200 && code < 300) {
                Forwarder.record(this, "Sent OK: " + Forwarder.preview(message));
            } else if (code == 401) {
                Forwarder.record(this, "REJECTED (wrong secret): " + Forwarder.preview(message));
            } else {
                Forwarder.record(this, (retry ? "Will retry (" : "Failed (") + code + "): " + Forwarder.preview(message));
            }
            jobFinished(params, retry);
        }).start();
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters params) {
        return true;
    }
}
