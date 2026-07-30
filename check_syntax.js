const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function checkDir(dir) {
    const fullDir = path.join(__dirname, dir);
    if (!fs.existsSync(fullDir)) return;
    
    fs.readdirSync(fullDir).forEach(file => {
        if (!file.endsWith('.js')) return;
        const filePath = path.join(fullDir, file);
        try {
            execSync(`node -c "${filePath}"`, { stdio: 'pipe' });
            console.log(`✅ ${file} OK`);
        } catch (e) {
            console.error(`❌ ERROR IN ${file}:\n` + e.stderr.toString());
        }
    });
}

checkDir('server/controllers');
checkDir('server/routes');
checkDir('server/services');
checkDir('server');
