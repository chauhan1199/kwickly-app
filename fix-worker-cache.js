const fs = require('fs');
const path = './backend/src/modules/worker/worker.controller.js';
let content = fs.readFileSync(path, 'utf8');

// List of exports that modify the user
const methods = [
    'updateKyc',
    'updateBank',
    'updateServices',
    'updateLocation',
    'toggleOnlineStatus',
    'updateFullProfile',
    'addAddress',
    'updateAddress',
    'deleteAddress',
    'setPrimaryAddress'
];

for (const method of methods) {
    const regex = new RegExp(`(exports\\.${method}\\s*=\\s*catchAsync\\(async \\(req, res\\) => \\{[\\s\\S]*?)(return (?:successResponse|errorResponse).*?;\\s*\\}\\);)`, 'g');
    
    content = content.replace(regex, (match, p1, p2) => {
        if (!p1.includes('delCache(`session:${req.user._id}`)') && !p1.includes('delCache(\`session:${req.user._id}\`)')) {
            const cacheLines = `\n    const { delCache } = require('../../helpers/redis.helper');\n    await delCache(\`session:\${req.user._id}\`);\n    `;
            return p1 + cacheLines + p2;
        }
        return match;
    });
}

fs.writeFileSync(path, content, 'utf8');
console.log('Worker controller updated');
