# Kwickly — Deployment Guide

Three deployables, one repo:

| Piece   | Host                    | URL                                            | Source dir |
|---------|-------------------------|------------------------------------------------|------------|
| API     | Render (Docker/Node)    | https://kwickly-backend-r6zb.onrender.com      | `backend/` |
| Admin   | Vercel (static Vite)    | https://kwickly-app.vercel.app                 | `admin/`   |
| Mobile  | sideloaded APK          | `Kwickly-v1.0-*.apk` in the repo root          | `mobile/`  |

Everything deploys from `main`. Push to `main` → Render and Vercel rebuild.

---

## 1. Backend (Render)

**Service settings**
- Build: Docker (`backend/Dockerfile`) or `npm ci` + start `node src/server.js`
- Root directory: `backend`
- Health check path: `/health` (returns 503 while Mongo is disconnected, so Render
  will not route traffic to a half-started instance)

**Required env vars** — the process exits at boot without these:

| Var          | Notes |
|--------------|-------|
| `MONGO_URI`  | Atlas connection string |
| `JWT_SECRET` | Long random string. Rotating it invalidates every issued token and logs everyone out. |

**Strongly recommended**

| Var                | Notes |
|--------------------|-------|
| `NODE_ENV`         | `production` — enables prod logging, disables seeding, enforces strict CORS |
| `ALLOWED_ORIGINS`  | Comma-separated browser origins. `https://kwickly-app.vercel.app` is allowed in code too, so the panel keeps working even if this is unset. |
| `PLATFORM_UPI_ID`  | The UPI VPA customers pay into. Payments are UPI-only (intent link + 12-digit UTR verified by an admin) — there is no payment gateway. |
| `ADMIN_DEFAULT_EMAIL` / `ADMIN_DEFAULT_PASSWORD` | Seeded admin. Change the password after first login. |
| `REDIS_URL`        | Optional. Without it: no cross-instance socket fan-out and no distributed cron locks, so run exactly one instance. |
| `CLOUDINARY_*`     | Image uploads (KYC docs, product photos) |
| `ENABLE_REAL_SMS` + provider keys (`FAST2SMS_API_KEY` / `MSG91_*` / `TWILIO_*`) | Real OTP delivery. Unset ⇒ OTPs are logged, not sent. |

**Keep-alive / cold starts.** An idle-scaled instance is suspended after ~15 min
with no inbound traffic. While suspended **the cron engine does not run** —
broadcast radius sweeps, ghost-quote cleanup, ghost-order cleanup and
subscription expiry all stall, and the next real request waits ~30s for a cold
start. `src/helpers/keepAlive.helper.js` self-pings `/health` every 12 min in
production using `KEEP_ALIVE_URL`, or `RENDER_EXTERNAL_URL` (Render injects that
automatically), which keeps the instance and the cron engine awake. On a paid
always-on instance you can disable it by setting `KEEP_ALIVE_URL=` (empty).

---

## 2. Admin panel (Vercel)

The build must bake in the API URL — a Vite app resolves `import.meta.env` at
**build** time, not in the browser.

`admin/src/config.js` resolves, in order:
1. `VITE_API_URL` / `VITE_SOCKET_URL` (Vercel env vars or `admin/.env.production`)
2. production build default → the Render URL above
3. dev default → `http://localhost:5000`

So a Vercel deploy needs **no env vars at all**. If the backend URL ever changes,
either set `VITE_API_URL` in Vercel or update `PROD_BACKEND` in `admin/src/config.js`.

**Project settings — either arrangement works:**
- *Root Directory = `admin`* → Vercel auto-detects Vite; `admin/vercel.json` adds
  the SPA rewrite (every path → `index.html`, needed for `/login`, `/wallets`, …).
- *Root Directory = repo root* → the root `vercel.json` supplies
  `installCommand`, `buildCommand` and `outputDirectory: admin/dist`.

**If a push does not produce a new deployment**, Git integration is what's broken,
not the build. Check Vercel → Project → Settings → Git that the repo is connected
and Production Branch is `main`, then Deployments → ⋯ → Redeploy. To confirm what
is actually live: the served `index.html` should reference hashed chunk files
(`assets/Dashboard-*.js`), not one monolithic `assets/index-*.js`, and must not
contain a Razorpay `<script>` tag.

---

## 3. Mobile APK

```bash
cd mobile
# 1. Point the app at production (already set)
#    src/config/env.js → IS_PROD = true, PROD_URL = <Render URL>
# 2. Build
cd android && ./gradlew clean assembleRelease
```

Outputs in `mobile/android/app/build/outputs/apk/release/`:
- `app-universal-release.apk` — hand this to testers (works on any phone)
- `app-arm64-v8a-release.apk` / `app-armeabi-v7a-release.apk` — smaller, per-ABI

**Do not re-enable R8/ProGuard** (`enableProguardInReleaseBuilds`) or
`shrinkResources` without testing the resulting APK on a device first. Minifying
a React Native release build strips classes that native modules and view managers
look up reflectively, which crashes the app at launch with nothing useful in the
JS logs — the keep rules in `proguard-rules.pro` do not cover every dependency.

The release APK is signed with the checked-in `debug.keystore`. That is fine for
sideloaded testing but must be replaced with a real upload keystore before Play
Store submission — and once published, the signing key can never change.

**Verifying a build before shipping it:**
```bash
adb install -r app-universal-release.apk
adb logcat -c && adb shell monkey -p com.kwicklymobile -c android.intent.category.LAUNCHER 1
adb shell pidof com.kwicklymobile      # empty ⇒ it died
adb logcat -d | grep -iE "AndroidRuntime|ReactNative|FATAL"
```

---

## 4. Post-deploy smoke check

```bash
# API alive and DB connected
curl -s https://kwickly-backend-r6zb.onrender.com/health

# Admin origin allowed through CORS (expect access-control-allow-origin echoed back)
curl -si -X OPTIONS https://kwickly-backend-r6zb.onrender.com/api/v1/admin/auth/login \
  -H "Origin: https://kwickly-app.vercel.app" \
  -H "Access-Control-Request-Method: POST" | grep -i access-control

# Admin panel serving a current build
curl -s https://kwickly-app.vercel.app/ | grep assets/
```

Then in the panel: log in → Dashboard loads stats → Wallets lists pending UPI
top-ups. In the app: OTP login → home categories load → place a job and confirm
a worker device receives the `NEW_JOB_ALERT` push/socket event.
