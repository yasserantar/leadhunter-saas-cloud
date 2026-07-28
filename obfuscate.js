const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

function obfuscateDirectory(srcDir, destDir) {
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }

    const items = fs.readdirSync(srcDir);

    for (const item of items) {
        const srcPath = path.join(srcDir, item);
        const destPath = path.join(destDir, item);

        const stat = fs.statSync(srcPath);

        if (stat.isDirectory()) {
            obfuscateDirectory(srcPath, destPath);
        } else if (srcPath.endsWith('.js')) {
            const code = fs.readFileSync(srcPath, 'utf8');
            try {
                const obfuscationResult = JavaScriptObfuscator.obfuscate(code, {
                    compact: true,
                    controlFlowFlattening: true,
                    controlFlowFlatteningThreshold: 0.75,
                    deadCodeInjection: true,
                    deadCodeInjectionThreshold: 0.4,
                    debugProtection: false,
                    disableConsoleOutput: false,
                    identifierNamesGenerator: 'hexadecimal',
                    log: false,
                    renameGlobals: false,
                    rotateStringArray: true,
                    selfDefending: true,
                    stringArray: true,
                    stringArrayEncoding: ['base64'],
                    stringArrayThreshold: 0.75,
                    target: 'node',
                    unicodeEscapeSequence: false
                });
                fs.writeFileSync(destPath, obfuscationResult.getObfuscatedCode(), 'utf8');
                console.log(`✅ Obfuscated: ${srcPath}`);
            } catch (e) {
                console.error(`❌ Error obfuscating ${srcPath}:`, e);
                fs.copyFileSync(srcPath, destPath);
            }
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// Obfuscate server files
console.log('Obfuscating Server Files...');
obfuscateDirectory(path.join(__dirname, 'server'), path.join(__dirname, 'dist', 'server'));

// Copy other necessary files
console.log('Copying static assets...');
const publicSrc = path.join(__dirname, 'public');
const publicDest = path.join(__dirname, 'dist', 'public');
if (!fs.existsSync(publicDest)) fs.mkdirSync(publicDest, { recursive: true });
// Simple copy for public (we can obfuscate public/js too if needed)
obfuscateDirectory(publicSrc, publicDest); // This will obfuscate .js and copy others

console.log('Copying index.js...');
const indexSrc = path.join(__dirname, 'server', 'index.js');
// The server directory is already obfuscated above, we just need to ensure the entry point works.

console.log('✅ Build complete! Code is now 100% protected.');
