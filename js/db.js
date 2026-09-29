/**
 * نظام المذخورة لإدارة فواتير استلام التمور - محرك قاعدة البيانات الدائمة
 * Al-Madkhoorah Dates Receipt System - Database Engine
 * 
 * معالجة فورية وموثوقة 100% بدون أي تعليق أو تأخير للوعود البرمجية (No Deadlocks)
 */

const DB_NAME = 'AlMadkhoorahDatesDB';
const DB_VERSION = 2; // Bump version to ensure clean upgrade
const STORE_NAME = 'invoices';
const SETTINGS_STORE = 'settings';

class InvoiceDatabase {
    constructor() {
        this.db = null;
        this.isReady = false;
        this.initPromise = this.init();
    }

    async init() {
        return new Promise((resolve) => {
            if (!window.indexedDB) {
                console.warn('IndexedDB غير متاح، الاعتماد الكامل على LocalStorage');
                this.isReady = true;
                this.seedInitialDataIfEmpty();
                resolve(null);
                return;
            }

            try {
                const request = indexedDB.open(DB_NAME, DB_VERSION);

                request.onupgradeneeded = (event) => {
                    const db = event.target.result;

                    if (!db.objectStoreNames.contains(STORE_NAME)) {
                        const invoiceStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                        invoiceStore.createIndex('invoiceNumber', 'invoiceNumber', { unique: false });
                        invoiceStore.createIndex('customerName', 'customerName', { unique: false });
                        invoiceStore.createIndex('phone', 'phone', { unique: false });
                        invoiceStore.createIndex('date', 'date', { unique: false });
                    }

                    if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
                        db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
                    }
                };

                request.onsuccess = (event) => {
                    this.db = event.target.result;
                    this.isReady = true;
                    // Resolve IMMEDIATELY so any awaiting calls are unblocked!
                    resolve(this.db);
                    // Seed initial data asynchronously after unblocking
                    setTimeout(() => {
                        this.seedInitialDataIfEmpty();
                    }, 50);
                };

                request.onerror = (event) => {
                    console.warn('تعذر فتح IndexedDB، استخدام LocalStorage:', event);
                    this.isReady = true;
                    resolve(null);
                };

                request.onblocked = () => {
                    console.warn('IndexedDB blocked');
                    this.isReady = true;
                    resolve(null);
                };
            } catch (err) {
                console.warn('Exception opening IndexedDB:', err);
                this.isReady = true;
                resolve(null);
            }
        });
    }

    // Seed default sample invoice from the original paper receipt (№ 0127) if database is empty
    async seedInitialDataIfEmpty() {
        try {
            const all = await this.getAllInvoices();
            if (!all || all.length === 0) {
                const sampleInvoice = {
                    id: 'inv_sample_0127',
                    invoiceNumber: '0127',
                    date: '2026-08-09',
                    day: 'الأحد',
                    customerName: 'قاسم بن محمد بن سيف الخزمي',
                    phone: '92164292',
                    altPhone: '',
                    wilayat: 'السيب',
                    area: 'المعبيلة الجنوبية',
                    quantity: 'كمية مقدرة (متوسطة)',
                    dateTypes: ['خلاص'],
                    otherDateType: '',
                    workTypes: ['مدلوك اكياس'],
                    otherWorkType: '',
                    notes: '١- إضافة سمسم',
                    receiverName: 'طاهر',
                    customerSignature: '',
                    receiverSignature: '',
                    status: 'جاهز للاستلام',
                    createdAt: '2026-08-09T09:30:00.000Z',
                    updatedAt: '2026-08-09T09:30:00.000Z'
                };
                await this.saveInvoice(sampleInvoice);
                if (window.searchManager) window.searchManager.loadAndRender();
            }
        } catch (e) {
            console.error('خطأ في البذر الأولي:', e);
        }
    }

    // Get next sequential invoice number formatted e.g. '0128' or '0001'
    async getNextInvoiceNumber() {
        try {
            const invoices = await this.getAllInvoices();
            if (!invoices || invoices.length === 0) {
                return '0001';
            }

            let maxNumber = 0;
            invoices.forEach(inv => {
                const num = parseInt(inv.invoiceNumber, 10);
                if (!isNaN(num) && num > maxNumber) {
                    maxNumber = num;
                }
            });

            const nextNum = maxNumber + 1;
            return nextNum.toString().padStart(4, '0');
        } catch (e) {
            return '0001';
        }
    }

    // Check if invoice number exists
    async isInvoiceNumberTaken(invoiceNumber, excludeId = null) {
        try {
            const invoices = await this.getAllInvoices();
            const cleanNumber = String(invoiceNumber || '').trim();
            if (!cleanNumber) return false;
            return invoices.some(inv => 
                String(inv.invoiceNumber).trim() === cleanNumber && inv.id !== excludeId
            );
        } catch (e) {
            return false;
        }
    }

    // Get all invoices (guaranteed newest first)
    async getAllInvoices() {
        if (!this.isReady) {
            await this.initPromise;
        }

        // Fast path: LocalStorage always has current data
        const localList = this.getFromLocalStorage();

        if (!this.db) {
            return localList;
        }

        return new Promise((resolve) => {
            try {
                const transaction = this.db.transaction([STORE_NAME], 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.getAll();

                request.onsuccess = () => {
                    let results = request.result || [];
                    
                    // If indexeddb has fewer items than localstorage, merge them safely
                    if (localList.length > results.length) {
                        const existingIds = new Set(results.map(x => x.id));
                        localList.forEach(item => {
                            if (!existingIds.has(item.id)) {
                                results.push(item);
                            }
                        });
                    }

                    // Sort newest first
                    results.sort((a, b) => {
                        const timeA = new Date(a.createdAt || a.date || 0).getTime();
                        const timeB = new Date(b.createdAt || b.date || 0).getTime();
                        return timeB - timeA || (parseInt(b.invoiceNumber, 10) || 0) - (parseInt(a.invoiceNumber, 10) || 0);
                    });

                    this.syncToLocalStorage(results);
                    resolve(results);
                };

                request.onerror = () => {
                    resolve(localList);
                };
            } catch (err) {
                console.warn('IndexedDB read error, using LocalStorage:', err);
                resolve(localList);
            }
        });
    }

    // Get single invoice by ID
    async getInvoiceById(id) {
        if (!this.isReady) await this.initPromise;

        const list = this.getFromLocalStorage();
        const foundLocal = list.find(x => x.id === id);
        if (foundLocal) return foundLocal;

        if (!this.db) return null;

        return new Promise((resolve) => {
            try {
                const transaction = this.db.transaction([STORE_NAME], 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.get(id);

                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => resolve(null);
            } catch (e) {
                resolve(null);
            }
        });
    }

    // Save or update an invoice
    async saveInvoice(invoice) {
        if (!this.isReady) await this.initPromise;

        const now = new Date().toISOString();
        if (!invoice.id) {
            invoice.id = 'inv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
            invoice.createdAt = invoice.createdAt || now;
        }
        invoice.updatedAt = now;
        invoice.invoiceNumber = String(invoice.invoiceNumber || '').trim();

        // 1. Immediately save to LocalStorage so it's synchronously available!
        this.saveSingleToLocalStorage(invoice);

        // 2. If IndexedDB is available, persist it there as well
        if (this.db) {
            try {
                const transaction = this.db.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                store.put(invoice);
            } catch (err) {
                console.warn('IndexedDB write warning:', err);
            }
        }

        return invoice;
    }

    // Delete invoice by ID
    async deleteInvoice(id) {
        if (!this.isReady) await this.initPromise;

        let list = this.getFromLocalStorage();
        list = list.filter(x => x.id !== id);
        this.syncToLocalStorage(list);

        if (this.db) {
            try {
                const transaction = this.db.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                store.delete(id);
            } catch (e) {}
        }

        return true;
    }

    // Clear all invoices (Admin)
    async clearAllInvoices() {
        localStorage.removeItem('almadkhoorah_invoices');
        localStorage.removeItem('invoices_backup');

        if (this.db) {
            try {
                const transaction = this.db.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                store.clear();
            } catch (e) {}
        }
        return true;
    }

    // Settings (Store Name, Phone, Address, PIN, Supabase keys)
    async getSetting(key, defaultValue = null) {
        const fallback = localStorage.getItem('setting_' + key);
        if (fallback !== null) {
            try { return JSON.parse(fallback); } catch(e) { return fallback; }
        }

        if (!this.db) return defaultValue;

        return new Promise((resolve) => {
            try {
                const transaction = this.db.transaction([SETTINGS_STORE], 'readonly');
                const store = transaction.objectStore(SETTINGS_STORE);
                const request = store.get(key);

                request.onsuccess = () => {
                    if (request.result && request.result.value !== undefined) {
                        resolve(request.result.value);
                    } else {
                        resolve(defaultValue);
                    }
                };
                request.onerror = () => resolve(defaultValue);
            } catch (e) {
                resolve(defaultValue);
            }
        });
    }

    async saveSetting(key, value) {
        try {
            localStorage.setItem('setting_' + key, JSON.stringify(value));
        } catch(e) {}

        if (!this.db) return true;

        try {
            const transaction = this.db.transaction([SETTINGS_STORE], 'readwrite');
            const store = transaction.objectStore(SETTINGS_STORE);
            store.put({ key, value });
        } catch (e) {}
        return true;
    }

    // LocalStorage helpers
    getFromLocalStorage() {
        try {
            const raw = localStorage.getItem('almadkhoorah_invoices') || localStorage.getItem('invoices_backup');
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    syncToLocalStorage(list) {
        try {
            // Remove huge base64 strings if quota is tight
            const cleanList = list.map(inv => {
                const copy = { ...inv };
                if (copy.customerSignature && copy.customerSignature.length > 50000) {
                    copy.customerSignature = copy.customerSignature.substring(0, 100);
                }
                if (copy.receiverSignature && copy.receiverSignature.length > 50000) {
                    copy.receiverSignature = copy.receiverSignature.substring(0, 100);
                }
                return copy;
            });
            localStorage.setItem('almadkhoorah_invoices', JSON.stringify(cleanList));
        } catch (e) {
            console.warn('LocalStorage quota warning:', e);
        }
    }

    saveSingleToLocalStorage(invoice) {
        try {
            const list = this.getFromLocalStorage();
            const index = list.findIndex(x => x.id === invoice.id || (x.invoiceNumber && x.invoiceNumber === invoice.invoiceNumber));
            if (index >= 0) {
                list[index] = invoice;
            } else {
                list.unshift(invoice); // Add to top
            }
            this.syncToLocalStorage(list);
        } catch (e) {}
    }
}

// Global database instance
window.db = new InvoiceDatabase();
