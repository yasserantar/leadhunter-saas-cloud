const fs = require('fs');
const path = require('path');

const walkSync = (dir, filelist = []) => {
  fs.readdirSync(dir).forEach(file => {
    const dirFile = path.join(dir, file);
    try { filelist = fs.statSync(dirFile).isDirectory() ? walkSync(dirFile, filelist) : filelist.concat(dirFile); }
    catch (err) { if (err.code === 'OENT' || err.code === 'EPERM') console.log("Ignoring", dirFile); }
  });
  return filelist;
};

const files = walkSync(path.join(__dirname, 'server')).filter(f => f.endsWith('.js'));

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // 1. Change all routes to async if they use db
    content = content.replace(/router\.(get|post|put|delete)\(['"]([^'"]+)['"],\s*(req,\s*res)\s*=>/g, "router.$1('$2', async (req, res) =>");
    content = content.replace(/router\.(get|post|put|delete)\(['"]([^'"]+)['"],\s*authMiddleware,\s*(req,\s*res)\s*=>/g, "router.$1('$2', authMiddleware, async (req, res) =>");
    
    // 2. Change db.prepare('query').get(args) to await db.query('query', [args]).then(r => r.rows[0])
    content = content.replace(/db\.prepare\((.*?)\)\.get\((.*?)\)/g, "await db.query($1, [$2]).then(r => r.rows[0])");
    content = content.replace(/db\.prepare\((.*?)\)\.get\(\)/g, "await db.query($1).then(r => r.rows[0])");

    // 3. Change db.prepare('query').all(args) to await db.query('query', [args]).then(r => r.rows)
    content = content.replace(/db\.prepare\((.*?)\)\.all\((.*?)\)/g, "await db.query($1, [$2]).then(r => r.rows)");
    content = content.replace(/db\.prepare\((.*?)\)\.all\(\)/g, "await db.query($1).then(r => r.rows)");

    // 4. Change db.prepare('query').run(args) to await db.query('query', [args])
    content = content.replace(/db\.prepare\((.*?)\)\.run\((.*?)\)/g, "await db.query($1, [$2])");
    content = content.replace(/db\.prepare\((.*?)\)\.run\(\)/g, "await db.query($1)");

    // 5. Replace db.transaction(() => { ... })() with simple block for now (or handle it properly)
    content = content.replace(/db\.transaction\(\(\)\s*=>\s*\{([\s\S]*?)\}\)\(\);/g, "/* TRANSACTION */ $1");

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log('Migrated:', file);
    }
});

console.log('Migration script finished!');
