/**
 * نظام المذخورة لإدارة فواتير استلام التمور - متحكم سجل الفواتير والبحث
 * Al-Madkhoorah Dates Receipt System - Search, Filter & Log Table Controller
 */

class SearchManager {
    constructor() {
        this.invoices = [];
        this.filteredInvoices = [];
        this.currentPage = 1;
        this.pageSize = 10;
        this.sortBy = 'date_desc';
        this.highlightedId = null;
    }

    init() {
        this.bindEvents();
        this.loadAndRender();
    }

    bindEvents() {
        // Quick Live Search Input
        const searchInput = document.getElementById('searchQuery');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                this.currentPage = 1;
                this.applyFilters();
            });
        }

        // Filters change
        const filterDateFrom = document.getElementById('filterDateFrom');
        const filterDateTo = document.getElementById('filterDateTo');
        const filterWorkType = document.getElementById('filterWorkType');
        const filterStatus = document.getElementById('filterStatus');
        const sortSelect = document.getElementById('sortBySelect');
        const pageSizeSelect = document.getElementById('pageSizeSelect');

        [filterDateFrom, filterDateTo, filterWorkType, filterStatus].forEach(el => {
            if (el) {
                el.addEventListener('change', () => {
                    this.currentPage = 1;
                    this.applyFilters();
                });
            }
        });

        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.sortBy = e.target.value;
                this.applySorting();
                this.renderTable();
            });
        }

        if (pageSizeSelect) {
            pageSizeSelect.addEventListener('change', (e) => {
                this.pageSize = parseInt(e.target.value, 10) || 10;
                this.currentPage = 1;
                this.renderTable();
            });
        }

        // Reset search & filters button
        const btnResetSearch = document.getElementById('btnResetSearch');
        if (btnResetSearch) {
            btnResetSearch.addEventListener('click', () => this.resetFilters());
        }
    }

    async loadAndRender() {
        this.invoices = await window.db.getAllInvoices();
        this.applyFilters();
    }

    applyFilters() {
        const query = (document.getElementById('searchQuery')?.value || '').trim().toLowerCase();
        const dateFrom = document.getElementById('filterDateFrom')?.value || '';
        const dateTo = document.getElementById('filterDateTo')?.value || '';
        const workType = document.getElementById('filterWorkType')?.value || '';
        const status = document.getElementById('filterStatus')?.value || '';

        this.filteredInvoices = this.invoices.filter(inv => {
            // Text Search
            if (query) {
                const matchNum = String(inv.invoiceNumber || '').toLowerCase().includes(query);
                const matchName = String(inv.customerName || '').toLowerCase().includes(query);
                const matchPhone = String(inv.phone || '').toLowerCase().includes(query);
                const matchAltPhone = String(inv.altPhone || '').toLowerCase().includes(query);
                const matchWilayat = String(inv.wilayat || '').toLowerCase().includes(query);
                const matchArea = String(inv.area || '').toLowerCase().includes(query);
                const matchDate = String(inv.date || '').toLowerCase().includes(query);
                const matchDates = (inv.dateTypes || []).some(d => String(d).toLowerCase().includes(query));
                const matchWorks = (inv.workTypes || []).some(w => String(w).toLowerCase().includes(query));

                if (!matchNum && !matchName && !matchPhone && !matchAltPhone && !matchWilayat && !matchArea && !matchDate && !matchDates && !matchWorks) {
                    return false;
                }
            }

            // Date Range
            if (dateFrom && inv.date && inv.date < dateFrom) return false;
            if (dateTo && inv.date && inv.date > dateTo) return false;

            // Work Type
            if (workType) {
                const works = inv.workTypes || [];
                if (!works.includes(workType)) return false;
            }

            // Status
            if (status && inv.status !== status) return false;

            return true;
        });

        this.applySorting();
        this.renderTable();
    }

    applySorting() {
        this.filteredInvoices.sort((a, b) => {
            switch (this.sortBy) {
                case 'date_asc':
                    return new Date(a.date || a.createdAt || 0) - new Date(b.date || b.createdAt || 0);
                case 'date_desc':
                    return new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0) || (parseInt(b.invoiceNumber, 10) || 0) - (parseInt(a.invoiceNumber, 10) || 0);
                case 'num_asc':
                    return (parseInt(a.invoiceNumber, 10) || 0) - (parseInt(b.invoiceNumber, 10) || 0);
                case 'num_desc':
                    return (parseInt(b.invoiceNumber, 10) || 0) - (parseInt(a.invoiceNumber, 10) || 0);
                case 'name_asc':
                    return (a.customerName || '').localeCompare(b.customerName || '', 'ar');
                default:
                    return new Date(b.date || 0) - new Date(a.date || 0);
            }
        });
    }

    resetFiltersSilently() {
        const ids = ['searchQuery', 'filterDateFrom', 'filterDateTo', 'filterWorkType', 'filterStatus'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        const sortEl = document.getElementById('sortBySelect');
        if (sortEl) sortEl.value = 'date_desc';
        this.sortBy = 'date_desc';
        this.currentPage = 1;
    }

    resetFilters() {
        this.resetFiltersSilently();
        this.applyFilters();
    }

    highlightInvoiceRow(id) {
        this.highlightedId = id;
        setTimeout(() => {
            const row = document.querySelector(`tr[data-id="${id}"]`);
            if (row) {
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                row.classList.add('row-just-saved');
                setTimeout(() => {
                    row.classList.remove('row-just-saved');
                    this.highlightedId = null;
                }, 3500);
            }
        }, 150);
    }

    renderTable() {
        const tbody = document.getElementById('invoicesTableBody');
        const countBadge = document.getElementById('invoicesCountBadge');
        const emptyState = document.getElementById('invoicesEmptyState');
        const paginationContainer = document.getElementById('invoicesPagination');

        if (!tbody) return;

        const total = this.filteredInvoices.length;
        if (countBadge) {
            countBadge.innerText = `${total} فاتورة مسجلة`;
        }

        if (total === 0) {
            tbody.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
            if (paginationContainer) paginationContainer.innerHTML = '';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';

        // Calculate pagination slices
        const totalPages = Math.ceil(total / this.pageSize);
        if (this.currentPage > totalPages) this.currentPage = totalPages;
        if (this.currentPage < 1) this.currentPage = 1;

        const startIdx = (this.currentPage - 1) * this.pageSize;
        const endIdx = startIdx + this.pageSize;
        const pageItems = this.filteredInvoices.slice(startIdx, endIdx);

        // Render rows with smooth staggered entry
        tbody.innerHTML = pageItems.map((inv, index) => {
            const dateDisplay = inv.date ? `${inv.date} (${inv.day || ''})` : '—';
            const datesList = (inv.dateTypes || []).slice(0, 2).join('، ') + ((inv.dateTypes || []).length > 2 ? ' ...' : '');
            const worksList = (inv.workTypes || []).slice(0, 2).join('، ') + ((inv.workTypes || []).length > 2 ? ' ...' : '');
            
            let statusBadgeClass = 'badge-secondary';
            if (inv.status === 'جاهز للاستلام') statusBadgeClass = 'badge-success';
            else if (inv.status === 'جاري المعالجة') statusBadgeClass = 'badge-warning';
            else if (inv.status === 'تم التسليم') statusBadgeClass = 'badge-primary';

            const isHighlighted = (inv.id === this.highlightedId);

            return `
                <tr class="invoice-table-row ${isHighlighted ? 'row-just-saved' : ''}" data-id="${inv.id}" style="animation-delay: ${index * 0.04}s;">
                    <td class="td-num">
                        <span class="inv-badge-num">№ ${inv.invoiceNumber}</span>
                    </td>
                    <td>${dateDisplay}</td>
                    <td class="font-bold text-primary">${inv.customerName || '—'}</td>
                    <td dir="ltr" class="text-right">${inv.phone || '—'}</td>
                    <td><span class="badge-tag">${datesList || 'غير محدد'}</span></td>
                    <td>${inv.quantity || '—'}</td>
                    <td><span class="badge-tag work-tag">${worksList || 'غير محدد'}</span></td>
                    <td><span class="status-pill ${statusBadgeClass}"><span class="status-dot"></span>${inv.status || 'قيد الانتظار'}</span></td>
                    <td class="td-actions" onclick="event.stopPropagation();">
                        <button class="btn-icon btn-view" title="عرض الفاتورة كاملة" onclick="window.app.showInvoiceModalById('${inv.id}')">
                            👁️
                        </button>
                        <button class="btn-icon btn-edit" title="تعديل الفاتورة" onclick="window.invoiceManager.loadInvoiceForEdit('${inv.id}')">
                            ✏️
                        </button>
                        <button class="btn-icon btn-print" title="طباعة مباشرة" onclick="window.app.printInvoiceById('${inv.id}')">
                            🖨️
                        </button>
                        <button class="btn-icon btn-delete" title="حذف الفاتورة" onclick="window.app.confirmDeleteInvoice('${inv.id}', '${inv.invoiceNumber}')">
                            🗑️
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        // Bind row click to open full details modal
        tbody.querySelectorAll('.invoice-table-row').forEach(row => {
            row.addEventListener('click', () => {
                const id = row.getAttribute('data-id');
                if (id) window.app.showInvoiceModalById(id);
            });
        });

        // Render Pagination UI
        this.renderPagination(totalPages);
    }

    renderPagination(totalPages) {
        const container = document.getElementById('invoicesPagination');
        if (!container) return;

        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        let html = `
            <div class="pagination-wrapper">
                <button class="btn-page" ${this.currentPage === 1 ? 'disabled' : ''} onclick="window.searchManager.goToPage(${this.currentPage - 1})">
                    السابق
                </button>
                <span class="page-info">صفحة ${this.currentPage} من ${totalPages}</span>
                <button class="btn-page" ${this.currentPage === totalPages ? 'disabled' : ''} onclick="window.searchManager.goToPage(${this.currentPage + 1})">
                    التالي
                </button>
            </div>
        `;
        container.innerHTML = html;
    }

    goToPage(page) {
        this.currentPage = page;
        this.renderTable();
        const table = document.getElementById('invoicesTable');
        if (table) table.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

window.SearchManager = SearchManager;
