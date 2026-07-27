const fs = require('fs');
const txt = fs.readFileSync('dump2.txt', 'utf16le');
const idx = txt.indexOf('I have read and agree');
console.log(txt.substring(idx - 500, idx + 100));
