const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ADB = 'C:\\Users\\chauh\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe';
const ARTIFACT_DIR = 'C:\\Users\\chauh\\.gemini\\antigravity-ide\\brain\\b35f3468-3c76-48e5-a3d5-0f5a59107435\\.tempmediaStorage';

function captureScreenshot(name = 'screen.png') {
  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }
  const target = path.join(ARTIFACT_DIR, name);
  const buf = execSync(`"${ADB}" exec-out screencap -p`, { maxBuffer: 25 * 1024 * 1024 });
  fs.writeFileSync(target, buf);
  console.log(`Saved screenshot to ${target} (${buf.length} bytes)`);
  return target;
}

function tap(x, y) {
  console.log(`Tapping (${x}, ${y})...`);
  execSync(`"${ADB}" shell input tap ${x} ${y}`);
}

function keyevent(code) {
  console.log(`Keyevent ${code}...`);
  execSync(`"${ADB}" shell input keyevent ${code}`);
}

function inputText(str) {
  console.log(`Input text: ${str}`);
  execSync(`"${ADB}" shell input text "${str}"`);
}

function launchApp() {
  console.log('Launching com.kwicklymobile...');
  execSync(`"${ADB}" shell monkey -p com.kwicklymobile -c android.intent.category.LAUNCHER 1`);
}

function stopApp() {
  console.log('Stopping com.kwicklymobile...');
  execSync(`"${ADB}" shell am force-stop com.kwicklymobile`);
}

function swipe(x1, y1, x2, y2, duration = 300) {
  console.log(`Swiping from (${x1}, ${y1}) to (${x2}, ${y2})...`);
  execSync(`"${ADB}" shell input swipe ${x1} ${y1} ${x2} ${y2} ${duration}`);
}

const cmd = process.argv[2] || 'screenshot';
const a1 = process.argv[3];
const a2 = process.argv[4];
const a3 = process.argv[5];
const a4 = process.argv[6];

if (cmd === 'screenshot') captureScreenshot(a1 || 'screen.png');
else if (cmd === 'tap') tap(a1, a2);
else if (cmd === 'key') keyevent(a1);
else if (cmd === 'text') inputText(a1);
else if (cmd === 'launch') launchApp();
else if (cmd === 'stop') stopApp();
else if (cmd === 'swipe') swipe(a1, a2, a3, a4);

