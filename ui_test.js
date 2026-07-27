const { execSync } = require('child_process');
const fs = require('fs');

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function run(cmd) {
    console.log("Running:", cmd);
    return execSync(cmd).toString();
}

function getBounds(node) {
    const boundsStr = node.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
    if (!boundsStr) return null;
    return {
        x1: parseInt(boundsStr[1]),
        y1: parseInt(boundsStr[2]),
        x2: parseInt(boundsStr[3]),
        y2: parseInt(boundsStr[4])
    };
}

async function dumpAndFind(text) {
    run('adb shell rm /sdcard/window_dump.xml');
    run('adb shell uiautomator dump');
    run('adb pull /sdcard/window_dump.xml window_dump.xml');
    
    if (!fs.existsSync('window_dump.xml')) return null;
    
    const xml = fs.readFileSync('window_dump.xml', 'utf-8');
    
    // Find node with text
    const regex = new RegExp(`<node[^>]*text="${text}"[^>]*>`, 'g');
    const matches = [...xml.matchAll(regex)];
    
    if (matches.length === 0) return null;
    
    const node = matches[0][0];
    const bounds = getBounds(node);
    
    if (bounds) {
        const cx = Math.floor((bounds.x1 + bounds.x2) / 2);
        const cy = Math.floor((bounds.y1 + bounds.y2) / 2);
        return { cx, cy };
    }
    return null;
}

async function tapText(text) {
    console.log("Looking for:", text);
    const coords = await dumpAndFind(text);
    if (coords) {
        console.log(`Found '${text}' at ${coords.cx}, ${coords.cy}`);
        run(`adb shell input tap ${coords.cx} ${coords.cy}`);
        return true;
    }
    console.log(`Could not find '${text}'`);
    return false;
}

async function main() {
    console.log("Starting robust UI test...");
    run('adb shell am force-stop com.kwicklymobile');
    run('adb shell am start -n com.kwicklymobile/.MainActivity');
    
    console.log("Waiting for app to load...");
    await sleep(40000); // Wait for Metro bundle
    
    let tapped = await tapText("Create Account ->");
    if (!tapped) return;
    
    await sleep(2000);
    
    tapped = await tapText("Shop Owner");
    if (!tapped) return;
    
    await sleep(1000);
    tapped = await tapText("Continue →");
    if (!tapped) return;
    
    await sleep(2000);
    console.log("On Phone Screen!");
}

main().catch(console.error);
