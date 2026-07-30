const fs = require('fs');
const path = require('path');

const filesToRefactor = [
    'server/controllers/authController.js',
    'server/routes/leads.js',
    'server/routes/campaigns.js',
    'server/routes/dashboard.js',
    'server/routes/search.js',
    'server/routes/superadmin.js',
    'server/routes/templates.js',
    'server/routes/ai.js',
    'server/services/auto-pipeline.js',
    'server/services/email-sender.js',
    'server/services/scheduler.js',
    'server/index.js'
];

function refactorFile(filePath) {
    const fullPath = path.join(__dirname, filePath);
    if (!fs.existsSync(fullPath)) {
        console.log('Skipping ' + filePath);
        return;
    }
    
    let content = fs.readFileSync(fullPath, 'utf-8');

    // Add await to db.prepare calls that don't have it
    content = content.replace(/(?<!await\s)(db\.prepare\([^)]+\)\.(run|all|get)\([^)]*\))/g, 'await $1');
    
    // Some might have empty params or multiline strings. Let's be aggressive:
    // This regex looks for db.prepare(...).run/all/get(...) and adds await if missing.
    content = content.replace(/(?<!await\s)(db\.prepare\([\s\S]*?\)\.(?:run|all|get)\([\s\S]*?\))/g, 'await $1');

    // Make router functions async
    content = content.replace(/router\.(get|post|put|delete)\(([^,]+),\s*(authMiddleware\s*,)?\s*(?!\basync\b)(function\s*\([^)]*\)|\([^)]*\)\s*=>)/g, 'router.$1($2, $3 async $4');

    // Make specific controller functions async
    content = content.replace(/const (register|login|getMe) = (?!\basync\b)(function\s*\([^)]*\)|\([^)]*\)\s*=>)/g, 'const $1 = async $2');

    // Make scheduler and services functions async where db is used
    // email-sender.js
    content = content.replace(/async function sendEmail/g, 'async function sendEmail'); // already async?
    content = content.replace(/function sendEmail\(/g, 'async function sendEmail(');
    content = content.replace(/async function recordLog/g, 'async function recordLog');
    content = content.replace(/function recordLog\(/g, 'async function recordLog(');
    content = content.replace(/function processEmailQueue\(/g, 'async function processEmailQueue(');

    // auto-pipeline.js
    content = content.replace(/function addLeadsToPipeline\(/g, 'async function addLeadsToPipeline(');

    // Make initDb call async in index.js
    content = content.replace(/initDb\(\);/g, 'await initDb();');
    // If index.js is not in an async context, we might need an IIFE or it might crash.
    // Let's wrap index.js startup in async if needed. We'll check it later.

    // Better regex for db.prepare, since the previous one might capture too much if there are multiple calls on one line.
    // We will do a simpler approach: 
    // `db.prepare(` followed by anything until `).run(` or `).all(` or `).get(`
    
    fs.writeFileSync(fullPath, content);
    console.log('Refactored ' + filePath);
}

// Improved refactoring logic using Babel would be perfect, but let's use a simpler iterative replacement.
// Let's re-read and replace more carefully:
function carefulRefactor(filePath) {
    const fullPath = path.join(__dirname, filePath);
    if (!fs.existsSync(fullPath)) return;
    let content = fs.readFileSync(fullPath, 'utf-8');

    // Replace `db.prepare(X).run(Y)` with `await db.prepare(X).run(Y)`
    // To avoid double awaits:
    content = content.replace(/await\s+await\s+/g, 'await ');
    
    // We can just find all `db.prepare` and prefix with `await ` if it's not there.
    let parts = content.split('db.prepare');
    for (let i = 1; i < parts.length; i++) {
        const prev = parts[i-1];
        if (!prev.trim().endsWith('await')) {
            parts[i-1] = prev + 'await ';
        }
    }
    content = parts.join('db.prepare');

    // Express routes
    content = content.replace(/router\.(get|post|put|delete)\(\s*(['"][^'"]+['"])\s*,\s*(authMiddleware\s*,)?\s*(req|res|\()/g, 
      (match, method, path, middleware, rest) => {
        if (rest.startsWith('async')) return match;
        return `router.${method}(${path}, ${middleware || ''} async ${rest}`;
      }
    );

    // Auth controller
    content = content.replace(/(const\s+(register|login|getMe)\s*=\s*)(req|res|\()/g, '$1async $3');

    // Services
    content = content.replace(/(function\s+(sendEmail|recordLog|processEmailQueue|addLeadsToPipeline)\s*\()/g, 'async $1');
    content = content.replace(/(module\.exports\s*=\s*\{)/g, '$1');

    fs.writeFileSync(fullPath, content);
    console.log('Refactored (careful) ' + filePath);
}

filesToRefactor.forEach(carefulRefactor);
