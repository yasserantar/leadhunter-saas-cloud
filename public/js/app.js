// app.js
const socket = io();

// Check authentication
const token = localStorage.getItem('token');
const userStr = localStorage.getItem('user');

if (!token || !userStr) {
    window.location.href = '/';
} else {
    const user = JSON.parse(userStr);
    
    // Initialize User Dashboard
    document.getElementById('user-name-display').innerText = user.name;
    document.getElementById('user-email-display').innerText = user.email;
    document.getElementById('user-role-badge').innerText = user.role.toUpperCase();
    
    // Style badge for normal user
    if (user.role !== 'admin') {
        const badge = document.getElementById('user-role-badge');
        if (badge) {
            badge.classList.replace('bg-apple-blue/10', 'bg-gray-500/10');
            badge.classList.replace('text-apple-blue', 'text-gray-500');
        }
    }
}

// Socket Events
socket.on('connect', () => {
    console.log('Connected to LeadHunter V3 server as User');
});

socket.on('scrape_progress', (data) => {
    const terminal = document.getElementById('terminal-output');
    if(terminal) {
        terminal.innerHTML += `\n<div class="text-slate-300">> ${data.message}</div>`;
        terminal.scrollTop = terminal.scrollHeight;
    }
});

// Logout
const logoutBtn = document.getElementById('logout-btn');
if(logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
    });
}

// Start Scrape
const startBtn = document.getElementById('start-scrape-btn');
if(startBtn) {
    startBtn.addEventListener('click', async () => {
        const query = document.getElementById('scrape-query').value;
        const source = document.getElementById('scrape-source').value;
        const location = document.getElementById('scrape-location').value;

        if (!query) {
            alert('أدخل كلمة البحث');
            return;
        }

        const terminal = document.getElementById('terminal-output');
        terminal.innerHTML += `\n<div class="text-blue-400">> بدء عملية السحب من ${source}...</div>`;

        try {
            const res = await fetch('/api/search/live-scrape', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ source, query, location })
            });

            const data = await res.json();
            
            if (data.success) {
                terminal.innerHTML += `\n<div class="text-green-400">> ✅ اكتمل! تم العثور على ${data.count} عميل وحفظ ${data.saved} بنجاح.</div>`;
            } else {
                terminal.innerHTML += `\n<div class="text-red-400">> ❌ خطأ: ${data.error}</div>`;
            }
        } catch (err) {
            terminal.innerHTML += `\n<div class="text-red-400">> ❌ فشل الاتصال بالسيرفر</div>`;
        }
    });
}