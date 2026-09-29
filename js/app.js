/**
 * نظام المذخورة لإدارة فواتير استلام التمور - المتحكم العام للنظام
 * Al-Madkhoorah Dates Receipt System - Main Application Orchestrator
 */

class App {
    constructor() {
        this.currentView = 'invoice-form';
        this.activeModalInvoice = null;
    }

    async init() {
        // Initialize Modules
        window.invoiceManager = new window.InvoiceManager();
        window.invoiceManager.init();

        window.searchManager = new window.SearchManager();
        window.searchManager.init();

        window.statsManager = new window.StatsManager();
        window.statsManager.init();

        if (window.supabaseSync) {
            await window.supabaseSync.init();
        }

        this.bindNavigation();
        this.bindModalEvents();
        this.loadBrandSettings();
        this.bindSettingsEvents();

        // Register Service Worker for PWA if supported and on HTTP/HTTPS
        if ('serviceWorker' in navigator && (window.location.protocol === 'http:' || window.location.protocol === 'https:')) {
            navigator.serviceWorker.register('./sw.js').catch(err => {
                console.log('SW registration note:', err);
            });
        }

        console.log('تم تشغيل نظام المذخورة لإدارة فواتير التمور بنجاح.');
    }

    // Switch between main views: 'invoice-form', 'invoices-log', 'dashboard', 'settings'
    switchView(viewId) {
        document.querySelectorAll('.view-section').forEach(sec => {
            sec.style.display = 'none';
            sec.classList.remove('active-view-anim');
        });

        const target = document.getElementById(viewId);
        if (target) {
            target.style.display = 'block';
            // Trigger animation
            void target.offsetWidth;
            target.classList.add('active-view-anim');
            this.currentView = viewId;
        }

        // Update nav button active states
        document.querySelectorAll('.nav-link').forEach(btn => {
            if (btn.getAttribute('data-target') === viewId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Trigger updates if needed
        if (viewId === 'invoices-log' && window.searchManager) {
            window.searchManager.loadAndRender();
        } else if (viewId === 'dashboard' && window.statsManager) {
            window.statsManager.updateStats();
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    bindNavigation() {
        document.querySelectorAll('.nav-link').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const target = btn.getAttribute('data-target');
                if (target) this.switchView(target);
            });
        });
    }

    // Toast Notification System
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type} toast-animated`;
        
        let icon = 'ℹ️';
        if (type === 'success') icon = '🌴 ✓';
        if (type === 'error') icon = '✕';
        if (type === 'warning') icon = '⚠️';

        toast.innerHTML = `
            <span class="toast-icon">${icon}</span>
            <span class="toast-text">${message}</span>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('show');
        }, 10);

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 350);
        }, 4200);
    }

    // Modal Events & Details Viewer
    bindModalEvents() {
        const closeBtn = document.getElementById('btnCloseModal');
        const modalBackdrop = document.getElementById('invoiceDetailModal');

        if (closeBtn) closeBtn.addEventListener('click', () => this.closeInvoiceModal());
        if (modalBackdrop) {
            modalBackdrop.addEventListener('click', (e) => {
                if (e.target === modalBackdrop) {
                    this.closeInvoiceModal();
                }
            });
        }

        // Modal Action Buttons
        const btnPrint = document.getElementById('btnModalPrint');
        if (btnPrint) {
            btnPrint.addEventListener('click', () => {
                if (this.activeModalInvoice) {
                    this.renderPrintReceipt(this.activeModalInvoice);
                    window.print();
                }
            });
        }

        const btnCopy = document.getElementById('btnModalCopy');
        if (btnCopy) {
            btnCopy.addEventListener('click', () => {
                if (this.activeModalInvoice) {
                    window.exportManager.copyWhatsAppMessage(this.activeModalInvoice);
                }
            });
        }

        const btnEdit = document.getElementById('btnModalEdit');
        if (btnEdit) {
            btnEdit.addEventListener('click', () => {
                if (this.activeModalInvoice) {
                    const inv = this.activeModalInvoice;
                    this.closeInvoiceModal();
                    window.invoiceManager.loadInvoiceForEdit(inv);
                }
            });
        }

        const btnPdf = document.getElementById('btnModalPdf');
        if (btnPdf) {
            btnPdf.addEventListener('click', () => {
                if (this.activeModalInvoice) {
                    this.renderPrintReceipt(this.activeModalInvoice);
                    window.print();
                }
            });
        }
    }

    async showInvoiceModalById(id) {
        const invoice = await window.db.getInvoiceById(id);
        if (invoice) {
            this.showInvoiceModal(invoice);
        } else {
            this.showToast('تعذر العثور على الفاتورة المطلوبة', 'error');
        }
    }

    showInvoiceModal(invoice) {
        this.activeModalInvoice = invoice;
        const container = document.getElementById('modalInvoicePaper');
        if (!container) return;

        container.innerHTML = this.generateReceiptHTML(invoice);

        const modal = document.getElementById('invoiceDetailModal');
        if (modal) {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    }

    closeInvoiceModal() {
        const modal = document.getElementById('invoiceDetailModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
        this.activeModalInvoice = null;
    }

    // WiFi & Mobile QR Code Share Modal
    async openWifiShareModal() {
        const modal = document.getElementById('wifiShareModal');
        const urlText = document.getElementById('wifiUrlText');
        const qrContainer = document.getElementById('wifiQrCode');
        if (!modal) return;

        // Use the full current page URL (works on GitHub Pages and any hosting)
        let displayUrl = window.location.href.split('?')[0].split('#')[0];
        if (displayUrl.endsWith('/')) {
            displayUrl = displayUrl.slice(0, -1);
        }

        this.currentWifiUrl = displayUrl;
        if (urlText) urlText.innerText = displayUrl;

        if (qrContainer) {
            qrContainer.innerHTML = '';
            let qrRendered = false;
            if (window.QRCode) {
                try {
                    new window.QRCode(qrContainer, {
                        text: displayUrl,
                        width: 190,
                        height: 190,
                        colorDark: '#064e3b',
                        colorLight: '#ffffff'
                    });
                    if (qrContainer.children.length > 0) {
                        qrRendered = true;
                    }
                } catch (qrErr) {
                    console.warn('Local QRCode generator notice:', qrErr);
                }
            }

            if (!qrRendered) {
                const img = document.createElement('img');
                img.src = `https://api.qrserver.com/v1/create-qr-code/?size=190x190&data=${encodeURIComponent(displayUrl)}`;
                img.alt = 'QR Code';
                img.style.width = '190px';
                img.style.height = '190px';
                img.style.borderRadius = '8px';
                qrContainer.appendChild(img);
            }
        }

        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    closeWifiShareModal() {
        const modal = document.getElementById('wifiShareModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    }

    copyWifiUrl() {
        if (!this.currentWifiUrl) return;
        navigator.clipboard.writeText(this.currentWifiUrl).then(() => {
            this.showToast('✓ تم نسخ رابط الموقع على الشبكة! 📋', 'success');
        }).catch(() => {
            prompt('انسخ الرابط التالي:', this.currentWifiUrl);
        });
    }

    // Print Receipt Renderer
    renderPrintReceipt(invoice) {
        const printArea = document.getElementById('printArea');
        if (!printArea) return;
        printArea.innerHTML = this.generateReceiptHTML(invoice);
    }

    async printInvoiceById(id) {
        const invoice = await window.db.getInvoiceById(id);
        if (invoice) {
            this.renderPrintReceipt(invoice);
            window.print();
        }
    }

    async confirmDeleteInvoice(id, number) {
        const pin = await window.db.getSetting('admin_pin', '');
        if (pin) {
            const enteredPin = prompt('أدخل الرمز السري للإدارة لتأكيد الحذف:');
            if (enteredPin !== pin) {
                this.showToast('الرمز السري غير صحيح. تم إلغاء الحذف', 'error');
                return;
            }
        }

        if (confirm(`هل أنت متأكد من حذف الفاتورة رقم (${number}) نهائياً من نظام المذخورة؟`)) {
            await window.db.deleteInvoice(id);
            this.showToast(`تم حذف الفاتورة رقم (${number}) بنجاح`, 'success');
            if (window.searchManager) window.searchManager.loadAndRender();
            if (window.statsManager) window.statsManager.updateStats();
        }
    }

    // Generate the Exact Paper Replica HTML matching the physical receipt
    generateReceiptHTML(inv) {
        const dateTypesList = [
            'فرض', 'خلاص', 'بونارنجه', 'بومعان', 'برني', 'خنيزي', 'نغال',
            'حنضل', 'قشوش بانواعه', 'ام سله', 'خصاب', 'لولو', 'بخيته', 'تمر غير معروف'
        ];

        const workTypesList = [
            'مدلوك بخار', 'مدلوك بدون بخار', 'مدلوك سبيشل', 'مدلوك مكسرات مع',
            'التشكيل ملة صغيرة', 'مدلوك مكسرات مع التشكيل ملة كبيرة', 'مدلوك ساده صغير',
            'مدلوك ساده كبير', 'مدلوك في زبل', 'مدلوك اكياس', 'غسيل التمر',
            'تنقية التمر', 'طابوق', 'شفط هواء', 'عمل اخر'
        ];

        const activeDates = inv.dateTypes || [];
        const activeWorks = inv.workTypes || [];

        // Build Dates Checkboxes Grid
        let datesGridHTML = '';
        dateTypesList.forEach(item => {
            const isChecked = activeDates.includes(item);
            datesGridHTML += `
                <div class="paper-check-item">
                    <span class="paper-box ${isChecked ? 'checked' : ''}">${isChecked ? '✓' : ''}</span>
                    <span class="paper-label">${item}</span>
                </div>
            `;
        });
        if (inv.otherDateType || activeDates.some(d => !dateTypesList.includes(d))) {
            const extra = inv.otherDateType || activeDates.find(d => !dateTypesList.includes(d));
            datesGridHTML += `
                <div class="paper-check-item">
                    <span class="paper-box checked">✓</span>
                    <span class="paper-label">أخرى: ${extra}</span>
                </div>
            `;
        }

        // Build Work Checkboxes Grid
        let worksGridHTML = '';
        workTypesList.forEach(item => {
            const isChecked = activeWorks.includes(item);
            worksGridHTML += `
                <div class="paper-check-item">
                    <span class="paper-box ${isChecked ? 'checked' : ''}">${isChecked ? '✓' : ''}</span>
                    <span class="paper-label">${item}</span>
                </div>
            `;
        });
        if (inv.otherWorkType || activeWorks.some(w => !workTypesList.includes(w))) {
            const extra = inv.otherWorkType || activeWorks.find(w => !workTypesList.includes(w));
            worksGridHTML += `
                <div class="paper-check-item">
                    <span class="paper-box checked">✓</span>
                    <span class="paper-label">عمل آخر: ${extra}</span>
                </div>
            `;
        }

        // Customer Signature Image or Blank
        const custSigHTML = inv.customerSignature 
            ? `<img src="${inv.customerSignature}" class="receipt-sig-img" alt="توقيع الزبون" />` 
            : `<div class="sig-placeholder"></div>`;

        const recvSigHTML = inv.receiverSignature 
            ? `<img src="${inv.receiverSignature}" class="receipt-sig-img" alt="توقيع المستلم" />` 
            : `<div class="sig-placeholder"></div>`;

        return `
            <div class="receipt-paper">
                <!-- Receipt Header with Al-Madkhoorah Brand -->
                <div class="receipt-top-header">
                    <div class="receipt-brand-mark">
                        <span class="brand-palm">🌴</span>
                        <div class="brand-texts">
                            <span class="brand-name-ar">المَذْخُورَة</span>
                            <span class="brand-desc-ar">لاستلام وتجهيز ومعالجة التمور</span>
                        </div>
                    </div>
                    <div class="receipt-top-serial">
                        <span class="serial-red">№ ${inv.invoiceNumber || '—'}</span>
                    </div>
                </div>

                <!-- Main Data Table -->
                <table class="receipt-table">
                    <tr>
                        <td class="cell-day"><strong>اليوم :</strong> <span class="ink-handwritten">${inv.day || '—'}</span></td>
                        <td class="cell-date"><strong>التاريخ :</strong> <span class="ink-handwritten">${inv.date || '—'}</span></td>
                    </tr>
                    <tr>
                        <td colspan="2"><strong>الاسم :</strong> <span class="ink-handwritten">${inv.customerName || '—'}</span></td>
                    </tr>
                    <tr>
                        <td><strong>رقم الهاتف :</strong> <span class="ink-handwritten" dir="ltr">${inv.phone || '—'}</span></td>
                        <td><strong>رقم الهاتف البديل :</strong> <span class="ink-handwritten" dir="ltr">${inv.altPhone || '—'}</span></td>
                    </tr>
                    <tr>
                        <td><strong>الولاية :</strong> <span class="ink-handwritten">${inv.wilayat || '—'}</span></td>
                        <td><strong>المنطقة :</strong> <span class="ink-handwritten">${inv.area || '—'}</span></td>
                    </tr>
                    <tr>
                        <td colspan="2"><strong>كمية التمر بالتقدير :</strong> <span class="ink-handwritten">${inv.quantity || '—'}</span></td>
                    </tr>
                </table>

                <!-- Date Types Section -->
                <div class="receipt-section-box">
                    <div class="receipt-section-title">نوع التمر :</div>
                    <div class="receipt-checks-grid">
                        ${datesGridHTML}
                    </div>
                </div>

                <!-- Work Types Section -->
                <div class="receipt-section-box">
                    <div class="receipt-section-title">نوع العمل :</div>
                    <div class="receipt-checks-grid">
                        ${worksGridHTML}
                    </div>
                </div>

                <!-- Notes Section -->
                <div class="receipt-section-box notes-box">
                    <div class="receipt-section-title">ملاحظة :</div>
                    <div class="receipt-notes-lines ink-handwritten">
                        ${inv.notes ? inv.notes.replace(/\n/g, '<br/>') : '<span class="text-muted">—</span>'}
                    </div>
                </div>

                <!-- Bottom Signatures and Receiver -->
                <table class="receipt-table signatures-table">
                    <tr>
                        <td class="cell-sig">
                            <div class="sig-title">توقيع الزبون :</div>
                            ${custSigHTML}
                        </td>
                        <td class="cell-sig">
                            <div class="sig-title">توقيع المستلم :</div>
                            ${recvSigHTML}
                        </td>
                        <td class="cell-sig">
                            <div class="sig-title">اسم مستلم التمر :</div>
                            <div class="ink-handwritten font-bold text-center" style="margin-top: 15px; font-size: 1.1rem;">
                                ${inv.receiverName || 'طاهر'}
                            </div>
                        </td>
                    </tr>
                </table>

                <!-- Footer stamp note -->
                <div class="receipt-paper-footer">
                    <span>* شكراً لتعاملكم مع المذخورة لخدمات التمور *</span>
                </div>
            </div>
        `;
    }

    // Brand and Store Settings
    async loadBrandSettings() {
        const storeName = await window.db.getSetting('store_name', 'المذخورة لاستلام وتجهيز التمور');
        const storePhone = await window.db.getSetting('store_phone', '92164292');
        const storeAddress = await window.db.getSetting('store_address', 'سلطنة عمان - ولاية السيب');
        const adminPin = await window.db.getSetting('admin_pin', '');

        const elName = document.getElementById('settingStoreName');
        const elPhone = document.getElementById('settingStorePhone');
        const elAddress = document.getElementById('settingStoreAddress');
        const elPin = document.getElementById('settingAdminPin');

        if (elName) elName.value = storeName;
        if (elPhone) elPhone.value = storePhone;
        if (elAddress) elAddress.value = storeAddress;
        if (elPin) elPin.value = adminPin;

        // Update brand in navbar
        const navBrandName = document.getElementById('navbarBrandName');
        if (navBrandName) navBrandName.innerText = storeName;
    }

    bindSettingsEvents() {
        const btnSaveSettings = document.getElementById('btnSaveGeneralSettings');
        if (btnSaveSettings) {
            btnSaveSettings.addEventListener('click', async () => {
                const name = document.getElementById('settingStoreName')?.value.trim() || 'المذخورة لاستلام وتجهيز التمور';
                const phone = document.getElementById('settingStorePhone')?.value.trim() || '';
                const address = document.getElementById('settingStoreAddress')?.value.trim() || '';
                const pin = document.getElementById('settingAdminPin')?.value.trim() || '';

                await window.db.saveSetting('store_name', name);
                await window.db.saveSetting('store_phone', phone);
                await window.db.saveSetting('store_address', address);
                await window.db.saveSetting('admin_pin', pin);

                const navBrandName = document.getElementById('navbarBrandName');
                if (navBrandName) navBrandName.innerText = name;

                this.showToast('تم حفظ إعدادات نظام المذخورة بنجاح', 'success');
            });
        }

        // Backup buttons
        const btnExportCsv = document.getElementById('btnExportCSV');
        if (btnExportCsv) {
            btnExportCsv.addEventListener('click', () => window.exportManager.exportToCSV());
        }

        const btnExportJson = document.getElementById('btnExportJSON');
        if (btnExportJson) {
            btnExportJson.addEventListener('click', () => window.exportManager.exportBackupJSON());
        }

        const inputRestore = document.getElementById('inputRestoreJSON');
        if (inputRestore) {
            inputRestore.addEventListener('change', (e) => {
                if (e.target.files[0]) {
                    window.exportManager.restoreBackupJSON(e.target.files[0]);
                }
            });
        }

        // Reset Database Button
        const btnResetDB = document.getElementById('btnResetDatabase');
        if (btnResetDB) {
            btnResetDB.addEventListener('click', async () => {
                const pin = await window.db.getSetting('admin_pin', '');
                if (pin) {
                    const p = prompt('أدخل الرمز السري للإدارة لتأكيد مسح قاعدة البيانات:');
                    if (p !== pin) {
                        this.showToast('الرمز السري غير صحيح', 'error');
                        return;
                    }
                }

                if (confirm('تحذير شديد الأهمية!\nهل أنت متأكد من رغبتك في حذف كافة فواتير نظام المذخورة نهائياً؟')) {
                    if (confirm('تأكيد نهائي: لن تتمكن من استرجاع البيانات المحذوفة إلا بوجود ملف نسخة احتياطية!')) {
                        await window.db.clearAllInvoices();
                        this.showToast('تم مسح قاعدة البيانات بنجاح', 'info');
                        if (window.searchManager) window.searchManager.loadAndRender();
                        if (window.statsManager) window.statsManager.updateStats();
                        window.invoiceManager.initNewInvoiceForm();
                    }
                }
            });
        }
    }
}

// Instantiate global app and boot on DOMContentLoaded
window.app = new App();
document.addEventListener('DOMContentLoaded', () => {
    window.app.init();
});
