// ================================================================
// LeadHunter Pro - Admin Dashboard Complete JS
// ================================================================

const socket = io();
const API = '';
let currentPage = 1;
let selectedLeads = new Set();

// ============================================================
// AUTHENTICATION CHECK
// ============================================================
const token = localStorage.getItem('token');
const userStr = localStorage.getItem('user');

if (!token || !userStr) {
    window.location.href = '/';
} else {
    const user = JSON.parse(userStr);
    if (user.role !== 'admin') {
        alert('⚠️ غير مصرح لك بالدخول لهذه الصفحة!');
        window.location.href = '/app.html';
    }
    document.getElementById('user-name-display').innerText = user.name || 'Admin';
    document.getElementById('user-email-display').innerText = user.email || '';
    document.getElementById('user-role-badge').innerText = user.role.toUpperCase();
}

function getHeaders() {
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
}

// ============================================================
// TAB SWITCHING
// ============================================================
const TABS = ['dashboard', 'scraper', 'crm', 'email', 'whatsapp'];

function switchTab(tab) {
    TABS.forEach(t => {
        document.getElementById(`tab-${t}`)?.classList.remove('active');
        document.getElementById(`panel-${t}`)?.classList.add('hidden');
    });
    document.getElementById(`tab-${tab}`)?.classList.add('active');
    document.getElementById(`panel-${tab}`)?.classList.remove('hidden');

    if (tab === 'crm') loadLeads();
    if (tab === 'dashboard') loadStats();
    if (tab === 'whatsapp') checkWAStatus();
}

TABS.forEach(tab => {
    document.getElementById(`tab-${tab}`)?.addEventListener('click', (e) => {
        e.preventDefault();
        switchTab(tab);
    });
});

// ============================================================
// LOGOUT
// ============================================================
document.getElementById('logout-btn')?.addEventListener('click', () => {
    localStorage.clear();
    window.location.href = '/';
});

// ============================================================
// STATS
// ============================================================
async function loadStats() {
    try {
        const res = await fetch(`${API}/api/leads/stats`, { headers: getHeaders() });
        if (res.status === 401) {
            localStorage.clear();
            window.location.href = '/';
            return;
        }
        const data = await res.json();
        if (data.success) {
            const s = data.stats;
            document.getElementById('stat-total').innerText = s.total.toLocaleString();
            document.getElementById('stat-emails').innerText = s.withEmail.toLocaleString();
            document.getElementById('stat-phones').innerText = s.withPhone.toLocaleString();
            document.getElementById('stat-sent').innerText = (s.sentEmail + s.sentWhatsapp).toLocaleString();
            document.getElementById('leads-count-badge').innerText = s.total;
        }
    } catch (err) { console.log('Stats error:', err); }
}

loadStats();

// ============================================================
// SCRAPER
// ============================================================
const limitSlider = document.getElementById('scrape-limit');
const limitDisplay = document.getElementById('scrape-limit-display');
limitSlider?.addEventListener('input', () => {
    limitDisplay.innerText = limitSlider.value;
});

document.getElementById('start-scrape-btn')?.addEventListener('click', async () => {
    const query = document.getElementById('scrape-query').value.trim();
    const source = document.getElementById('scrape-source').value;
    const location = document.getElementById('scrape-location').value.trim();
    const limit = parseInt(document.getElementById('scrape-limit').value);
    const extractEmails = document.getElementById('extract-emails-toggle').checked;

    if (!query) { alert('أدخل كلمة البحث!'); return; }

    const terminal = document.getElementById('terminal-output');
    const progressCard = document.getElementById('scrape-progress-card');
    const nextStep = document.getElementById('next-step-container');
    
    terminal.innerHTML = `
        <div class="text-yellow-400">> بدء البحث عن "${query}" في "${location || 'الخليج'}" - الهدف: ${limit} عميل</div>
        <div class="text-blue-400 mt-1">> المصدر: ${source} | استخراج إيميلات: ${extractEmails ? 'نعم' : 'لا'}</div>
    `;
    progressCard.classList.remove('hidden');
    nextStep?.classList.add('hidden'); // إخفاء زر الخطوة التالية عند بدء بحث جديد
    document.getElementById('progress-fill').style.width = '2%';
    document.getElementById('progress-percent').innerText = '2%';
    document.getElementById('progress-stage').innerText = 'جاري فتح المتصفح وتهيئة المحرك...';
    document.getElementById('progress-count').innerText = `0/${limit}`;

    const btn = document.getElementById('start-scrape-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري السحب...';

    try {
        const res = await fetch(`${API}/api/search/live-scrape`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ source, query, location, limit })
        });

        const data = await res.json();
        
        if (data.success) {
            terminal.innerHTML += `
                <div class="text-green-400 mt-2 font-bold">
                    ✅ اكتمل! ${data.count} عميل | ${data.saved} تم حفظه | ${data.emails || 0} إيميل | ${data.phones || 0} رقم/واتساب
                </div>
            `;
            document.getElementById('progress-fill').style.width = '100%';
            document.getElementById('progress-percent').innerText = '100%';
            document.getElementById('progress-stage').innerText = 'اكتمل حفظ البيانات بنجاح!';
            nextStep?.classList.remove('hidden'); // إظهار زر الانتقال للخطوة التالية
            loadStats();
        } else {
            terminal.innerHTML += `<div class="text-red-400 mt-2">❌ خطأ: ${data.error}</div>`;
        }
    } catch (err) {
        terminal.innerHTML += `<div class="text-red-400 mt-2">❌ فشل الاتصال: ${err.message}</div>`;
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-rocket"></i> ابدأ السحب';
    }
});

// ============================================================
// REAL-TIME PROGRESS VIA SOCKET.IO
// ============================================================
socket.on('scrape_progress', (data) => {
    const terminal = document.getElementById('terminal-output');
    const stageEl = document.getElementById('progress-stage');
    const fillEl = document.getElementById('progress-fill');
    const percentEl = document.getElementById('progress-percent');
    const countEl = document.getElementById('progress-count');
    const targetLimit = parseInt(document.getElementById('scrape-limit').value) || 100;
    
    if (terminal) {
        const color = data.stage === 'done' ? 'text-green-400' : 
                      data.stage === 'enriching' ? 'text-blue-400' : 'text-yellow-300';
        terminal.innerHTML += `<div class="${color} mt-1">> ${data.message}</div>`;
        terminal.scrollTop = terminal.scrollHeight;
    }

    // حساب النسبة المئوية الذكية لكامل العملية
    let pct = 0;
    if (data.stage === 'scrolling') {
        // التمرير وجمع الأماكن يأخذ من 0% إلى 50%
        pct = Math.round(((data.count || 0) / targetLimit) * 50);
        pct = Math.min(pct, 50);
        if (stageEl) stageEl.innerText = `🔍 جاري تمرير خريطة جوجل واستخراج بيانات أولية...`;
    } else if (data.stage === 'enriching') {
        // استخراج الإيميلات والشبكات يأخذ من 50% إلى 95%
        const enrichPct = data.total ? Math.round(((data.count || 0) / data.total) * 45) : 0;
        pct = 50 + enrichPct;
        if (stageEl) stageEl.innerText = `📧 جاري استخراج الإيميلات وحسابات السوشيال ميديا...`;
    } else if (data.stage === 'extracting') {
        // الاستخراج والحفظ النهائي يأخذ من 95% إلى 99%
        pct = 95;
        if (stageEl) stageEl.innerText = `💾 جاري تنظيم البيانات وحفظها في النظام...`;
    } else if (data.stage === 'done') {
        pct = 100;
        if (stageEl) stageEl.innerText = `✅ اكتمل السحب وحفظ البيانات بنجاح!`;
        document.getElementById('next-step-container')?.classList.remove('hidden');
    }

    if (pct > 0) {
        if (fillEl) fillEl.style.width = `${pct}%`;
        if (percentEl) percentEl.innerText = `${pct}%`;
    }

    if (countEl) {
        if (data.count && data.total) {
            countEl.innerText = `${data.count}/${data.total}`;
        } else if (data.count) {
            countEl.innerText = `${data.count}/${targetLimit}`;
        }
    }
});

socket.on('campaign_progress', (data) => {
    const el = document.getElementById('campaign-status');
    const bar = document.getElementById('campaign-progress-bar');
    const fill = document.getElementById('campaign-progress-fill');

    if (el) {
        const pct = data.total ? Math.round((data.sent / data.total) * 100) : 0;
        el.innerHTML = `
            <div class="text-sm text-apple-text mb-1">${data.message}</div>
            <div class="text-xs text-apple-subtext">أُرسل: ${data.sent} | فشل: ${data.failed} | الكل: ${data.total}</div>
        `;
        if (bar && fill) {
            bar.classList.remove('hidden');
            fill.style.width = `${pct}%`;
        }
        if (data.status === 'completed') loadStats();
    }

    // Also update WA progress
    const waEl = document.getElementById('wa-campaign-status');
    if (waEl && data.message?.includes('واتساب')) {
        waEl.innerHTML = `<div class="text-sm text-apple-text">${data.message}</div>`;
    }
});

// ============================================================
// CRM - LOAD LEADS
// ============================================================
async function loadLeads(page = 1) {
    currentPage = page;
    const search = document.getElementById('crm-search')?.value || '';
    const status = document.getElementById('crm-status-filter')?.value || '';
    
    try {
        const params = new URLSearchParams({ page, limit: 50, search, status });
        const res = await fetch(`${API}/api/leads?${params}`, { headers: getHeaders() });
        const data = await res.json();
        
        if (data.success) {
            renderLeadsTable(data.data);
            renderPagination(data.pagination);
        }
    } catch (err) {
        console.error('Load leads error:', err);
    }
}

function renderLeadsTable(leads) {
    const tbody = document.getElementById('leads-table-body');
    
    if (!leads.length) {
        tbody.innerHTML = `
            <tr><td colspan="10" class="text-center py-16 text-apple-subtext">
                <i class="fa-solid fa-users text-4xl mb-3 block opacity-20"></i>
                لا يوجد عملاء. اضغط على "محرك السحب" للبدء!
            </td></tr>`;
        return;
    }

    tbody.innerHTML = leads.map((lead, idx) => `
        <tr class="lead-row border-b border-gray-50 hover:bg-blue-50/30 transition-colors" data-id="${lead.id}">
            <td class="px-4 py-3">
                <input type="checkbox" class="lead-checkbox accent-blue-600 w-4 h-4" data-id="${lead.id}">
            </td>
            <td class="px-4 py-3 text-apple-subtext text-xs">${(currentPage-1)*50 + idx + 1}</td>
            <td class="px-4 py-3">
                <div class="font-semibold text-apple-text text-sm">${escHtml(lead.name || '-')}</div>
                ${lead.category ? `<div class="text-xs text-apple-subtext">${escHtml(lead.category)}</div>` : ''}
            </td>
            <td class="px-4 py-3">
                ${lead.email ? `
                    <a href="mailto:${escHtml(lead.email)}" class="text-blue-600 text-xs hover:underline flex items-center gap-1">
                        <i class="fa-solid fa-envelope text-[10px]"></i> ${escHtml(lead.email)}
                    </a>` : '<span class="text-gray-300 text-xs">—</span>'}
            </td>
            <td class="px-4 py-3">
                ${lead.phone ? `
                    <a href="tel:${escHtml(lead.phone)}" class="text-green-600 text-xs hover:underline flex items-center gap-1">
                        <i class="fa-solid fa-phone text-[10px]"></i> ${escHtml(lead.phone)}
                    </a>` : '<span class="text-gray-300 text-xs">—</span>'}
            </td>
            <td class="px-4 py-3 max-w-[150px]">
                <span class="text-xs text-apple-subtext truncate block">${escHtml(lead.address || '—')}</span>
            </td>
            <td class="px-4 py-3">
                <div class="flex gap-2">
                    ${lead.facebook ? `<a href="${lead.facebook}" target="_blank" class="text-blue-600 text-sm hover:opacity-70"><i class="fa-brands fa-facebook"></i></a>` : ''}
                    ${lead.instagram ? `<a href="${lead.instagram}" target="_blank" class="text-pink-500 text-sm hover:opacity-70"><i class="fa-brands fa-instagram"></i></a>` : ''}
                    ${lead.twitter ? `<a href="${lead.twitter}" target="_blank" class="text-sky-500 text-sm hover:opacity-70"><i class="fa-brands fa-x-twitter"></i></a>` : ''}
                    ${lead.linkedin ? `<a href="${lead.linkedin}" target="_blank" class="text-blue-700 text-sm hover:opacity-70"><i class="fa-brands fa-linkedin"></i></a>` : ''}
                    ${lead.tiktok ? `<a href="${lead.tiktok}" target="_blank" class="text-gray-800 text-sm hover:opacity-70"><i class="fa-brands fa-tiktok"></i></a>` : ''}
                    ${!lead.facebook && !lead.instagram && !lead.twitter && !lead.linkedin && !lead.tiktok ? '<span class="text-gray-300 text-xs">—</span>' : ''}
                </div>
            </td>
            <td class="px-4 py-3">
                <span class="text-xs text-apple-subtext">${escHtml(lead.source || '—')}</span>
            </td>
            <td class="px-4 py-3">
                <span class="badge badge-${lead.status || 'new'}">
                    ${lead.status === 'emailed' ? '📧 مُرسَل إيميل' : lead.status === 'whatsapped' ? '💬 واتساب' : '🆕 جديد'}
                </span>
            </td>
            <td class="px-4 py-3">
                <div class="flex gap-1.5">
                    ${lead.email ? `
                        <button onclick="sendEmailTo('${lead.id}','${escHtml(lead.email)}')" title="إرسال إيميل" class="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center justify-center text-xs transition-all">
                            <i class="fa-solid fa-envelope"></i>
                        </button>` : ''}
                    ${lead.phone ? `
                        <button onclick="sendWATo('${lead.id}')" title="إرسال واتساب" class="w-7 h-7 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 flex items-center justify-center text-xs transition-all">
                            <i class="fa-brands fa-whatsapp"></i>
                        </button>` : ''}
                    <button onclick="deleteLead('${lead.id}')" title="حذف" class="w-7 h-7 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center text-xs transition-all">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');

    // Checkboxes
    document.querySelectorAll('.lead-checkbox').forEach(cb => {
        cb.addEventListener('change', () => {
            if (cb.checked) selectedLeads.add(cb.dataset.id);
            else selectedLeads.delete(cb.dataset.id);
            updateBulkActions();
        });
    });
}

function renderPagination(pagination) {
    const pag = document.getElementById('pagination');
    const info = document.getElementById('pagination-info');
    const btns = document.getElementById('pagination-btns');

    if (!pagination || pagination.pages <= 1) { pag.classList.add('hidden'); return; }
    
    pag.classList.remove('hidden');
    info.innerText = `عرض ${Math.min(pagination.limit, pagination.total)} من ${pagination.total} عميل`;
    
    btns.innerHTML = '';
    for (let i = 1; i <= pagination.pages; i++) {
        const btn = document.createElement('button');
        btn.innerText = i;
        btn.className = `px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${i === currentPage ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`;
        btn.onclick = () => loadLeads(i);
        btns.appendChild(btn);
    }
}

// Select All
document.getElementById('select-all')?.addEventListener('change', (e) => {
    document.querySelectorAll('.lead-checkbox').forEach(cb => {
        cb.checked = e.target.checked;
        if (e.target.checked) selectedLeads.add(cb.dataset.id);
        else selectedLeads.delete(cb.dataset.id);
    });
    updateBulkActions();
});

function updateBulkActions() {
    const bulkBar = document.getElementById('bulk-actions');
    const countEl = document.getElementById('selected-count');
    if (selectedLeads.size > 0) {
        bulkBar.classList.remove('hidden');
        countEl.innerText = `${selectedLeads.size} محدد`;
    } else {
        bulkBar.classList.add('hidden');
    }
}

// Live search
document.getElementById('crm-search')?.addEventListener('input', debounce(() => loadLeads(1), 400));
document.getElementById('crm-status-filter')?.addEventListener('change', () => loadLeads(1));

// ============================================================
// CRM ACTIONS
// ============================================================
async function deleteLead(id) {
    if (!confirm('هل تريد حذف هذا العميل؟')) return;
    try {
        await fetch(`${API}/api/leads/${id}`, { method: 'DELETE', headers: getHeaders() });
        loadLeads(currentPage);
        loadStats();
    } catch (err) { alert('خطأ في الحذف'); }
}

async function bulkDelete() {
    if (!selectedLeads.size || !confirm(`هل تريد حذف ${selectedLeads.size} عميل؟`)) return;
    try {
        await fetch(`${API}/api/leads/delete-bulk`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ ids: [...selectedLeads] })
        });
        selectedLeads.clear();
        loadLeads(currentPage);
        loadStats();
    } catch (err) { alert('خطأ في الحذف الجماعي'); }
}

function sendEmailTo(id, email) {
    switchTab('email');
    document.getElementById('email-subject').focus();
}

function sendWATo(id) {
    switchTab('whatsapp');
}

// ============================================================
// EMAIL CAMPAIGNS
// ============================================================
document.getElementById('send-email-btn')?.addEventListener('click', () => {
    sendEmailCampaign(false);
});

async function sendEmailCampaign(fromModal = false) {
    const subject = fromModal ? document.getElementById('modal-email-subject').value : document.getElementById('email-subject').value;
    const body = fromModal ? document.getElementById('modal-email-body').value : document.getElementById('email-body').value;
    
    if (!subject || !body) { alert('الموضوع ونص الرسالة مطلوبان'); return; }

    const target = document.querySelector('input[name="email-target"]:checked')?.value || 'all';
    const lead_ids = target === 'selected' ? [...selectedLeads] : null;
    const send_to_all = target !== 'selected';

    try {
        const res = await fetch(`${API}/api/campaigns/send-email`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ subject, body, lead_ids, send_to_all })
        });
        const data = await res.json();
        if (data.success) {
            if (fromModal) closeModal('email-modal');
            document.getElementById('campaign-status').innerHTML = `
                <div class="text-sm text-blue-600 font-medium">${data.message}</div>`;
            document.getElementById('campaign-progress-bar').classList.remove('hidden');
        } else {
            alert('⚠️ ' + data.error);
        }
    } catch (err) {
        alert('خطأ: ' + err.message);
    }
}

function openEmailModal() {
    document.getElementById('email-modal').classList.remove('hidden');
}
function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
}

// ============================================================
// WHATSAPP
// ============================================================
async function checkWAStatus() {
    try {
        const res = await fetch(`${API}/api/whatsapp/status`, { headers: getHeaders() });
        const data = await res.json();
        updateWAUI(data.status, data.qrDataURL);
    } catch (err) { console.log('WA status error:', err); }
}

function updateWAUI(status, qrDataURL) {
    const states = ['wa-disconnected', 'wa-connecting-state', 'wa-qr-state', 'wa-connected-state'];
    states.forEach(s => document.getElementById(s)?.classList.add('hidden'));

    const dot = document.getElementById('wa-status-dot');

    if (status === 'connected') {
        document.getElementById('wa-connected-state')?.classList.remove('hidden');
        if (dot) { dot.className = 'mr-auto w-2 h-2 rounded-full bg-green-400'; }
    } else if (status === 'qr_ready' && qrDataURL) {
        document.getElementById('wa-qr-state')?.classList.remove('hidden');
        document.getElementById('wa-qr-img').src = qrDataURL;
        if (dot) { dot.className = 'mr-auto w-2 h-2 rounded-full bg-yellow-400'; }
    } else if (status === 'connecting') {
        document.getElementById('wa-connecting-state')?.classList.remove('hidden');
        if (dot) { dot.className = 'mr-auto w-2 h-2 rounded-full bg-yellow-400 wa-connecting'; }
    } else {
        document.getElementById('wa-disconnected')?.classList.remove('hidden');
        if (dot) { dot.className = 'mr-auto w-2 h-2 rounded-full bg-red-400'; }
    }
}

document.getElementById('wa-connect-btn')?.addEventListener('click', async () => {
    document.getElementById('wa-disconnected').classList.add('hidden');
    document.getElementById('wa-connecting-state').classList.remove('hidden');
    
    await fetch(`${API}/api/whatsapp/connect`, { method: 'POST', headers: getHeaders() });
});

document.getElementById('wa-disconnect-btn')?.addEventListener('click', async () => {
    await fetch(`${API}/api/whatsapp/disconnect`, { method: 'POST', headers: getHeaders() });
    updateWAUI('disconnected');
});

// Socket events for WhatsApp
socket.on('whatsapp_qr', (data) => {
    updateWAUI('qr_ready', data.qr);
});
socket.on('whatsapp_status', (data) => {
    updateWAUI(data.status);
    if (data.status === 'connected') {
        alert('✅ واتساب اتصل بنجاح! يمكنك الآن إرسال الرسائل.');
    }
});

// Send WhatsApp Campaign
document.getElementById('send-wa-btn')?.addEventListener('click', async () => {
    const message = document.getElementById('wa-message').value.trim();
    if (!message) { alert('اكتب نص الرسالة أولاً'); return; }

    const target = document.querySelector('input[name="wa-target"]:checked')?.value || 'all';

    try {
        const res = await fetch(`${API}/api/campaigns/send-whatsapp`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ message, send_to_all: true, target })
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('wa-campaign-status').innerHTML = `<div class="text-sm text-green-600 font-medium">${data.message}</div>`;
        } else if (data.needsQR) {
            alert('⚠️ واتساب غير متصل! امسح QR Code أولاً من الجزء الأيسر.');
        } else {
            alert('⚠️ ' + data.error);
        }
    } catch (err) {
        alert('خطأ: ' + err.message);
    }
});

// Bulk actions
function bulkEmail() {
    if (!selectedLeads.size) return;
    switchTab('email');
    document.querySelector('input[name="email-target"][value="selected"]').checked = true;
}

function bulkWhatsapp() {
    if (!selectedLeads.size) return;
    switchTab('whatsapp');
}

// ============================================================
// EXPORT EXCEL
// ============================================================
async function exportExcel() {
    try {
        const res = await fetch(`${API}/api/leads?limit=9999`, { headers: getHeaders() });
        const data = await res.json();
        if (!data.success) return;

        const leads = data.data;
        const headers = [
            'الاسم / اسم الشركة', 
            'رقم الهاتف الأساسي', 
            'رقم الواتساب (إن وُجد)', 
            'البريد الإلكتروني', 
            'الموقع الإلكتروني', 
            'العنوان / الموقع على الخريطة', 
            'روابط السوشيال ميديا (لينكد إن، انستجرام، فيسبوك)', 
            'التقييم (لجوجل ماب)', 
            'حالة الإرسال (تم إرسال إيميل / تم إرسال واتساب)'
        ];

        const rows = leads.map(l => [
            l.name || l.company || '',
            l.phone || '',
            l.whatsapp || '',
            l.email || '',
            l.website || '',
            l.address || '',
            [l.linkedin, l.instagram, l.facebook].filter(Boolean).join(' | '),
            '', // We don't have rating in the current schema unless added
            l.status === 'emailed' ? 'تم إرسال إيميل' : (l.status === 'whatsapped' ? 'تم إرسال واتساب' : 'جديد')
        ]);

        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        
        // Add RTL and column widths
        worksheet['!dir'] = 'rtl';
        worksheet['!cols'] = [
            { wch: 30 }, // Name
            { wch: 20 }, // Phone
            { wch: 20 }, // WA
            { wch: 30 }, // Email
            { wch: 30 }, // Web
            { wch: 40 }, // Address
            { wch: 40 }, // Social
            { wch: 15 }, // Rating
            { wch: 20 }  // Status
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "العملاء");

        XLSX.writeFile(workbook, `leads_${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch (err) {
        alert('خطأ في التصدير: ' + err.message);
    }
}

// ============================================================
// UTILITIES
// ============================================================
function escHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function debounce(fn, ms) {
    let timer;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), ms);
    };
}

// Close modal on backdrop click
document.getElementById('email-modal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal('email-modal');
});

// Load initial data
loadStats();