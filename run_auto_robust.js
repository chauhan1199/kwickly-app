const { execSync } = require('child_process');
const fs = require('fs');

function run(cmd, ignoreError = false) {
    console.log("Running: " + cmd);
    try {
        return execSync(cmd, { stdio: 'pipe' }).toString();
    } catch (e) {
        if (!ignoreError) throw e;
        return "";
    }
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

function screenshot(name) {
    run(`adb shell screencap -p /sdcard/${name}.png`);
    run(`adb pull /sdcard/${name}.png "C:\\Users\\chauh\\.gemini\\antigravity-ide\\brain\\07fa5005-e8cb-4dfc-a0a8-e0d339b23e18\\${name}.png"`);
}

console.log("Starting robust automation...");

run(`adb shell am force-stop com.kwicklymobile`);
sleep(1000);
run(`adb shell am start -n com.kwicklymobile/.MainActivity`);

console.log("Waiting for app to fully load (Welcome Screen)...");
// Wait 40 seconds to ensure React Native bundler has loaded everything
sleep(40000);

screenshot("test_1_welcome");

// 2. Tap Create Account on Welcome Screen
tap(540, 2150);
sleep(3000); // Wait for transition to Role Selection
screenshot("test_2_role");

// 2. Select Shop Owner role
tap(540, 1600); // Shop Owner is now lower down
sleep(1000);

// 3. Click Continue on Role Selection
tap(540, 2100); 
tap(540, 2150);
sleep(3000);
screenshot("test_3_phone");

// 4. Enter Name
tap(540, 1000); // Name field
type("Rahul");

// 5. Enter Mobile Number
tap(700, 1300); // Mobile field
type("9999999999");

// Dismiss keyboard
tap(540, 150);
sleep(1500);

// Swipe down to reveal the button
run(`adb shell input swipe 540 2000 540 500`);
sleep(1500);

// 8. Send OTP
tap(540, 2200);
sleep(5000);
screenshot("test_6_otp_sent");

console.log("Done.");
