const http = require('http');
const fs = require('fs');
const path = require('path');

const apkPath = path.resolve(__dirname, '../kwickly.apk');
const PORT = 8088;

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  // Any APK direct request
  if (
    url === '/kwickly.apk' ||
    url === '/apk' ||
    url === '/download' ||
    url.endsWith('.apk')
  ) {
    if (fs.existsSync(apkPath)) {
      const stat = fs.statSync(apkPath);
      res.writeHead(200, {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Length': stat.size,
        'Content-Disposition': 'attachment; filename=kwickly-v1.7.2.apk',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      fs.createReadStream(apkPath).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('APK not found on server');
    }
  } else {
    // Single clean download page
    let fileSizeMb = '23.3';
    if (fs.existsSync(apkPath)) {
      fileSizeMb = (fs.statSync(apkPath).size / (1024 * 1024)).toFixed(1);
    }

    res.writeHead(200, {
      'Content-Type': 'text/html',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kwickly Final Testing APK</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: #0B0F19;
      color: #FFFFFF;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: #131B2E;
      border: 1px solid #1E293B;
      border-radius: 24px;
      padding: 32px 24px;
      max-width: 400px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    }
    .badge {
      display: inline-block;
      background: rgba(108, 71, 255, 0.2);
      color: #A78BFA;
      font-size: 12px;
      font-weight: 700;
      padding: 6px 12px;
      border-radius: 20px;
      margin-bottom: 12px;
      letter-spacing: 0.5px;
    }
    .success-tag {
      display: inline-block;
      background: rgba(16, 185, 129, 0.15);
      color: #34D399;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 10px;
      margin-bottom: 16px;
    }
    h1 {
      font-size: 24px;
      font-weight: 800;
      margin-bottom: 8px;
    }
    .meta {
      color: #94A3B8;
      font-size: 13px;
      margin-bottom: 24px;
      line-height: 1.5;
    }
    .btn-download {
      display: block;
      background: linear-gradient(135deg, #6C47FF, #5535D4);
      color: #FFFFFF;
      font-weight: 800;
      font-size: 16px;
      text-decoration: none;
      padding: 16px 20px;
      border-radius: 16px;
      box-shadow: 0 8px 20px rgba(108, 71, 255, 0.35);
      transition: transform 0.1s, opacity 0.1s;
    }
    .btn-download:active {
      transform: scale(0.98);
      opacity: 0.9;
    }
    .features {
      text-align: left;
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid #1E293B;
    }
    .features h3 {
      font-size: 12px;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 10px;
    }
    .feature-item {
      font-size: 13px;
      color: #CBD5E1;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">v1.7.2 · Build 73 (Final)</div><br/>
    <div class="success-tag">✓ Ready For Full Verification</div>
    <h1>Kwickly Universal APK</h1>
    <p class="meta">Single unified APK compatible with all Android devices (${fileSizeMb} MB).</p>
    
    <a class="btn-download" href="/kwickly.apk">
      Download Final APK ↓
    </a>

    <div class="features">
      <h3>Verified Changes in this Build:</h3>
      <div class="feature-item">✓ Top Verified Pros multi-service selection modal</div>
      <div class="feature-item">✓ Subcategories header alignment & overlap fix</div>
      <div class="feature-item">✓ 100% dynamic professional profile (no static copy)</div>
      <div class="feature-item">✓ Direct priority dispatch to selected professional</div>
      <div class="feature-item">✓ Real bio & trust attributes in customer view</div>
    </div>
  </div>
</body>
</html>`);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Final APK HTTP Server running at http://0.0.0.0:${PORT}/ (serving ${apkPath})`);
});
