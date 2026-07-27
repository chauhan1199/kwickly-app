const { execSync } = require('child_process');
const fs = require('fs');

function run(cmd) {
    console.log("Running: " + cmd);
    execSync(cmd, { stdio: 'inherit' });
}

function sleep(ms) {
    execSync(`node -e "setTimeout(()=>{}, ${ms})"`);
}

function tap(x, y) {
    run(`adb shell input tap ${x} ${y}`);
}

function type(text) {
    run(`adb shell input text "${text}"`);
}

function keyevent(code) {
    run(`adb shell input keyevent ${code}`);
}

function screenshot(name) {
    run(`adb shell screencap -p /sdcard/${name}.png`);
    run(`adb pull /sdcard/${name}.png "C:\\Users\\chauh\\.gemini\\antigravity-ide\\brain\\07fa5005-e8cb-4dfc-a0a8-e0d339b23e18\\${name}.png"`);
}

console.log("Starting automation...");

// 1. Restart App
run(`adb shell am force-stop com.kwicklymobile`);
sleep(1000);
run(`adb shell am start -n com.kwicklymobile/.MainActivity`);
console.log("Waiting for app to load...");
sleep(30000); // 8s to let it load Metro/splash
screenshot("test_1_welcome");

// 2. Tap Create Account
tap(540, 2150);
sleep(2000);
screenshot("test_2_role");

// 3. Tap Shop Owner
tap(540, 1476);
sleep(1000);

// 4. Continue
tap(540, 2136);
sleep(3000);
screenshot("test_3_form");

// 5. Fill Name
tap(540, 1010);
sleep(1000);
type("Rahul");
sleep(500);
keyevent(62); // space
sleep(500);
type("Sharma");
sleep(1000);
keyevent(4); // Back to close keyboard
sleep(1000);
screenshot("test_4_name");

// 6. Fill Mobile
tap(540, 1303);
sleep(1000);
type("9876543219");
sleep(1000);
keyevent(4); // Back to close keyboard
sleep(1000);
screenshot("test_5_mobile");

// 7. Checkbox
tap(100, 2125);
sleep(1000);

// 8. Send OTP
tap(540, 2363);
sleep(3000);

// Final Screenshot
screenshot("test_6_otp");
console.log("Done.");
