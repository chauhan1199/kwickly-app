const { execSync } = require('child_process');

function run(cmd) {
    console.log("Running: " + cmd);
    try {
        return execSync(cmd).toString();
    } catch (e) {
        return "";
    }
}

function sleep(ms) {
    execSync(`node -e "setTimeout(()=>{}, ${ms})"`);
}

run(`adb shell am force-stop com.kwicklymobile`);
sleep(1000);
run(`adb shell am start -n com.kwicklymobile/.MainActivity`);
sleep(35000);

// Welcome
run(`adb shell input tap 540 2100`);
run(`adb shell input tap 540 2150`);
sleep(2000);
run(`adb shell screencap -p /sdcard/nav1.png`);
run(`adb pull /sdcard/nav1.png nav1.png`);

// Role Selection (Shop Owner)
// Shop Owner is the 3rd box. Let's tap 540, 1500 and 540, 1600
run(`adb shell input tap 540 1500`);
run(`adb shell input tap 540 1600`);
sleep(1000);
// Continue
run(`adb shell input tap 540 2050`);
run(`adb shell input tap 540 2100`);
run(`adb shell input tap 540 2150`);
sleep(2000);
run(`adb shell screencap -p /sdcard/nav2.png`);
run(`adb pull /sdcard/nav2.png nav2.png`);
