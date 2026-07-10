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
        this.renderCategoryToggles();
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
            html += '<table class="details-table"><thead><tr><th>Item</th><th>Prijs</th><th>Tijd</th><th>Actie</th></tr></thead><tbody>';

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
                        <td>
                            <button class="remove-drink-btn" onclick="Admin.removeDrinkFromGuest('${this.escapeHtml(guestName)}', '${drink.id}')" title="Verwijder">-</button>
                        </td>
                    </tr>
                `;
            });

            html += '</tbody></table>';
        }

        // Add drink section
        html += `
            <div class="add-drink-section">
                <h4>Drankje toevoegen</h4>
                <div class="add-drink-controls">
                    <select id="admin-drink-select" class="admin-drink-select">
                        <option value="">-- Kies drankje --</option>
        `;

        DRINK_CATEGORIES.forEach(category => {
            category.items.forEach(item => {
                // Handle both string items (fixed price) and object items (individual price)
                const itemName = typeof item === 'string' ? item : item.name;
                const itemPrice = typeof item === 'string' ? category.price : item.price;
                html += `<option value="${itemName}|${itemPrice}">${itemName} (${App.formatPrice(itemPrice)})</option>`;
            });
        });

        html += `
                    </select>
                    <button class="add-drink-btn" onclick="Admin.addDrinkToGuest('${this.escapeHtml(guestName)}')">+</button>
                </div>
            </div>
        `;

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
     * Add a drink to a guest from admin view.
     */
    addDrinkToGuest(guestName) {
        const select = document.getElementById('admin-drink-select');
        if (!select.value) return;

        const [drinkName, priceStr] = select.value.split('|');
        const price = parseFloat(priceStr);

        Storage.addDrink(guestName, drinkName, price);
        this.renderAdminView();
        App.renderGuestButtons();
        this.showGuestDetails(guestName);
    },

    /**
     * Remove a specific drink from a guest.
     */
    removeDrinkFromGuest(guestName, drinkId) {
        if (!confirm('Weet je zeker dat je dit item wilt verwijderen?')) {
            return;
        }
        Storage.removeDrink(guestName, drinkId);
        this.renderAdminView();
        App.renderGuestButtons();
        this.showGuestDetails(guestName);
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
     * Automatically creates a backup first.
     */
    startNewWeek() {
        const confirmed = confirm(
            'Dit zal ALLE gasten tabs en betalingsgegevens PERMANENT VERWIJDEREN.\n\n' +
            'Er wordt automatisch een backup gemaakt voordat de gegevens worden gewist.\n\n' +
            'Weet je zeker dat je een nieuwe week wilt starten?'
        );

        if (confirmed) {
            const doubleConfirm = confirm(
                'LAATSTE WAARSCHUWING: Alle gegevens gaan verloren.\n\n' +
                'Klik OK om automatisch een backup te downloaden en opnieuw te beginnen.'
            );

            if (doubleConfirm) {
                // Auto-backup before clearing
                const timestamp = new Date().toISOString().slice(0, 10);
                const json = Storage.backup();
                this.downloadFile(json, `honesty-bar-backup-${timestamp}.json`, 'application/json');
                Storage.snapshotBackup(`${timestamp}-weekafsluiting`);

                // Clear and reinitialize
                Storage.clearAll();
                Storage.init();
                this.renderAdminView();
                App.renderGuestButtons();
                alert('Backup gedownload en nieuwe week gestart! Alle tabs zijn gewist.');
            }
        }
    },

    /**
     * Show restore dialog.
     */
    showRestoreDialog() {
        const modal = document.getElementById('details-modal');
        const content = document.getElementById('details-content');
        const autoBackups = Storage.listAutoBackups();

        let autoBackupsHtml = '<p class="placeholder-text">Nog geen automatische backups.</p>';
        if (autoBackups.length > 0) {
            autoBackupsHtml = autoBackups.map(backup => `
                <div class="auto-backup-item">
                    <span class="auto-backup-label">${backup.label}</span>
                    <span class="auto-backup-info">${backup.guestCount} gasten · ${App.formatPrice(backup.total)}</span>
                    <button class="action-btn details-btn" onclick="Admin.restoreAutoBackup('${backup.key}')">Herstel</button>
                </div>
            `).join('');
        }

        content.innerHTML = `
            <div class="modal-header">
                <h2>Backup Herstellen</h2>
                <button class="close-btn" onclick="Admin.closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                <p class="restore-warning">⚠️ Let op: Dit zal alle huidige gegevens overschrijven!</p>
                <h4>Automatische backups</h4>
                <p class="toggle-hint">De app bewaart automatisch een dagelijkse kopie (laatste 7).</p>
                <div class="auto-backup-list">${autoBackupsHtml}</div>
                <h4>Backup bestand</h4>
                <div class="restore-upload">
                    <label for="backup-file" class="upload-label">Selecteer backup bestand:</label>
                    <input type="file" id="backup-file" accept=".json" class="file-input" onchange="Admin.handleBackupFile(event)">
                </div>
                <div id="restore-preview" class="restore-preview"></div>
            </div>
        `;

        modal.classList.add('show');
    },

    /**
     * Restore one of the automatic backup snapshots.
     */
    restoreAutoBackup(storageKey) {
        const json = localStorage.getItem(storageKey);
        if (!json) {
            alert('Backup niet gevonden.');
            return;
        }

        const confirmed = confirm('Weet je zeker dat je deze automatische backup wilt herstellen? Alle huidige gegevens worden overschreven.');
        if (!confirmed) return;

        if (Storage.restore(json)) {
            this.closeModal();
            this.renderAdminView();
            App.renderGuestButtons();
            alert('Backup succesvol hersteld!');
        } else {
            alert('Fout bij het herstellen van de backup.');
        }
    },

    /**
     * Handle backup file selection.
     */
    handleBackupFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                const preview = document.getElementById('restore-preview');

                // Count guests with orders
                let guestCount = 0;
                let totalAmount = 0;
                Object.keys(data).forEach(name => {
                    if (data[name].drinks && data[name].drinks.length > 0) {
                        guestCount++;
                        totalAmount += data[name].total || 0;
                    }
                });

                preview.innerHTML = `
                    <div class="preview-info">
                        <p><strong>Backup bevat:</strong></p>
                        <p>${guestCount} gasten met bestellingen</p>
                        <p>Totale omzet: ${App.formatPrice(totalAmount)}</p>
                    </div>
                    <button class="action-btn paid-btn restore-btn" onclick="Admin.confirmRestore()">Herstellen</button>
                `;

                // Store data temporarily
                this._pendingRestore = e.target.result;
            } catch (err) {
                const preview = document.getElementById('restore-preview');
                preview.innerHTML = '<p class="error-text">Ongeldig backup bestand!</p>';
            }
        };
        reader.readAsText(file);
    },

    /**
     * Confirm and perform restore.
     */
    confirmRestore() {
        if (!this._pendingRestore) return;

        const confirmed = confirm('Weet je zeker dat je deze backup wilt herstellen? Alle huidige gegevens worden overschreven.');

        if (confirmed) {
            const success = Storage.restore(this._pendingRestore);
            if (success) {
                this._pendingRestore = null;
                this.closeModal();
                this.renderAdminView();
                App.renderGuestButtons();
                alert('Backup succesvol hersteld!');
            } else {
                alert('Fout bij het herstellen van de backup.');
            }
        }
    },

    // ==========================================================================
    // GUEST MANAGEMENT
    // ==========================================================================

    /**
     * Add a new guest.
     */
    addNewGuest() {
        const input = document.getElementById('new-guest-name');
        const name = input.value.trim();

        if (!name) {
            alert('Voer een naam in.');
            return;
        }

        const success = Storage.addGuest(name);
        if (success) {
            input.value = '';
            App.renderGuestButtons();
            alert(`"${name}" toegevoegd aan de gastenlijst.`);
        } else {
            alert(`"${name}" bestaat al in de gastenlijst.`);
        }
    },

    /**
     * Import guests from CSV file.
     */
    importGuestsCSV(event) {
        const file = event.target.files[0];
        if (!file) return;

        const confirmed = confirm(
            'Dit zal de huidige gastenlijst VERVANGEN met de namen uit het CSV bestand.\n\n' +
            'Bestaande bestellingen blijven behouden.\n\n' +
            'Doorgaan?'
        );

        if (!confirmed) {
            event.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const count = Storage.importGuestsFromCSV(e.target.result);
            if (count > 0) {
                App.renderGuestButtons();
                alert(`${count} gasten geïmporteerd uit CSV.`);
            } else {
                alert('Geen geldige namen gevonden in het bestand.');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    },

    /**
     * Show guest list manager modal.
     */
    showGuestListManager() {
        const modal = document.getElementById('details-modal');
        const content = document.getElementById('details-content');
        const guestList = Storage.getGuestList();
        const tabs = Storage.getAllTabs();

        let html = `
            <div class="modal-header">
                <h2>Gastenlijst Bewerken</h2>
                <button class="close-btn" onclick="Admin.closeModal()">&times;</button>
            </div>
            <div class="modal-body guest-list-manager">
                <p class="manager-hint">Klik op de X om een gast te verwijderen. Gasten met bestellingen kunnen niet worden verwijderd.</p>
                <div class="guest-list-items">
        `;

        guestList.forEach(name => {
            const tab = tabs[name];
            const hasOrders = tab && tab.drinks && tab.drinks.length > 0;

            html += `
                <div class="guest-list-item ${hasOrders ? 'has-orders' : ''}">
                    <span class="guest-list-name">${name}</span>
                    ${hasOrders
                        ? `<span class="guest-orders-badge">${tab.drinks.length} items</span>`
                        : `<button class="remove-guest-btn" onclick="Admin.removeGuest('${this.escapeHtml(name)}')">&times;</button>`
                    }
                </div>
            `;
        });

        html += `
                </div>
                <div class="manager-actions">
                    <button class="export-btn danger" onclick="Admin.resetGuestListToDefault()">Reset naar Standaard</button>
                </div>
            </div>
        `;

        content.innerHTML = html;
        modal.classList.add('show');
    },

    /**
     * Remove a guest from the list.
     */
    removeGuest(name) {
        const result = Storage.removeGuest(name);
        if (result.success) {
            App.renderGuestButtons();
            this.showGuestListManager(); // Refresh the modal
        } else if (result.reason === 'hasOrders') {
            alert(`"${name}" kan niet worden verwijderd omdat er bestellingen zijn.`);
        }
    },

    /**
     * Reset guest list to default from config.
     */
    resetGuestListToDefault() {
        const confirmed = confirm('Weet je zeker dat je de gastenlijst wilt resetten naar de standaardlijst? Bestaande bestellingen blijven behouden.');
        if (confirmed) {
            Storage.resetGuestList();
            Storage.init();
            App.renderGuestButtons();
            this.showGuestListManager();
            alert('Gastenlijst gereset naar standaard.');
        }
    },

    // ==========================================================================
    // CATEGORY TOGGLES (Cocktails, Foodtruck)
    // ==========================================================================

    /**
     * Toggle a category on/off.
     */
    toggleCategory(toggleKey) {
        const currentState = Storage.isCategoryEnabled(toggleKey);
        Storage.setCategoryEnabled(toggleKey, !currentState);
        App.renderDrinkButtons();
        this.renderCategoryToggles();
    },

    /**
     * Render category toggle switches.
     */
    renderCategoryToggles() {
        const container = document.getElementById('category-toggles');
        if (!container) return;

        let html = '';

        DRINK_CATEGORIES.forEach(category => {
            if (category.toggleKey) {
                const isEnabled = Storage.isCategoryEnabled(category.toggleKey);
                html += `
                    <div class="toggle-item">
                        <span class="toggle-label">${category.name}</span>
                        <button class="toggle-btn ${isEnabled ? 'active' : ''}" onclick="Admin.toggleCategory('${category.toggleKey}')">
                            ${isEnabled ? 'AAN' : 'UIT'}
                        </button>
                    </div>
                `;
            }
        });

        container.innerHTML = html;
    },

    // ==========================================================================
    // RECEPTIE - Add items for guests
    // ==========================================================================

    /**
     * Show receptie modal to add items for a guest.
     */
    showReceptieModal() {
        const modal = document.getElementById('details-modal');
        const content = document.getElementById('details-content');
        const guestList = Storage.getGuestList();

        let html = `
            <div class="modal-header">
                <h2>Receptie Toevoegen</h2>
                <button class="close-btn" onclick="Admin.closeModal()">&times;</button>
            </div>
            <div class="modal-body receptie-modal">
                <div class="receptie-guest-select">
                    <label>Selecteer gast:</label>
                    <select id="receptie-guest" class="admin-drink-select">
                        <option value="">-- Kies gast --</option>
        `;

        guestList.forEach(name => {
            html += `<option value="${this.escapeHtml(name)}">${name}</option>`;
        });

        html += `
                    </select>
                </div>

                <div class="receptie-items">
                    <h4>Kies item:</h4>

                    <div class="receptie-item-row">
                        <span class="receptie-item-name">IJsje</span>
                        <div class="receptie-item-controls">
                            <input type="number" id="receptie-ijsje-price" class="receptie-price-input" value="2.00" step="0.50" min="0">
                            <button class="add-drink-btn" onclick="Admin.addReceptieItem('IJsje', 'receptie-ijsje-price')">+</button>
                        </div>
                    </div>

                    <div class="receptie-item-row">
                        <span class="receptie-item-name">Watersport verhuur</span>
                        <div class="receptie-item-controls">
                            <input type="number" id="receptie-watersport-price" class="receptie-price-input" value="10.00" step="1.00" min="0">
                            <button class="add-drink-btn" onclick="Admin.addReceptieItem('Watersport verhuur', 'receptie-watersport-price')">+</button>
                        </div>
                    </div>

                    <div class="receptie-item-row receptie-custom">
                        <div class="receptie-custom-name">
                            <label>Anders, namelijk:</label>
                            <input type="text" id="receptie-custom-name" class="receptie-name-input" placeholder="Omschrijving...">
                        </div>
                        <div class="receptie-item-controls">
                            <input type="number" id="receptie-custom-price" class="receptie-price-input" value="5.00" step="0.50" min="0">
                            <button class="add-drink-btn" onclick="Admin.addReceptieCustomItem()">+</button>
                        </div>
                    </div>
                </div>

                <div id="receptie-feedback" class="receptie-feedback"></div>
            </div>
        `;

        content.innerHTML = html;
        modal.classList.add('show');
    },

    /**
     * Add a receptie item to a guest.
     */
    addReceptieItem(itemName, priceInputId) {
        const guestSelect = document.getElementById('receptie-guest');
        const priceInput = document.getElementById(priceInputId);
        const feedback = document.getElementById('receptie-feedback');

        if (!guestSelect.value) {
            feedback.innerHTML = '<span class="error-text">Selecteer eerst een gast!</span>';
            return;
        }

        const price = parseFloat(priceInput.value);
        if (isNaN(price) || price < 0) {
            feedback.innerHTML = '<span class="error-text">Ongeldige prijs!</span>';
            return;
        }

        Storage.addDrink(guestSelect.value, itemName, price);
        this.renderAdminView();
        App.renderGuestButtons();

        feedback.innerHTML = `<span class="success-text">✓ ${itemName} (${App.formatPrice(price)}) toegevoegd voor ${guestSelect.value}</span>`;

        setTimeout(() => {
            feedback.innerHTML = '';
        }, 3000);
    },

    /**
     * Add a custom receptie item.
     */
    addReceptieCustomItem() {
        const guestSelect = document.getElementById('receptie-guest');
        const nameInput = document.getElementById('receptie-custom-name');
        const priceInput = document.getElementById('receptie-custom-price');
        const feedback = document.getElementById('receptie-feedback');

        if (!guestSelect.value) {
            feedback.innerHTML = '<span class="error-text">Selecteer eerst een gast!</span>';
            return;
        }

        const itemName = nameInput.value.trim();
        if (!itemName) {
            feedback.innerHTML = '<span class="error-text">Voer een omschrijving in!</span>';
            return;
        }

        const price = parseFloat(priceInput.value);
        if (isNaN(price) || price < 0) {
            feedback.innerHTML = '<span class="error-text">Ongeldige prijs!</span>';
            return;
        }

        Storage.addDrink(guestSelect.value, itemName, price);
        this.renderAdminView();
        App.renderGuestButtons();

        feedback.innerHTML = `<span class="success-text">✓ ${itemName} (${App.formatPrice(price)}) toegevoegd voor ${guestSelect.value}</span>`;
        nameInput.value = '';

        setTimeout(() => {
            feedback.innerHTML = '';
        }, 3000);
    }
};

// Export for use in HTML onclick handlers
if (typeof window !== 'undefined') {
    window.Admin = Admin;
}
