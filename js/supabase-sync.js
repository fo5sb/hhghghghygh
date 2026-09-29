/**
 * Date Receipt Invoice Management System - Supabase Cloud Sync Module
 * وحدة المزامنة السحابية مع سوبابيز (Supabase) للربط بين الأجهزة
 */

class SupabaseSync {
    constructor() {
        this.url = '';
        this.key = '';
        this.isEnabled = false;
        this.DEFAULT_URL = 'https://zsyrprwvbqgsonemfmna.supabase.co';
        this.DEFAULT_KEY = 'sb_publishable_s4HZO2v-knmDuPySfROqAA_qA6nItHE';
    }

    async init() {
        this.url = await window.db.getSetting('supabase_url', this.DEFAULT_URL);
        this.key = await window.db.getSetting('supabase_key', this.DEFAULT_KEY);

        // Pre-fill input fields if empty
        const urlInput = document.getElementById('supabaseUrl');
        const keyInput = document.getElementById('supabaseKey');
        if (urlInput) urlInput.value = this.url;
        if (keyInput) keyInput.value = this.key;

        // Persist defaults if not present
        if (!await window.db.getSetting('supabase_url', null)) {
            await window.db.saveSetting('supabase_url', this.DEFAULT_URL);
            await window.db.saveSetting('supabase_key', this.DEFAULT_KEY);
        }

        this.isEnabled = !!(this.url && this.key);

        this.bindEvents();
        this.updateStatusBadge();

        // Auto sync silently if connected to internet
        if (this.isEnabled && navigator.onLine) {
            setTimeout(() => {
                this.syncAll(true);
            }, 1200);
        }
    }

    bindEvents() {
        const btnSaveConfig = document.getElementById('btnSaveSupabaseConfig');
        if (btnSaveConfig) {
            btnSaveConfig.addEventListener('click', () => this.saveConfig());
        }

        const btnTest = document.getElementById('btnTestSupabase');
        if (btnTest) {
            btnTest.addEventListener('click', () => this.testConnection());
        }

        const btnSyncNow = document.getElementById('btnSyncSupabaseNow');
        if (btnSyncNow) {
            btnSyncNow.addEventListener('click', () => this.syncAll());
        }

        const btnCopySql = document.getElementById('btnCopySupabaseSQL');
        if (btnCopySql) {
            btnCopySql.addEventListener('click', () => this.copySQLSchema());
        }
    }

    async saveConfig() {
        const urlInput = document.getElementById('supabaseUrl');
        const keyInput = document.getElementById('supabaseKey');
        
        const url = urlInput ? urlInput.value.trim() : '';
        const key = keyInput ? keyInput.value.trim() : '';

        await window.db.saveSetting('supabase_url', url);
        await window.db.saveSetting('supabase_key', key);

        this.url = url;
        this.key = key;
        this.isEnabled = !!(url && key);

        this.updateStatusBadge();
        window.app.showToast('تم حفظ إعدادات الربط مع Supabase بنجاح', 'success');
    }

    updateStatusBadge() {
        const badge = document.getElementById('supabaseStatusBadge');
        if (!badge) return;

        if (this.isEnabled) {
            badge.className = 'status-pill badge-success';
            badge.innerText = '● متصل سحابياً (Supabase مفعل)';
        } else {
            badge.className = 'status-pill badge-secondary';
            badge.innerText = '○ قاعدة بيانات محلية (IndexedDB دائم)';
        }
    }

    async testConnection() {
        const url = document.getElementById('supabaseUrl')?.value.trim() || this.url;
        const key = document.getElementById('supabaseKey')?.value.trim() || this.key;

        if (!url || !key) {
            window.app.showToast('يرجى إدخال الرابط (URL) ومفتاح الوصول (Anon Key) أولاً', 'warning');
            return;
        }

        const testEndpoint = `${url.replace(/\/+$/, '')}/rest/v1/invoices?select=count&limit=1`;
        try {
            const resp = await fetch(testEndpoint, {
                method: 'GET',
                headers: {
                    'apikey': key,
                    'Authorization': `Bearer ${key}`
                }
            });

            if (resp.ok) {
                window.app.showToast('✓ تم الاتصال بـ Supabase بنجاح وجدول الفواتير جاهز!', 'success');
            } else if (resp.status === 404 || resp.status === 400) {
                window.app.showToast('تم الاتصال بالخادم، لكن يبدو أن جدول invoices غير موجود. انسخ كود SQL وأنشئه في لوحة Supabase', 'warning');
            } else {
                window.app.showToast(`فشل الاتصال (رمز: ${resp.status}). تأكد من صحة الرابط والمفتاح`, 'error');
            }
        } catch (e) {
            console.error('Supabase connection error:', e);
            window.app.showToast('تعذر الاتصال بخادم Supabase. تحقق من اتصال الإنترنت والرابط', 'error');
        }
    }

    async syncAll(silent = false) {
        if (!this.isEnabled) {
            if (!silent) window.app.showToast('يرجى تهيئة إعدادات Supabase أولاً لتفعيل المزامنة السحابية', 'warning');
            return;
        }

        if (!silent) window.app.showToast('جاري المزامنة السحابية مع Supabase...', 'info');

        try {
            const localInvoices = await window.db.getAllInvoices();
            const endpoint = `${this.url.replace(/\/+$/, '')}/rest/v1/invoices`;

            // Push all local invoices with upsert (merge on invoiceNumber or id)
            for (const inv of localInvoices) {
                await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'apikey': this.key,
                        'Authorization': `Bearer ${this.key}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'resolution=merge-duplicates'
                    },
                    body: JSON.stringify(inv)
                }).catch(() => {});
            }

            // Pull cloud invoices
            const pullResp = await fetch(`${endpoint}?select=*`, {
                headers: {
                    'apikey': this.key,
                    'Authorization': `Bearer ${this.key}`
                }
            });

            if (pullResp.ok) {
                const cloudList = await pullResp.json();
                if (Array.isArray(cloudList)) {
                    for (const cloudInv of cloudList) {
                        await window.db.saveInvoice(cloudInv);
                    }
                }
            }

            if (!silent) window.app.showToast('تمت المزامنة السحابية بنجاح وتحديث السجلات! ☁️', 'success');
            if (window.searchManager) window.searchManager.loadAndRender();
            if (window.statsManager) window.statsManager.updateStats();
        } catch (e) {
            console.error('Sync failed:', e);
            if (!silent) window.app.showToast('حدث خطأ أثناء المزامنة السحابية', 'error');
        }
    }

    async pushInvoice(invoice) {
        if (!this.isEnabled || !this.url || !this.key) return;
        try {
            const endpoint = `${this.url.replace(/\/+$/, '')}/rest/v1/invoices`;
            await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'apikey': this.key,
                    'Authorization': `Bearer ${this.key}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'resolution=merge-duplicates'
                },
                body: JSON.stringify(invoice)
            });
        } catch (err) {
            console.warn('Background sync failed:', err);
        }
    }

    copySQLSchema() {
        const sql = `-- إنشاء جدول فواتير استلام التمور في Supabase
CREATE TABLE IF NOT EXISTS public.invoices (
    id TEXT PRIMARY KEY,
    "invoiceNumber" TEXT UNIQUE NOT NULL,
    date TEXT,
    day TEXT,
    "customerName" TEXT NOT NULL,
    phone TEXT,
    "altPhone" TEXT,
    wilayat TEXT,
    area TEXT,
    quantity TEXT,
    "dateTypes" JSONB,
    "otherDateType" TEXT,
    "workTypes" JSONB,
    "otherWorkType" TEXT,
    notes TEXT,
    "receiverName" TEXT,
    "customerSignature" TEXT,
    "receiverSignature" TEXT,
    status TEXT DEFAULT 'قيد الانتظار',
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- تمكين الوصول للقراءة والكتابة
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for authenticated and anon users" ON public.invoices FOR ALL USING (true);
`;

        navigator.clipboard.writeText(sql).then(() => {
            window.app.showToast('تم نسخ كود SQL! الصقه في قسم SQL Editor داخل لوحة تحكم Supabase واضغط Run 📋', 'success');
        }).catch(() => {
            window.app.showToast('يرجى نسخ الكود يدوياً من الشاشة', 'warning');
        });
    }
}

window.SupabaseSync = SupabaseSync;
window.supabaseSync = new SupabaseSync();
