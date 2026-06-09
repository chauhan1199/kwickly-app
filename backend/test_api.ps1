$BASE = "http://localhost:5000/api/v1"
$global:pass = 0
$global:fail = 0

function Test-API {
    param($label, $method, $url, $body, $token, $expectCode)
    try {
        $headers = @{ "Content-Type" = "application/json" }
        if ($token) { $headers["Authorization"] = "Bearer $token" }
        $params = @{ Uri=$url; Method=$method; Headers=$headers; UseBasicParsing=$true }
        if ($body) { $params["Body"] = ($body | ConvertTo-Json -Compress) }
        $res = Invoke-WebRequest @params -ErrorAction Stop
        $code = [int]$res.StatusCode
        $data = $res.Content | ConvertFrom-Json
        if ($code -eq $expectCode) {
            Write-Host "[PASS] $label  => HTTP $code" -ForegroundColor Green
            $global:pass++
        } else {
            Write-Host "[FAIL] $label  => HTTP $code (expected $expectCode)" -ForegroundColor Red
            $global:fail++
        }
        return $data
    } catch {
        $code = [int]$_.Exception.Response.StatusCode.value__
        $errMsg = ""
        try { $errMsg = $_.ErrorDetails.Message | ConvertFrom-Json | Select-Object -ExpandProperty message } catch {}
        if ($code -eq $expectCode) {
            Write-Host "[PASS] $label  => HTTP $code" -ForegroundColor Green
            $global:pass++
        } else {
            Write-Host "[FAIL] $label  => HTTP $code (expected $expectCode) $errMsg" -ForegroundColor Red
            $global:fail++
        }
        return $null
    }
}

Write-Host ""
Write-Host "=============================" -ForegroundColor Cyan
Write-Host " KWICKLY BACKEND API TESTS  " -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Cyan

# ── HEALTH CHECK ─────────────────────────────────────────────────────────────
Write-Host "`n[HEALTH]" -ForegroundColor Yellow
Test-API "Health check" "GET" "http://localhost:5000/health" $null $null 200 | Out-Null

# ── 1. AUTH ───────────────────────────────────────────────────────────────────
Write-Host "`n[AUTH]" -ForegroundColor Yellow

$custLogin = Test-API "Customer Login (phone+password)" "POST" "$BASE/auth/login" @{phone="9000000001";password="customer123"} $null 200
$custToken = if ($custLogin) { $custLogin.data.token } else { $null }

$wrkLogin = Test-API "Worker Login (phone+password)" "POST" "$BASE/auth/login" @{phone="9876543210";password="worker123"} $null 200
$wrkToken = if ($wrkLogin) { $wrkLogin.data.token } else { $null }

$admLogin = Test-API "Admin Login (email+password)" "POST" "$BASE/auth/login" @{email="admin@kwickly.com";password="admin123"} $null 200
$admToken = if ($admLogin) { $admLogin.data.token } else { $null }

Test-API "Bad password -> 401" "POST" "$BASE/auth/login" @{phone="9000000001";password="wrongpass"} $null 401 | Out-Null
Test-API "Missing phone -> 400/401" "POST" "$BASE/auth/login" @{password="test"} $null 400 | Out-Null

# ── 2. CATEGORIES ────────────────────────────────────────────────────────────
Write-Host "`n[CATEGORIES]" -ForegroundColor Yellow
# Categories requires auth
$cats = Test-API "Get all categories (with auth)" "GET" "$BASE/categories" $null $custToken 200
if ($cats -and $cats.data) { Write-Host "         Count: $($cats.data.Count) categories found" -ForegroundColor DarkGray }
Test-API "Categories no token -> 401" "GET" "$BASE/categories" $null $null 401 | Out-Null

# ── 3. CUSTOMER PROFILE ──────────────────────────────────────────────────────
Write-Host "`n[CUSTOMER]" -ForegroundColor Yellow
Test-API "Customer: create job POST /customers/jobs" "POST" "$BASE/customers/jobs" @{category="Plumbing";description="Pipe burst";location=@{coordinates=@(72.8777,19.0760)}} $custToken 200 | Out-Null

# ── 4. SETTINGS (Admin only) ─────────────────────────────────────────────────
Write-Host "`n[SETTINGS]" -ForegroundColor Yellow
$settings = Test-API "Get settings (admin)" "GET" "$BASE/settings" $null $admToken 200
if ($settings -and $settings.data) { Write-Host "         App: $($settings.data.branding.appName)" -ForegroundColor DarkGray }
Test-API "Settings no token -> 401" "GET" "$BASE/settings" $null $null 401 | Out-Null

# ── 5. NOTIFICATIONS (Admin only) ────────────────────────────────────────────
Write-Host "`n[NOTIFICATIONS]" -ForegroundColor Yellow
Test-API "Get notifications (admin)" "GET" "$BASE/notifications" $null $admToken 200 | Out-Null
Test-API "Notifications no token -> 401" "GET" "$BASE/notifications" $null $null 401 | Out-Null

# ── 6. JOBS (Admin only) ────────────────────────────────────────────────────
Write-Host "`n[JOBS]" -ForegroundColor Yellow
$jobs = Test-API "Get all jobs (admin)" "GET" "$BASE/jobs" $null $admToken 200
if ($jobs -and $jobs.data) { Write-Host "         Count: $($jobs.data.Count) jobs found" -ForegroundColor DarkGray }
Test-API "Jobs no token -> 401" "GET" "$BASE/jobs" $null $null 401 | Out-Null
Test-API "Jobs customer token -> 403" "GET" "$BASE/jobs" $null $custToken 403 | Out-Null

# ── 7. PAYOUTS (Admin only) ──────────────────────────────────────────────────
Write-Host "`n[PAYOUTS]" -ForegroundColor Yellow
$payouts = Test-API "Get all payouts (admin)" "GET" "$BASE/payouts" $null $admToken 200
if ($payouts -and $payouts.data) { Write-Host "         Count: $($payouts.data.Count) payouts found" -ForegroundColor DarkGray }
Test-API "Payouts no token -> 401" "GET" "$BASE/payouts" $null $null 401 | Out-Null

# ── 8. ADMIN DASHBOARD ───────────────────────────────────────────────────────
Write-Host "`n[ADMIN]" -ForegroundColor Yellow
$stats = Test-API "Admin stats" "GET" "$BASE/admin/stats" $null $admToken 200
if ($stats -and $stats.data) { 
    Write-Host "         Workers: $($stats.data.workers)  Customers: $($stats.data.customers)  Jobs: $($stats.data.jobs)" -ForegroundColor DarkGray
}
Test-API "Admin customers list" "GET" "$BASE/admin/customers" $null $admToken 200 | Out-Null
Test-API "Admin workers list" "GET" "$BASE/admin/workers" $null $admToken 200 | Out-Null
Test-API "Admin jobs list" "GET" "$BASE/admin/jobs" $null $admToken 200 | Out-Null
Test-API "Admin disputes list" "GET" "$BASE/admin/disputes" $null $admToken 200 | Out-Null
Test-API "Admin payouts list" "GET" "$BASE/admin/payouts" $null $admToken 200 | Out-Null
Test-API "Admin suggestions list" "GET" "$BASE/admin/suggestions" $null $admToken 200 | Out-Null
Test-API "Admin with customer token -> 403" "GET" "$BASE/admin/stats" $null $custToken 403 | Out-Null

# ── SUMMARY ──────────────────────────────────────────────────────────────────
$total = $global:pass + $global:fail
Write-Host ""
Write-Host "=============================" -ForegroundColor Cyan
Write-Host " RESULTS: $($global:pass)/$total PASSED" -ForegroundColor $(if ($global:fail -eq 0) { "Green" } else { "Yellow" })
if ($global:fail -gt 0) { Write-Host " FAILED:  $($global:fail) tests" -ForegroundColor Red }
Write-Host "=============================" -ForegroundColor Cyan
