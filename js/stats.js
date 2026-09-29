/**
 * Date Receipt Invoice Management System - Dashboard & Analytics
 * لوحة التحكم والمؤشرات الإحصائية ورسوم البيانات
 */

class StatsManager {
    constructor() {
        this.period = 'all'; // 'today', 'week', 'month', 'year', 'all'
    }

    init() {
        const periodSelect = document.getElementById('statsPeriodFilter');
        if (periodSelect) {
            periodSelect.addEventListener('change', (e) => {
                this.period = e.target.value;
                this.updateStats();
            });
        }
        this.updateStats();
    }

    async updateStats() {
        const allInvoices = await window.db.getAllInvoices();
        const filtered = this.filterByPeriod(allInvoices, this.period);

        // Calculate KPI values
        const totalCount = allInvoices.length;
        const periodCount = filtered.length;

        // Today & Month Counts
        const todayStr = new Date().toISOString().split('T')[0];
        const currentMonthPrefix = todayStr.substring(0, 7); // YYYY-MM
        
        const todayCount = allInvoices.filter(x => x.date === todayStr).length;
        const monthCount = allInvoices.filter(x => x.date && x.date.startsWith(currentMonthPrefix)).length;

        // Date Types frequency
        const dateTypeCounts = {};
        filtered.forEach(inv => {
            (inv.dateTypes || []).forEach(dt => {
                dateTypeCounts[dt] = (dateTypeCounts[dt] || 0) + 1;
            });
        });

        // Work Types frequency
        const workTypeCounts = {};
        filtered.forEach(inv => {
            (inv.workTypes || []).forEach(wt => {
                workTypeCounts[wt] = (workTypeCounts[wt] || 0) + 1;
            });
        });

        // Status Counts
        const statusCounts = {};
        filtered.forEach(inv => {
            const st = inv.status || 'قيد الانتظار';
            statusCounts[st] = (statusCounts[st] || 0) + 1;
        });

        // Update KPI Cards in UI
        this.setElementText('statTotalInvoices', totalCount);
        this.setElementText('statPeriodInvoices', periodCount);
        this.setElementText('statTodayInvoices', todayCount);
        this.setElementText('statMonthInvoices', monthCount);

        // Render Bar Charts
        this.renderHorizontalBarChart('chartTopDates', dateTypeCounts, 'نوع تمر');
        this.renderHorizontalBarChart('chartTopWorks', workTypeCounts, 'نوع عمل');
        this.renderStatusPillsSummary('chartStatusSummary', statusCounts, periodCount);
    }

    filterByPeriod(invoices, period) {
        if (period === 'all') return invoices;

        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        return invoices.filter(inv => {
            if (!inv.date) return false;
            const invDate = new Date(inv.date);

            switch (period) {
                case 'today':
                    return inv.date === todayStr;
                case 'week': {
                    const diffDays = (now - invDate) / (1000 * 60 * 60 * 24);
                    return diffDays >= 0 && diffDays <= 7;
                }
                case 'month': {
                    return inv.date.startsWith(todayStr.substring(0, 7));
                }
                case 'year': {
                    return inv.date.startsWith(todayStr.substring(0, 4));
                }
                default:
                    return true;
            }
        });
    }

    setElementText(id, text) {
        const el = document.getElementById(id);
        if (el) el.innerText = text;
    }

    renderHorizontalBarChart(containerId, dataObj, labelSuffix = '') {
        const container = document.getElementById(containerId);
        if (!container) return;

        const entries = Object.entries(dataObj).sort((a, b) => b[1] - a[1]);
        if (entries.length === 0) {
            container.innerHTML = '<div class="empty-chart-text">لا توجد بيانات مسجلة في هذه الفترة</div>';
            return;
        }

        const maxVal = entries[0][1] || 1;

        let html = '<div class="custom-bar-chart">';
        entries.slice(0, 6).forEach(([label, count]) => {
            const percentage = Math.round((count / maxVal) * 100);
            html += `
                <div class="bar-chart-row">
                    <div class="bar-label">${label}</div>
                    <div class="bar-track">
                        <div class="bar-fill" style="width: ${percentage}%"></div>
                    </div>
                    <div class="bar-value">${count}</div>
                </div>
            `;
        });
        html += '</div>';

        container.innerHTML = html;
    }

    renderStatusPillsSummary(containerId, statusCounts, total) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (total === 0) {
            container.innerHTML = '<div class="empty-chart-text">لا توجد بيانات مسجلة</div>';
            return;
        }

        const statuses = [
            { label: 'قيد الانتظار', color: '#6b7280' },
            { label: 'جاري المعالجة', color: '#f59e0b' },
            { label: 'جاهز للاستلام', color: '#10b981' },
            { label: 'تم التسليم', color: '#3b82f6' }
        ];

        let html = '<div class="status-summary-grid">';
        statuses.forEach(s => {
            const count = statusCounts[s.label] || 0;
            const percent = Math.round((count / total) * 100) || 0;
            html += `
                <div class="status-summary-card">
                    <div class="status-circle" style="background-color: ${s.color};"></div>
                    <div class="status-text-block">
                        <span class="status-name">${s.label}</span>
                        <strong class="status-count">${count} <small>(${percent}%)</small></strong>
                    </div>
                </div>
            `;
        });
        html += '</div>';

        container.innerHTML = html;
    }
}

window.StatsManager = StatsManager;
