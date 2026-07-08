const fs = require('fs');
const path = require('path');

const filesToProcess = [
  'admin/src/modules/workers/Workers.jsx',
  'admin/src/modules/users/Users.jsx',
  'admin/src/modules/shops/Shops.jsx'
];

filesToProcess.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Remove all lines containing api.post('/admin/notifications/broadcast'
  // But wait, they might be on the same line as other code!
  // Looking at the grep output, they are often on their own line:
  // "      try { await api.post('/admin/notifications/broadcast', ... ) } catch {}"
  // Let's use a regex to remove the entire try-catch block for this.
  
  content = content.replace(/try\s*\{\s*await\s*api\.post\('\/admin\/notifications\/broadcast'.*?catch\s*\{.*?\}/g, '');
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Processed ${file}`);
});
