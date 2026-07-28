// ================================================================
// WhatsApp Client - ربط الواتساب عبر QR Code
// ================================================================
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');

let client = null;
let qrDataURL = null;
let status = 'disconnected'; // disconnected | connecting | qr_ready | connected

function initWhatsApp() {
  if (client) return; // Already initialized

  console.log('[WhatsApp] Initializing client...');
  status = 'connecting';

  client = new Client({
    authStrategy: new LocalAuth({ dataPath: './data/whatsapp-session' }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    }
  });

  client.on('qr', async (qr) => {
    console.log('[WhatsApp] QR Code generated');
    status = 'qr_ready';
    qrDataURL = await qrcode.toDataURL(qr);
    
    if (global.io) {
      global.io.emit('whatsapp_qr', { qr: qrDataURL });
    }
  });

  client.on('ready', () => {
    console.log('[WhatsApp] ✅ Client is ready!');
    status = 'connected';
    qrDataURL = null;
    global.whatsappReady = true;
    global.whatsappClient = client;

    if (global.io) {
      global.io.emit('whatsapp_status', { status: 'connected', message: 'واتساب متصل بنجاح! ✅' });
    }
  });

  client.on('disconnected', (reason) => {
    console.log('[WhatsApp] Disconnected:', reason);
    status = 'disconnected';
    global.whatsappReady = false;
    global.whatsappClient = null;
    client = null;
    qrDataURL = null;

    if (global.io) {
      global.io.emit('whatsapp_status', { status: 'disconnected', message: 'انقطع الاتصال بالواتساب' });
    }
  });

  client.on('message', async (msg) => {
    try {
      console.log(`[WhatsApp] Received message from ${msg.from}: ${msg.body}`);
      const aiService = require('./ai-service');
      const productDetails = process.env.PRODUCT_DETAILS || 'خدمة عملاء نظام LeadHunter Pro. نقدم حلول أتمتة تسويق متكاملة.';
      const reply = await aiService.generateAutoReply(msg.body, productDetails, '');
      if (reply) {
        await msg.reply(reply);
        console.log(`[WhatsApp] AI replied: ${reply}`);
      }
    } catch (err) {
      console.error('[WhatsApp] AI Reply Error:', err);
    }
  });

  client.on('auth_failure', () => {
    console.log('[WhatsApp] Auth failed');
    status = 'disconnected';
    client = null;
    global.whatsappReady = false;
  });

  client.initialize();
}

function getStatus() {
  return { status, qrDataURL, isReady: status === 'connected' };
}

function disconnectWhatsApp() {
  if (client) {
    client.destroy();
    client = null;
    status = 'disconnected';
    qrDataURL = null;
    global.whatsappReady = false;
    global.whatsappClient = null;
  }
}

module.exports = { initWhatsApp, getStatus, disconnectWhatsApp };
