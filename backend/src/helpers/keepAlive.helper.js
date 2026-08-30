const https = require('https');
const http = require('http');
const logger = require('./logger.helper');

/**
 * Keep-alive pinger.
 *
 * Free/idle-scaled hosts (Render, Railway, Fly) suspend a web service after a
 * period with no INBOUND traffic. When the process is suspended the cron engine
 * stops too, so broadcast sweeps, ghost-quote cleanup and subscription expiry
 * silently stop running, and the next real user pays a ~30s cold start.
 *
 * Hitting our own public URL counts as inbound traffic, so a periodic self-ping
 * keeps the instance (and therefore the cron engine) alive.
 *
 * Enabled only in production, and only when a public URL is known:
 *   KEEP_ALIVE_URL       — explicit opt-in / override
 *   RENDER_EXTERNAL_URL  — injected automatically by Render
 * Set KEEP_ALIVE_URL='' (or unset both) on a paid always-on instance to skip it.
 */

const INTERVAL_MS = 12 * 60 * 1000; // host idle timeout is typically 15 min
const REQUEST_TIMEOUT_MS = 20000;

let timer = null;

const ping = (baseUrl) => {
    const url = `${baseUrl.replace(/\/+$/, '')}/health`;
    try {
        const client = url.startsWith('https://') ? https : http;
        const req = client.get(url, (res) => {
            res.resume(); // drain so the socket is released
            logger.debug(`[KeepAlive] ${url} -> ${res.statusCode}`);
        });
        req.on('error', (err) => logger.debug(`[KeepAlive] ping failed: ${err.message}`));
        req.setTimeout(REQUEST_TIMEOUT_MS, () => req.destroy());
    } catch (err) {
        logger.debug(`[KeepAlive] ping threw: ${err.message}`);
    }
};

const startKeepAlive = () => {
    const baseUrl = process.env.KEEP_ALIVE_URL || process.env.RENDER_EXTERNAL_URL;
    if (process.env.NODE_ENV !== 'production' || !baseUrl) return false;

    stopKeepAlive();
    timer = setInterval(() => ping(baseUrl), INTERVAL_MS);
    if (typeof timer.unref === 'function') timer.unref();
    logger.info(`[KeepAlive] Self-pinging ${baseUrl}/health every 12 min so the instance (and cron engine) stays awake`);
    return true;
};

const stopKeepAlive = () => {
    if (timer) clearInterval(timer);
    timer = null;
};

module.exports = { startKeepAlive, stopKeepAlive };
