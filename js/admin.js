/**
 * CAMPING DU LAC - BEHEERMODULE
 *
 * Functies voor het beheerders/organisator overzicht.
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
            <div class="summary-card total">
                <div class="summary-value">${App.formatPrice(summary.totalRevenue)}</div>
                <div class="summary-label">Totale Omzet</div>
            </div>
            <div class="summary-card paid">
                <div class="summary-value">${App.formatPrice(summary.totalPaid)}</div>
                <div class="summary-label">Betaald (${summary.paidCount})</div>
            </div>
            <div class="summary-card unpaid">
                <div class="summary-value">${App.formatPrice(summary.totalUnpaid)}</div>
                <div class="summary-label">Open (${summary.unpaidCount})</div>
            </div>
            <div class="summary-card guests">
                <div class="summary-value">${summary.guestCount}</div>
                <div class="summary-label">Gasten met Tab</div>
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
                if (tabs[a].paid !== tabs[b].paid) {
                    return tabs[a].paid ? 1 : -1;
                }
                return tabs[b].total - tabs[a].total;
            });

        if (sortedGuests.length === 0) {
            container.innerHTML = '<p class="placeholder-text">Nog geen gasten met bestellingen.</p>';
            return;
        }

        let html = `
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Gast</th>
                        <th>Aantal</th>
                        <th>Totaal</th>
                        <th>Status</th>
                        <th>Acties</th>
                    </tr>
                </thead>
                <tbody>
        `;

        sortedGuests.forEach(name => {
            const tab = tabs[name];
            const statusClass = tab.paid ? 'status-paid' : 'status-unpaid';
            const statusText = tab.paid ? 'Betaald' : 'Open';

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
                            ? `<button class="action-btn unpaid-btn" onclick="Admin.togglePaid('${this.escapeHtml(name)}', false)">Open</button>`
                            : `<button class="action-btn paid-btn" onclick="Admin.togglePaid('${this.escapeHtml(name)}', true)">Betaald</button>`
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
                ${tab.paid ? '<span class="paid-badge large">BETAALD</span>' : ''}
                <button class="close-btn" onclick="Admin.closeModal()">&times;</button>
            </div>
            <div class="modal-body">
        `;

        if (tab.drinks.length === 0) {
            html += '<p>Geen bestellingen voor deze gast.</p>';
        } else {
            html += '<table class="details-table"><thead><tr><th>Item</th><th>Prijs</th><th>Tijd</th></tr></thead><tbody>';

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
                <div class="modal-total">Totaal: <strong>${App.formatPrice(tab.total)}</strong></div>
                ${tab.paid
                    ? `<button class="action-btn unpaid-btn" onclick="Admin.togglePaid('${this.escapeHtml(guestName)}', false); Admin.showGuestDetails('${this.escapeHtml(guestName)}');">Markeer als Open</button>`
                    : `<button class="action-btn paid-btn" onclick="Admin.togglePaid('${this.escapeHtml(guestName)}', true); Admin.showGuestDetails('${this.escapeHtml(guestName)}');">Markeer als Betaald</button>`
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
        this.downloadFile(csv, 'honesty-bar-overzicht.csv', 'text/csv');
    },

    /**
     * Export detailed data as CSV.
     */
    exportDetailedCSV() {
        const csv = Storage.exportDetailedCSV();
        this.downloadFile(csv, 'honesty-bar-detail.csv', 'text/csv');
    },

    /**
     * Show printable view.
     */
    showPrintView() {
        const tabs = Storage.getAllTabs();
        const summary = Storage.getSummary();

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
                <title>${APP_CONFIG.appTitle} - Overzicht</title>
                <style>
                    body { font-family: 'Nunito', Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
                    h1 { text-align: center; margin-bottom: 5px; color: #1a4d1a; }
                    .subtitle { text-align: center; color: #666; margin-bottom: 30px; }
                    .summary { display: flex; justify-content: space-around; margin-bottom: 30px; padding: 20px; background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%); border-radius: 12px; }
                    .summary-item { text-align: center; }
                    .summary-value { font-size: 28px; font-weight: 700; color: #1a4d1a; }
                    .summary-label { font-size: 12px; color: #666; text-transform: uppercase; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                    th { background: #1a4d1a; color: white; }
                    .paid { color: #2e7d32; font-weight: 600; }
                    .unpaid { color: #c62828; font-weight: 700; }
                    .total { text-align: right; font-weight: bold; }
                    @media print { .no-print { display: none; } }
                </style>
            </head>
            <body>
                <h1>${APP_CONFIG.appTitle}</h1>
                <p class="subtitle">${APP_CONFIG.appSubtitle} - Weekoverzicht</p>
                <p style="text-align: center; color: #888; font-size: 14px;">Gegenereerd: ${new Date().toLocaleString(APP_CONFIG.locale)}</p>

                <div class="summary">
                    <div class="summary-item">
                        <div class="summary-value">${App.formatPrice(summary.totalRevenue)}</div>
                        <div class="summary-label">Totale Omzet</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-value paid">${App.formatPrice(summary.totalPaid)}</div>
                        <div class="summary-label">Betaald</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-value unpaid">${App.formatPrice(summary.totalUnpaid)}</div>
                        <div class="summary-label">Open</div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Gast</th>
                            <th>Aantal</th>
                            <th>Totaal</th>
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
                    <td class="${tab.paid ? 'paid' : 'unpaid'}">${tab.paid ? 'Betaald' : 'OPEN'}</td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>

                <div class="no-print" style="text-align: center; margin-top: 30px;">
                    <button onclick="window.print()" style="padding: 12px 24px; font-size: 16px; cursor: pointer; background: #1a4d1a; color: white; border: none; border-radius: 8px; margin-right: 10px;">
                        Printen
                    </button>
                    <button onclick="window.close()" style="padding: 12px 24px; font-size: 16px; cursor: pointer; background: #666; color: white; border: none; border-radius: 8px;">
                        Sluiten
                    </button>
                </div>
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
            alert('CSV gekopieerd naar klembord!');
        }).catch(err => {
            console.error('Kopiëren mislukt:', err);
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
                <h2>Exporteer CSV</h2>
                <button class="close-btn" onclick="Admin.closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                <p>Selecteer alles en kopieer (Ctrl/Cmd+C):</p>
                <textarea class="csv-textarea" readonly onclick="this.select()">${csv}</textarea>
            </div>
        `;

        modal.classList.add('show');

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
            'Dit zal ALLE gasten tabs en betalingsgegevens PERMANENT VERWIJDEREN.\n\n' +
            'Zorg ervoor dat je de gegevens eerst hebt geëxporteerd of geprint!\n\n' +
            'Weet je zeker dat je een nieuwe week wilt starten?'
        );

        if (confirmed) {
            const doubleConfirm = confirm(
                'LAATSTE WAARSCHUWING: Alle gegevens gaan verloren.\n\n' +
                'Klik OK om te bevestigen en opnieuw te beginnen.'
            );

            if (doubleConfirm) {
                Storage.clearAll();
                Storage.init();
                this.renderAdminView();
                App.renderGuestButtons();
                alert('Nieuwe week gestart! Alle tabs zijn gewist.');
            }
        }
    }
};

// Export for use in HTML onclick handlers
if (typeof window !== 'undefined') {
    window.Admin = Admin;
}
