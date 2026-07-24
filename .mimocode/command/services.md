---
description: "Start, stop, or restart the backend, admin, and mobile services for this project. Use 'start' to launch all, 'restart' to kill existing and relaunch, 'stop' to terminate."
agent: build
---

# Service Management Command

Manage the three Kwickly services on Windows: **backend** (Express API), **admin** (Vite React), **mobile** (React Native Metro).

## Usage

```
$ARGUMENTS
```

Valid arguments: `start`, `stop`, `restart`. Default: `restart`.

## Procedure

### Step 1: Stop existing processes (for restart/stop)

Kill all node processes related to this project's services:

```powershell
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object {
  $_.CommandLine -match 'server\.js|vite|metro|react-native|nodemon'
} | ForEach-Object {
  Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}
```

Wait 3 seconds after killing processes to let ports free up.

### Step 2: Start services (for start/restart)

Launch each service in a separate PowerShell window:

**Backend** (port 5000):
```powershell
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'D:\kwickly\11-4-26\backend'; npm run dev"
```

**Admin panel** (Vite dev server):
```powershell
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'D:\kwickly\11-4-26\admin'; npm run dev"
```

**Mobile app** (Metro bundler):
```powershell
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'D:\kwickly\11-4-26\mobile'; npm start"
```

### Step 3: Verify services are running

After starting, check that ports are listening:

```powershell
Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue
```

For the admin panel, the Vite dev server port (usually 5173 or 3000) should also be listening.

### Step 4: Report status

Tell the user which services are running and on which ports. If any service failed to start, show the error and suggest checking `node_modules`:

```powershell
Test-Path "D:\kwickly\11-4-26\backend\node_modules"
Test-Path "D:\kwickly\11-4-26\admin\node_modules"
```

If `node_modules` is missing, run `npm install` in that directory first.

## Notes

- If the user reports a blank screen after restart, the mobile app may need a cache clear. Check `mobile/mobile.log` for errors.
- Backend runs on port 5000 (configurable in `backend/.env`).
- Admin Vite dev server runs on port 5173 by default.
- Mobile Metro bundler runs on port 8081 by default.
- All three services must be running for full end-to-end testing.
