const puppeteer = require('puppeteer-core');
const fs = require('fs');
const { spawn } = require('child_process');

async function takeScreenshot() {
    console.log('Starting server...');
    const server = spawn('node', ['server/index.js'], { detached: true });
    
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('Server started, launching browser...');

    try {
        const browser = await puppeteer.launch({
            executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
            headless: 'new',
            defaultViewport: { width: 1280, height: 800 }
        });

        const page = await browser.newPage();
        console.log('Navigating to http://localhost:3000');
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
        
        // Wait an extra second for any animations
        await new Promise(resolve => setTimeout(resolve, 1000));

        const outputPath = 'C:\\Users\\y.antar\\.gemini\\antigravity\\brain\\02627c77-a8a1-4f8c-b115-af82ec1b7695\\screenshot.png';
        await page.screenshot({ path: outputPath, fullPage: true });
        console.log('Screenshot saved to', outputPath);

        await browser.close();
    } catch (err) {
        console.error('Error during screenshot:', err);
    } finally {
        console.log('Killing server...');
        try {
            process.kill(-server.pid);
        } catch(e) {}
    }
}

takeScreenshot();
