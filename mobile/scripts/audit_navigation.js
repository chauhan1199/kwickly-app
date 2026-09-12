const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) results = results.concat(walk(file));
    else if (file.endsWith('.js') || file.endsWith('.jsx')) results.push(file);
  });
  return results;
}

const navFiles = [
  'src/app/navigation/AuthStack.js',
  'src/app/navigation/CustomerTabs.js',
  'src/app/navigation/WorkerTabs.js',
  'src/app/navigation/ShopTabs.js',
  'src/app/navigation/RootNavigator.js'
];

const registeredScreens = new Set();
navFiles.forEach(nf => {
  const content = fs.readFileSync(nf, 'utf8');
  const regex = /name=["']([A-Za-z0-9_]+)["']/g;
  let m;
  while ((m = regex.exec(content)) !== null) {
    registeredScreens.add(m[1]);
  }
});

console.log('Total registered screens in navigation:', registeredScreens.size);

const allFiles = walk('src');
const navigateCalls = [];
const missingTargets = [];

const ignoreScreens = new Set([
  'CustomerApp', 'WorkerApp', 'ShopApp', 'Auth', 'Chat',
  'Home', 'Orders', 'Profile', 'Map', 'Jobs', 'Dashboard', 'Shop', 'Wallet',
  'Settings', 'Products'
]);

allFiles.forEach(f => {
  const code = fs.readFileSync(f, 'utf8');
  const regex = /navigation\.(navigate|replace|push)\(\s*['"]([A-Za-z0-9_]+)['"]/g;
  let match;
  while ((match = regex.exec(code)) !== null) {
    const target = match[2];
    navigateCalls.push({ file: f, target });
    if (!registeredScreens.has(target) && !ignoreScreens.has(target)) {
      missingTargets.push({ file: path.basename(f), target });
    }
  }
});

console.log('Total navigation.navigate calls:', navigateCalls.length);
if (missingTargets.length === 0) {
  console.log('SUCCESS: All navigation targets are properly registered!');
} else {
  console.log('Unregistered navigation targets:', JSON.stringify(missingTargets, null, 2));
}
