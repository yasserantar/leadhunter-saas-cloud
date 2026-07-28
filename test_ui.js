const puppeteer = require('puppeteer-core');
const { spawn } = require('child_process');

async function testFrontend() {
    console.log('Starting local server for testing...');
    const server = spawn('node', ['server/index.js']);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('Server started. Launching Edge...');
    
    try {
        const browser = await puppeteer.launch({
            executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
            headless: 'new'
        });
        
        const page = await browser.newPage();
        
        // Capture browser console logs
        page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type().toUpperCase(), msg.text()));
        page.on('pageerror', err => console.log('BROWSER ERROR:', err.toString()));
        page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure().errorText));

        console.log('Navigating to http://localhost:3000');
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
        
        console.log('Navigation complete. Waiting 2 seconds...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        await browser.close();
    } catch (e) {
        console.error('Test error:', e);
    } finally {
        console.log('Killing server...');
        server.kill();
        process.exit(0);
    }
}

testFrontend();
