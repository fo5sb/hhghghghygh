/**
 * نظام المذخورة لإدارة فواتير استلام التمور - وحدة التصدير ومشاركة الواتساب
 * Al-Madkhoorah Dates Receipt System - Export & WhatsApp Module
 */

class ExportManager {
    constructor() {}

    // Format invoice details cleanly for WhatsApp / clipboard sharing
    formatWhatsAppMessage(inv) {
        const dateStr = inv.date ? `${inv.date} (${inv.day || ''})` : '';
        const datesList = (inv.dateTypes || []).join('، ') || 'غير محدد';
        const worksList = (inv.workTypes || []).join('، ') || 'غير محدد';

        return `🌴 *المَذْخُورَة - فاتورة استلام تمور* 🌴
━━━━━━━━━━━━━━━━━
🔢 *رقم الفاتورة:* № ${inv.invoiceNumber || '—'}
📅 *التاريخ:* ${dateStr}
👤 *العميل:* ${inv.customerName || '—'}
📱 *الهاتف:* ${inv.phone || '—'}${inv.altPhone ? `\n📞 *الهاتف البديل:* ${inv.altPhone}` : ''}
📍 *الموقع:* ${inv.wilayat || ''} ${inv.area ? `- ${inv.area}` : ''}
📦 *الكمية التقديرية:* ${inv.quantity || '—'}
━━━━━━━━━━━━━━━━━
🌾 *أصناف التمر:* ${datesList}
⚙️ *نوع المعالجة والعمل:* ${worksList}
📝 *الملاحظات:* ${inv.notes || 'لا يوجد'}
━━━━━━━━━━━━━━━━━
👨‍💼 *المستلم:* ${inv.receiverName || 'طاهر - المذخورة'}
🔖 *حالة الطلب:* ${inv.status || 'قيد الانتظار'}
✨ *شكراً لتعاملكم وثقتكم بـ «المَذْخُورَة» للتمور* ✨`;
    }

    // Copy to clipboard with toast notification
    async copyWhatsAppMessage(inv) {
        const text = this.formatWhatsAppMessage(inv);
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
            } else {
                const textArea = document.createElement("textarea");
                textArea.value = text;
                textArea.style.position = "fixed";
                textArea.style.opacity = "0";
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            }
            window.app.showToast('تم نسخ فاتورة «المذخورة» بنجاح! جاهزة للصق في واتساب 📋', 'success');
        } catch (err) {
            console.error('Failed to copy: ', err);
            window.app.showToast('تعذر النسخ التلقائي، يرجى النسخ يدوياً', 'error');
        }
    }

    // Export all invoices to CSV / Excel
    async exportToCSV() {
        const invoices = await window.db.getAllInvoices();
        if (!invoices || invoices.length === 0) {
            window.app.showToast('لا توجد فواتير لتصديرها في نظام المذخورة', 'warning');
            return;
        }

        const headers = [
            'رقم الفاتورة',
            'التاريخ',
            'اليوم',
            'اسم العميل',
            'رقم الهاتف',
            'رقم الهاتف البديل',
            'الولاية',
            'المنطقة',
            'الكمية بالتقدير',
            'نوع التمر',
            'نوع العمل',
            'الملاحظات',
            'اسم المستلم',
            'الحالة'
        ];

        const rows = invoices.map(inv => [
            `"${inv.invoiceNumber || ''}"`,
            `"${inv.date || ''}"`,
            `"${inv.day || ''}"`,
            `"${(inv.customerName || '').replace(/"/g, '""')}"`,
            `"${inv.phone || ''}"`,
            `"${inv.altPhone || ''}"`,
            `"${inv.wilayat || ''}"`,
            `"${inv.area || ''}"`,
            `"${inv.quantity || ''}"`,
            `"${(inv.dateTypes || []).join(' - ')}"`,
            `"${(inv.workTypes || []).join(' - ')}"`,
            `"${(inv.notes || '').replace(/"/g, '""')}"`,
            `"${inv.receiverName || ''}"`,
            `"${inv.status || ''}"`
        ]);

        const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `المذخورة_فواتير_التمور_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        window.app.showToast('تم تصدير فواتير المذخورة إلى Excel بنجاح 📊', 'success');
    }

    // Export full JSON Backup
    async exportBackupJSON() {
        const invoices = await window.db.getAllInvoices();
        const data = {
            appName: 'AlMadkhoorahDatesReceiptSystem',
            exportDate: new Date().toISOString(),
            totalRecords: invoices.length,
            invoices: invoices
        };

        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `نسخة_احتياطية_المذخورة_${new Date().toISOString().split('T')[0]}.json`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        window.app.showToast('تم تنزيل النسخة الاحتياطية لنظام المذخورة بنجاح 💾', 'success');
    }

    // Restore from JSON Backup
    async restoreBackupJSON(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const parsed = JSON.parse(e.target.result);
                const list = parsed.invoices || (Array.isArray(parsed) ? parsed : null);

                if (!list || !Array.isArray(list)) {
                    window.app.showToast('ملف النسخة الاحتياطية غير صالح أو تالف', 'error');
                    return;
                }

                let importedCount = 0;
                for (const inv of list) {
                    if (inv.invoiceNumber) {
                        await window.db.saveInvoice(inv);
                        importedCount++;
                    }
                }

                window.app.showToast(`تمت استعادة (${importedCount}) فاتورة في نظام المذخورة بنجاح!`, 'success');
                if (window.searchManager) window.searchManager.loadAndRender();
                if (window.statsManager) window.statsManager.updateStats();
            } catch (err) {
                console.error('Restore failed:', err);
                window.app.showToast('فشل قراءة ملف النسخة الاحتياطية', 'error');
            }
        };
        reader.readAsText(file);
    }
}

window.ExportManager = ExportManager;
window.exportManager = new ExportManager();
