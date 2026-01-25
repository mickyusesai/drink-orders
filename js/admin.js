/**
 * CAMPSITE HONESTY BAR - ADMIN MODULE
 *
 * Handles the organizer/admin view with overview, payments, and exports.
 */

const Admin = {
    /**
     * Render the admin view.
     */
    renderAdminView() {
        this.renderSummary();
        this.renderGuestTable();
    },

    /**
     * Render the summary statistics.
     */
    renderSummary() {
        const summary = Storage.getSummary();
        const container = document.getElementById('admin-summary');

        container.innerHTML = `
            <div class="summary-card">
                <div class="summary-value">${App.formatPrice(summary.totalRevenue)}</div>
                <div class="summary-label">Total Revenue</div>
            </div>
            <div class="summary-card paid">
                <div class="summary-value">${App.formatPrice(summary.totalPaid)}</div>
                <div class="summary-label">Paid (${summary.paidCount})</div>
            </div>
            <div class="summary-card unpaid">
                <div class="summary-value">${App.formatPrice(summary.totalUnpaid)}</div>
                <div class="summary-label">Unpaid (${summary.unpaidCount})</div>
            </div>
            <div class="summary-card">
                <div class="summary-value">${summary.guestCount}</div>
                <div class="summary-label">Guests with Tabs</div>
            </div>
        `;
    },

    /**
     * Render the guest table.
     */
    renderGuestTable() {
        const container = document.getElementById('admin-guests-table');
        const tabs = Storage.getAllTabs();

        // Sort: unpaid first, then by total descending
        const sortedGuests = Object.keys(tabs)
            .filter(name => tabs[name].drinks.length > 0)
            .sort((a, b) => {
                // Unpaid first
                if (tabs[a].paid !== tabs[b].paid) {
                    return tabs[a].paid ? 1 : -1;
                }
                // Then by total descending
                return tabs[b].total - tabs[a].total;
            });

        if (sortedGuests.length === 0) {
            container.innerHTML = '<p class="placeholder-text">No guests have ordered drinks yet.</p>';
            return;
        }

        let html = `
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Guest</th>
                        <th>Drinks</th>
                        <th>Total</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;

        sortedGuests.forEach(name => {
            const tab = tabs[name];
            const statusClass = tab.paid ? 'status-paid' : 'status-unpaid';
            const statusText = tab.paid ? 'Paid' : 'Unpaid';

            html += `
                <tr class="${tab.paid ? 'row-paid' : ''}">
                    <td class="guest-name-cell">${name}</td>
                    <td>${tab.drinks.length}</td>
                    <td class="total-cell">${App.formatPrice(tab.total)}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td class="actions-cell">
                        <button class="action-btn details-btn" onclick="Admin.showGuestDetails('${this.escapeHtml(name)}')">
                            Details
                        </button>
                        ${tab.paid
                            ? `<button class="action-btn unpaid-btn" onclick="Admin.togglePaid('${this.escapeHtml(name)}', false)">Mark Unpaid</button>`
                            : `<button class="action-btn paid-btn" onclick="Admin.togglePaid('${this.escapeHtml(name)}', true)">Mark Paid</button>`
                        }
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    },

    /**
     * Escape HTML special characters.
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML.replace(/'/g, "\\'");
    },

    /**
     * Toggle paid status for a guest.
     */
    togglePaid(guestName, paid) {
        Storage.markAsPaid(guestName, paid);
        this.renderAdminView();
        App.renderGuestButtons();
    },

    /**
     * Show detailed drink list for a guest.
     */
    showGuestDetails(guestName) {
        const tab = Storage.getGuestTab(guestName);
        const modal = document.getElementById('details-modal');
        const content = document.getElementById('details-content');

        let html = `
            <div class="modal-header">
                <h2>${guestName}</h2>
                ${tab.paid ? '<span class="paid-badge large">PAID</span>' : ''}
                <button class="close-btn" onclick="Admin.closeModal()">&times;</button>
            </div>
            <div class="modal-body">
        `;

        if (tab.drinks.length === 0) {
            html += '<p>No drinks on this tab.</p>';
        } else {
            html += '<table class="details-table"><thead><tr><th>Drink</th><th>Price</th><th>Time</th></tr></thead><tbody>';

            // Sort drinks by timestamp (newest first)
            const sortedDrinks = [...tab.drinks].sort((a, b) => b.timestamp - a.timestamp);

            sortedDrinks.forEach(drink => {
                const time = new Date(drink.timestamp).toLocaleString(APP_CONFIG.locale, {
                    weekday: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                html += `
                    <tr>
                        <td>${drink.name}</td>
                        <td>${App.formatPrice(drink.price)}</td>
                        <td>${time}</td>
                    </tr>
                `;
            });

            html += '</tbody></table>';
        }

        html += `
            </div>
            <div class="modal-footer">
                <div class="modal-total">Total: <strong>${App.formatPrice(tab.total)}</strong></div>
                ${tab.paid
                    ? `<button class="action-btn unpaid-btn" onclick="Admin.togglePaid('${this.escapeHtml(guestName)}', false); Admin.showGuestDetails('${this.escapeHtml(guestName)}');">Mark as Unpaid</button>`
                    : `<button class="action-btn paid-btn" onclick="Admin.togglePaid('${this.escapeHtml(guestName)}', true); Admin.showGuestDetails('${this.escapeHtml(guestName)}');">Mark as Paid</button>`
                }
            </div>
        `;

        content.innerHTML = html;
        modal.classList.add('show');
    },

    /**
     * Close the details modal.
     */
    closeModal() {
        document.getElementById('details-modal').classList.remove('show');
    },

    /**
     * Export summary as CSV.
     */
    exportCSV() {
        const csv = Storage.exportCSV();
        this.downloadFile(csv, 'honesty-bar-summary.csv', 'text/csv');
    },

    /**
     * Export detailed data as CSV.
     */
    exportDetailedCSV() {
        const csv = Storage.exportDetailedCSV();
        this.downloadFile(csv, 'honesty-bar-detailed.csv', 'text/csv');
    },

    /**
     * Show printable view.
     */
    showPrintView() {
        const tabs = Storage.getAllTabs();
        const summary = Storage.getSummary();

        // Sort guests
        const sortedGuests = Object.keys(tabs)
            .filter(name => tabs[name].drinks.length > 0)
            .sort((a, b) => {
                if (tabs[a].paid !== tabs[b].paid) return tabs[a].paid ? 1 : -1;
                return a.localeCompare(b);
            });

        let html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Honesty Bar - Weekly Summary</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
                    h1 { text-align: center; margin-bottom: 10px; }
                    .date { text-align: center; color: #666; margin-bottom: 30px; }
                    .summary { display: flex; justify-content: space-around; margin-bottom: 30px; padding: 15px; background: #f5f5f5; border-radius: 8px; }
                    .summary-item { text-align: center; }
                    .summary-value { font-size: 24px; font-weight: bold; }
                    .summary-label { font-size: 12px; color: #666; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                    th { background: #f0f0f0; }
                    .paid { color: green; }
                    .unpaid { color: #c00; font-weight: bold; }
                    .total { text-align: right; font-weight: bold; }
                    @media print { .no-print { display: none; } }
                </style>
            </head>
            <body>
                <h1>${APP_CONFIG.appTitle} - Weekly Summary</h1>
                <p class="date">Generated: ${new Date().toLocaleString(APP_CONFIG.locale)}</p>

                <div class="summary">
                    <div class="summary-item">
                        <div class="summary-value">${App.formatPrice(summary.totalRevenue)}</div>
                        <div class="summary-label">Total Revenue</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-value paid">${App.formatPrice(summary.totalPaid)}</div>
                        <div class="summary-label">Paid</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-value unpaid">${App.formatPrice(summary.totalUnpaid)}</div>
                        <div class="summary-label">Unpaid</div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Guest</th>
                            <th>Drinks</th>
                            <th>Total</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        sortedGuests.forEach(name => {
            const tab = tabs[name];
            html += `
                <tr>
                    <td>${name}</td>
                    <td>${tab.drinks.length}</td>
                    <td class="total">${App.formatPrice(tab.total)}</td>
                    <td class="${tab.paid ? 'paid' : 'unpaid'}">${tab.paid ? 'Paid' : 'UNPAID'}</td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>

                <button class="no-print" onclick="window.print()" style="padding: 10px 20px; font-size: 16px; cursor: pointer;">
                    Print This Page
                </button>
                <button class="no-print" onclick="window.close()" style="padding: 10px 20px; font-size: 16px; cursor: pointer; margin-left: 10px;">
                    Close
                </button>
            </body>
            </html>
        `;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(html);
        printWindow.document.close();
    },

    /**
     * Copy CSV to clipboard.
     */
    copyCSVToClipboard() {
        const csv = Storage.exportCSV();
        navigator.clipboard.writeText(csv).then(() => {
            alert('CSV copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy:', err);
            // Fallback: show in textarea
            this.showCSVTextarea(csv);
        });
    },

    /**
     * Show CSV in a textarea for manual copying.
     */
    showCSVTextarea(csv) {
        const modal = document.getElementById('details-modal');
        const content = document.getElementById('details-content');

        content.innerHTML = `
            <div class="modal-header">
                <h2>Export CSV</h2>
                <button class="close-btn" onclick="Admin.closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                <p>Select all and copy (Ctrl/Cmd+C):</p>
                <textarea class="csv-textarea" readonly onclick="this.select()">${csv}</textarea>
            </div>
        `;

        modal.classList.add('show');

        // Auto-select the text
        setTimeout(() => {
            document.querySelector('.csv-textarea').select();
        }, 100);
    },

    /**
     * Download a file.
     */
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    /**
     * Backup all data.
     */
    backupData() {
        const json = Storage.backup();
        this.downloadFile(json, 'honesty-bar-backup.json', 'application/json');
    },

    /**
     * Start a new week (clear all data).
     */
    startNewWeek() {
        const confirmed = confirm(
            'This will PERMANENTLY DELETE all guest tabs and payment data.\n\n' +
            'Make sure you have exported or printed the data first!\n\n' +
            'Are you sure you want to start a new week?'
        );

        if (confirmed) {
            const doubleConfirm = confirm(
                'FINAL WARNING: All data will be lost.\n\n' +
                'Click OK to confirm and start fresh.'
            );

            if (doubleConfirm) {
                Storage.clearAll();
                Storage.init();
                this.renderAdminView();
                App.renderGuestButtons();
                alert('New week started! All tabs have been cleared.');
            }
        }
    }
};

// Export for use in HTML onclick handlers
if (typeof window !== 'undefined') {
    window.Admin = Admin;
}
