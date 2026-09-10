const http = require('http');
const fs = require('fs');

const apkPath = 'd:/kwickly/11-4-26/kwickly.apk';
const PORT = 8088;

const server = http.createServer((req, res) => {
  if (req.url === '/kwickly.apk' || req.url === '/apk') {
    if (fs.existsSync(apkPath)) {
      const stat = fs.statSync(apkPath);
      res.writeHead(200, {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Length': stat.size,
        'Content-Disposition': 'attachment; filename=kwickly-v1.5.6.apk'
      });
      fs.createReadStream(apkPath).pipe(res);
    } else {
      res.writeHead(404);
      res.end('APK not found');
    }
  } else if (req.url === '/kwickly-universal.apk' || req.url === '/universal') {
    const uniPath = 'd:/kwickly/11-4-26/kwickly-universal.apk';
    if (fs.existsSync(uniPath)) {
      const stat = fs.statSync(uniPath);
      res.writeHead(200, {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Length': stat.size,
        'Content-Disposition': 'attachment; filename=kwickly-universal-v1.5.6.apk'
      });
      fs.createReadStream(uniPath).pipe(res);
    } else {
      res.writeHead(404);
      res.end('Universal APK not found');
    }
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Kwickly APK Download</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0B0F19; color: #FFF; }
    .card { background: #131B2E; padding: 28px; border-radius: 20px; border: 1.5px solid #1E293B; text-align: center; max-width: 380px; width: 90%; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    h1 { margin: 0 0 8px; font-size: 24px; color: #FFF; }
    p { color: #94A3B8; font-size: 14px; margin-bottom: 20px; line-height: 1.4; }
    .btn-main { display: block; background: #6C47FF; color: #FFF; font-weight: 700; text-decoration: none; padding: 14px 20px; border-radius: 12px; font-size: 16px; margin-bottom: 12px; transition: transform 0.1s; }
    .btn-main:active { transform: scale(0.98); }
    .btn-secondary { display: block; background: #1E293B; color: #94A3B8; font-weight: 600; text-decoration: none; padding: 10px 16px; border-radius: 10px; font-size: 13px; }
    .badge { display: inline-block; background: rgba(108, 71, 255, 0.2); color: #C4B5FD; padding: 4px 10px; border-radius: 20px; font-size: 12px; margin-bottom: 8px; font-weight: 600; }
    .success-badge { display: inline-block; background: rgba(34, 197, 94, 0.15); color: #4ADE80; padding: 4px 10px; border-radius: 12px; font-size: 11px; margin-bottom: 12px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">v1.5.6 (Build 57) Full Screen Edge-to-Edge</div><br/>
    <div class="success-badge">✓ Zero Black Gaps · Flush Road Footer · Brand Nav</div>
    <h1>Kwickly Mobile</h1>
    <p>Complete edge-to-edge full screen Login page with brand navigation, security trust card, and flush landscape footer.</p>
    <a class="btn-main" href="/kwickly.apk">Download Release APK (ARM64)</a>
    <a class="btn-secondary" href="/kwickly-universal.apk">Download Universal APK</a>
  </div>
</body>
</html>`);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('APK HTTP Server active at http://0.0.0.0:' + PORT + '/');
});
