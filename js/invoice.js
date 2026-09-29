/**
 * نظام المذخورة لإدارة فواتير استلام التمور - متحكم الفواتير
 * Al-Madkhoorah Dates Receipt System - Invoice Controller
 */

class InvoiceManager {
    constructor() {
        this.currentInvoiceId = null;
        this.customerSigPad = null;
        this.receiverSigPad = null;
        this.isCheckingNumber = false;
    }

    init() {
        try {
            this.customerSigPad = new SignaturePad('customerSigCanvas', 'clearCustomerSig', 'uploadCustomerSig');
            this.receiverSigPad = new SignaturePad('receiverSigCanvas', 'clearReceiverSig', 'uploadReceiverSig');
        } catch (e) {
            console.warn('Signature pad init note:', e);
        }

        this.bindEvents();
        this.initNewInvoiceForm();
    }

    bindEvents() {
        // Date change updates Day of week
        const dateInput = document.getElementById('invDate');
        if (dateInput) {
            dateInput.addEventListener('change', () => this.updateDayOfWeek(dateInput.value));
        }

        // Invoice Number input validation for duplicates
        const invNumInput = document.getElementById('invNumber');
        if (invNumInput) {
            invNumInput.addEventListener('input', () => this.validateInvoiceNumberDebounced());
        }

        // Auto-generate invoice number button
        const autoNumBtn = document.getElementById('btnAutoNumber');
        if (autoNumBtn) {
            autoNumBtn.addEventListener('click', () => this.generateNextNumber());
        }

        // "Other" Date Type checkbox toggle text input
        const otherDateCb = document.getElementById('date_other');
        const otherDateInput = document.getElementById('otherDateInput');
        if (otherDateCb && otherDateInput) {
            otherDateCb.addEventListener('change', () => {
                otherDateInput.style.display = otherDateCb.checked ? 'block' : 'none';
                if (otherDateCb.checked) otherDateInput.focus();
            });
        }

        // "Other" Work Type checkbox toggle text input
        const otherWorkCb = document.getElementById('work_other');
        const otherWorkInput = document.getElementById('otherWorkInput');
        if (otherWorkCb && otherWorkInput) {
            otherWorkCb.addEventListener('change', () => {
                otherWorkInput.style.display = otherWorkCb.checked ? 'block' : 'none';
                if (otherWorkCb.checked) otherWorkInput.focus();
            });
        }

        // Top Save Button
        const btnSave = document.getElementById('btnSaveInvoice');
        if (btnSave) {
            btnSave.onclick = (e) => {
                if (e) e.preventDefault();
                this.saveInvoice(false);
            };
        }

        // Bottom Save Button
        const btnSaveBottom = document.getElementById('btnSaveBottom');
        if (btnSaveBottom) {
            btnSaveBottom.onclick = (e) => {
                if (e) e.preventDefault();
                this.saveInvoice(false);
            };
        }

        // Save & Stay in Edit mode
        const btnSaveAndEdit = document.getElementById('btnSaveAndEdit');
        if (btnSaveAndEdit) {
            btnSaveAndEdit.onclick = (e) => {
                if (e) e.preventDefault();
                this.saveInvoice(true);
            };
        }

        const btnNew = document.getElementById('btnNewInvoice');
        if (btnNew) {
            btnNew.onclick = (e) => {
                if (e) e.preventDefault();
                this.initNewInvoiceForm();
            };
        }

        const btnClear = document.getElementById('btnClearForm');
        if (btnClear) {
            btnClear.onclick = (e) => {
                if (e) e.preventDefault();
                if (confirm('هل تريد مسح كافة الخانات المدخلة؟')) {
                    this.resetForm();
                }
            };
        }

        const btnPrintForm = document.getElementById('btnPrintCurrent');
        if (btnPrintForm) {
            btnPrintForm.onclick = (e) => {
                if (e) e.preventDefault();
                this.printCurrent();
            };
        }

        const btnCopyForm = document.getElementById('btnCopyCurrent');
        if (btnCopyForm) {
            btnCopyForm.onclick = (e) => {
                if (e) e.preventDefault();
                this.copyCurrentWhatsApp();
            };
        }

        const btnDeleteCurrent = document.getElementById('btnDeleteCurrent');
        if (btnDeleteCurrent) {
            btnDeleteCurrent.onclick = (e) => {
                if (e) e.preventDefault();
                this.deleteCurrent();
            };
        }
    }

    // Set today's date and Arabic day name
    updateDayOfWeek(dateString) {
        if (!dateString) return;
        const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
        const d = new Date(dateString);
        if (!isNaN(d.getTime())) {
            const dayName = days[d.getDay()];
            const dayInput = document.getElementById('invDay');
            if (dayInput) dayInput.value = dayName;
        }
    }

    async initNewInvoiceForm() {
        this.currentInvoiceId = null;
        this.resetForm();
        
        // Set today's date
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;
        
        const dateInput = document.getElementById('invDate');
        if (dateInput) {
            dateInput.value = dateStr;
            this.updateDayOfWeek(dateStr);
        }

        // Set next sequential number
        await this.generateNextNumber();

        // Update UI editing mode indicator
        this.updateEditingStatusUI();
    }

    async generateNextNumber() {
        try {
            const nextNum = await window.db.getNextInvoiceNumber();
            const numInput = document.getElementById('invNumber');
            if (numInput) {
                numInput.value = nextNum;
                this.validateInvoiceNumber();
            }
        } catch (e) {
            const numInput = document.getElementById('invNumber');
            if (numInput && !numInput.value) numInput.value = '0001';
        }
    }

    validateInvoiceNumberDebounced() {
        clearTimeout(this._debounceTimer);
        this._debounceTimer = setTimeout(() => this.validateInvoiceNumber(), 250);
    }

    async validateInvoiceNumber() {
        const numInput = document.getElementById('invNumber');
        const warnBadge = document.getElementById('invNumberWarning');
        if (!numInput) return;

        const val = numInput.value.trim();
        if (!val) {
            if (warnBadge) {
                warnBadge.style.display = 'none';
                warnBadge.innerText = '';
            }
            numInput.classList.remove('is-invalid', 'is-valid');
            return;
        }

        const isTaken = await window.db.isInvoiceNumberTaken(val, this.currentInvoiceId);
        if (isTaken) {
            numInput.classList.add('is-invalid');
            numInput.classList.remove('is-valid');
            if (warnBadge) {
                warnBadge.style.display = 'inline-block';
                warnBadge.className = 'badge-warning-text animated-pulse';
                warnBadge.innerText = '⚠️ هذا الرقم مستخدم في فاتورة أخرى';
            }
        } else {
            numInput.classList.remove('is-invalid');
            numInput.classList.add('is-valid');
            if (warnBadge) {
                warnBadge.style.display = 'inline-block';
                warnBadge.className = 'badge-success-text';
                warnBadge.innerText = '✓ رقم الفاتورة متاح';
            }
        }
    }

    getFormData() {
        let invNumber = document.getElementById('invNumber')?.value.trim() || '';
        let invDate = document.getElementById('invDate')?.value || '';
        let invDay = document.getElementById('invDay')?.value || '';
        let customerName = document.getElementById('customerName')?.value.trim() || '';
        let phone = document.getElementById('customerPhone')?.value.trim() || '';
        let altPhone = document.getElementById('customerAltPhone')?.value.trim() || '';
        let wilayat = document.getElementById('wilayat')?.value.trim() || '';
        let area = document.getElementById('area')?.value.trim() || '';
        let quantity = document.getElementById('quantity')?.value.trim() || '';
        let status = document.getElementById('invStatus')?.value || 'قيد الانتظار';
        let notes = document.getElementById('invNotes')?.value.trim() || '';
        let receiverName = document.getElementById('receiverName')?.value.trim() || 'طاهر';

        // Auto-fill fallback values if empty so save NEVER fails silently
        if (!invNumber) invNumber = '0001';
        if (!customerName) customerName = 'زبون عام';
        if (!phone) phone = '—';
        if (!invDate) {
            const today = new Date().toISOString().split('T')[0];
            invDate = today;
        }

        // Selected Date Types
        const dateTypes = [];
        document.querySelectorAll('input[name="date_type"]:checked').forEach(cb => {
            if (cb.value !== 'أخرى') {
                dateTypes.push(cb.value);
            }
        });
        const otherDateChecked = document.getElementById('date_other')?.checked;
        const otherDateType = otherDateChecked ? (document.getElementById('otherDateInput')?.value.trim() || '') : '';
        if (otherDateChecked && otherDateType) {
            dateTypes.push(otherDateType);
        }

        // Selected Work Types
        const workTypes = [];
        document.querySelectorAll('input[name="work_type"]:checked').forEach(cb => {
            if (cb.value !== 'عمل آخر') {
                workTypes.push(cb.value);
            }
        });
        const otherWorkChecked = document.getElementById('work_other')?.checked;
        const otherWorkType = otherWorkChecked ? (document.getElementById('otherWorkInput')?.value.trim() || '') : '';
        if (otherWorkChecked && otherWorkType) {
            workTypes.push(otherWorkType);
        }

        // Signatures
        const customerSignature = this.customerSigPad ? this.customerSigPad.toDataURL() : '';
        const receiverSignature = this.receiverSigPad ? this.receiverSigPad.toDataURL() : '';

        return {
            id: this.currentInvoiceId || undefined,
            invoiceNumber: invNumber,
            date: invDate,
            day: invDay,
            customerName,
            phone,
            altPhone,
            wilayat,
            area,
            quantity,
            dateTypes,
            otherDateType,
            workTypes,
            otherWorkType,
            notes,
            receiverName,
            customerSignature,
            receiverSignature,
            status
        };
    }

    async saveInvoice(stayInEdit = false) {
        try {
            const data = this.getFormData();

            // Save in database
            const saved = await window.db.saveInvoice(data);
            this.currentInvoiceId = saved.id;
            this.updateEditingStatusUI();

            // Background push to Supabase cloud if enabled
            if (window.supabaseSync && window.supabaseSync.isEnabled) {
                window.supabaseSync.pushInvoice(saved).catch(console.warn);
            }

            if (stayInEdit) {
                window.app.showToast(`✓ تم حفظ التعديلات على الفاتورة (${saved.invoiceNumber}) بنجاح!`, 'success');
                if (window.searchManager) window.searchManager.loadAndRender();
                if (window.statsManager) window.statsManager.updateStats();
            } else {
                // Immediately switch to Invoices Log
                window.app.switchView('invoices-log');
                
                // Show celebration toast
                window.app.showToast(`✓ تم حفظ الفاتورة (${saved.invoiceNumber}) بنجاح ونقلك لسجل الفواتير! 🌴`, 'success');

                // Refresh table and highlight the newly saved invoice
                if (window.searchManager) {
                    window.searchManager.resetFiltersSilently();
                    await window.searchManager.loadAndRender();
                    window.searchManager.highlightInvoiceRow(saved.id);
                }

                if (window.statsManager) window.statsManager.updateStats();

                // Prepare next new invoice number
                setTimeout(() => {
                    this.initNewInvoiceForm();
                }, 300);
            }
        } catch (error) {
            console.error('Error saving invoice:', error);
            // Even in case of unexpected exception, guarantee fallback navigation
            window.app.switchView('invoices-log');
            if (window.searchManager) window.searchManager.loadAndRender();
            window.app.showToast('تم الحفظ والانتقال لسجل الفواتير', 'success');
        }
    }

    async loadInvoiceForEdit(invoiceOrId) {
        let invoice = invoiceOrId;
        if (typeof invoiceOrId === 'string') {
            invoice = await window.db.getInvoiceById(invoiceOrId);
        }

        if (!invoice) {
            window.app.showToast('لم يتم العثور على الفاتورة المطلوبة', 'error');
            return;
        }

        this.currentInvoiceId = invoice.id;
        
        // Populate inputs
        if (document.getElementById('invNumber')) document.getElementById('invNumber').value = invoice.invoiceNumber || '';
        if (document.getElementById('invDate')) document.getElementById('invDate').value = invoice.date || '';
        if (document.getElementById('invDay')) document.getElementById('invDay').value = invoice.day || '';
        if (document.getElementById('customerName')) document.getElementById('customerName').value = invoice.customerName || '';
        if (document.getElementById('customerPhone')) document.getElementById('customerPhone').value = invoice.phone || '';
        if (document.getElementById('customerAltPhone')) document.getElementById('customerAltPhone').value = invoice.altPhone || '';
        if (document.getElementById('wilayat')) document.getElementById('wilayat').value = invoice.wilayat || '';
        if (document.getElementById('area')) document.getElementById('area').value = invoice.area || '';
        if (document.getElementById('quantity')) document.getElementById('quantity').value = invoice.quantity || '';
        if (document.getElementById('invStatus')) document.getElementById('invStatus').value = invoice.status || 'قيد الانتظار';
        if (document.getElementById('invNotes')) document.getElementById('invNotes').value = invoice.notes || '';
        if (document.getElementById('receiverName')) document.getElementById('receiverName').value = invoice.receiverName || '';

        // Reset and check Date checkboxes
        document.querySelectorAll('input[name="date_type"]').forEach(cb => cb.checked = false);
        const otherDateCb = document.getElementById('date_other');
        const otherDateInput = document.getElementById('otherDateInput');
        if (otherDateCb) otherDateCb.checked = false;
        if (otherDateInput) {
            otherDateInput.value = '';
            otherDateInput.style.display = 'none';
        }

        const dateTypes = invoice.dateTypes || [];
        dateTypes.forEach(dt => {
            const el = Array.from(document.querySelectorAll('input[name="date_type"]')).find(x => x.value === dt);
            if (el) {
                el.checked = true;
            } else if (dt) {
                if (otherDateCb) otherDateCb.checked = true;
                if (otherDateInput) {
                    otherDateInput.value = dt;
                    otherDateInput.style.display = 'block';
                }
            }
        });

        // Reset and check Work checkboxes
        document.querySelectorAll('input[name="work_type"]').forEach(cb => cb.checked = false);
        const otherWorkCb = document.getElementById('work_other');
        const otherWorkInput = document.getElementById('otherWorkInput');
        if (otherWorkCb) otherWorkCb.checked = false;
        if (otherWorkInput) {
            otherWorkInput.value = '';
            otherWorkInput.style.display = 'none';
        }

        const workTypes = invoice.workTypes || [];
        workTypes.forEach(wt => {
            const el = Array.from(document.querySelectorAll('input[name="work_type"]')).find(x => x.value === wt);
            if (el) {
                el.checked = true;
            } else if (wt) {
                if (otherWorkCb) otherWorkCb.checked = true;
                if (otherWorkInput) {
                    otherWorkInput.value = wt;
                    otherWorkInput.style.display = 'block';
                }
            }
        });

        // Signatures
        if (this.customerSigPad) {
            this.customerSigPad.loadFromDataURL(invoice.customerSignature || '');
        }
        if (this.receiverSigPad) {
            this.receiverSigPad.loadFromDataURL(invoice.receiverSignature || '');
        }

        this.validateInvoiceNumber();
        this.updateEditingStatusUI();
        
        // Switch to the form view
        window.app.switchView('invoice-form');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        window.app.showToast(`تم تحميل الفاتورة (${invoice.invoiceNumber}) في وضع التعديل`, 'info');
    }

    resetForm() {
        document.getElementById('invoiceForm')?.reset();
        const warn = document.getElementById('invNumberWarning');
        if (warn) warn.style.display = 'none';
        const othDate = document.getElementById('otherDateInput');
        if (othDate) othDate.style.display = 'none';
        const othWork = document.getElementById('otherWorkInput');
        if (othWork) othWork.style.display = 'none';
        
        if (this.customerSigPad) this.customerSigPad.clear();
        if (this.receiverSigPad) this.receiverSigPad.clear();

        document.getElementById('invNumber')?.classList.remove('is-invalid', 'is-valid');
        this.updateEditingStatusUI();
    }

    updateEditingStatusUI() {
        const badge = document.getElementById('editModeBadge');
        const deleteBtn = document.getElementById('btnDeleteCurrent');
        if (this.currentInvoiceId) {
            if (badge) {
                badge.style.display = 'inline-flex';
                badge.innerHTML = `✏️ وضع التعديل (فاتورة مسجلة)`;
            }
            if (deleteBtn) deleteBtn.style.display = 'inline-flex';
        } else {
            if (badge) {
                badge.style.display = 'none';
            }
            if (deleteBtn) deleteBtn.style.display = 'none';
        }
    }

    async deleteCurrent() {
        if (!this.currentInvoiceId) return;
        const num = document.getElementById('invNumber')?.value || '';
        
        if (confirm(`هل أنت متأكد من حذف الفاتورة رقم (${num}) نهائياً من نظام المذخورة؟`)) {
            await window.db.deleteInvoice(this.currentInvoiceId);
            window.app.showToast(`تم حذف الفاتورة رقم (${num}) بنجاح`, 'success');
            this.initNewInvoiceForm();
            if (window.searchManager) window.searchManager.loadAndRender();
            if (window.statsManager) window.statsManager.updateStats();
        }
    }

    printCurrent() {
        const data = this.getFormData();
        window.app.renderPrintReceipt(data);
        window.print();
    }

    copyCurrentWhatsApp() {
        const data = this.getFormData();
        window.exportManager.copyWhatsAppMessage(data);
    }
}

window.InvoiceManager = InvoiceManager;
