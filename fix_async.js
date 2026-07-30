const fs = require('fs');
const path = require('path');

const dirs = ['server/routes', 'server/controllers', 'server/services'];

function fixFiles(dir) {
    const fullDir = path.join(__dirname, dir);
    if (!fs.existsSync(fullDir)) return;
    
    fs.readdirSync(fullDir).forEach(file => {
        if (!file.endsWith('.js')) return;
        const filePath = path.join(fullDir, file);
        let content = fs.readFileSync(filePath, 'utf-8');
        
        // Match `(req, res) =>` or `(req, res, next) =>` and prefix with `async` if not already
        content = content.replace(/(?<!async\s*)(\(req,\s*res\)\s*=>|\(req,\s*res,\s*next\)\s*=>)/g, 'async $1');
        
        // Also fix `function (req, res)`
        content = content.replace(/(?<!async\s*)(function\s*\(\s*req,\s*res\s*\))/g, 'async $1');

        // Check for specific transactions in leads.js (bulk delete)
        // db.transaction is synchronous in our mock, but we made it run multiple await calls.
        // Wait, our mock database.js didn't implement db.transaction!
        // We should just use a simple for loop for bulk delete.
        if (file === 'leads.js') {
            content = content.replace(
                /const deleteAll = db\.transaction[\s\S]*?deleteAll\(ids\);/g,
                `for (const id of ids) { await del.run(id, req.userId); }`
            );
        }

        fs.writeFileSync(filePath, content);
        console.log('Fixed syntax in ' + filePath);
    });
}

dirs.forEach(fixFiles);

// Fix index.js
let indexContent = fs.readFileSync(path.join(__dirname, 'server/index.js'), 'utf-8');
indexContent = indexContent.replace(/(?<!async\s*)function initServer/, 'async function initServer');
indexContent = indexContent.replace(/app\.listen\(/, 'await initDb();\napp.listen(');
indexContent = indexContent.replace(/await await initDb\(\);/, 'await initDb();');
// Remove the old initDb call
indexContent = indexContent.replace(/initDb\(\);\s*$/m, '');
fs.writeFileSync(path.join(__dirname, 'server/index.js'), indexContent);
console.log('Fixed syntax in server/index.js');
