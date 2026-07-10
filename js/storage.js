/**
 * CAMPING DU LAC - OPSLAG MODULE
 *
 * Beheert alle gegevenspersistentie met browser localStorage.
 * Data blijft behouden na pagina-verversing maar wordt gewist bij browser data reset.
 */

const Storage = {
    // Get the storage key with prefix
    _key(name) {
        return APP_CONFIG.storagePrefix + name;
    },

    // ==========================================================================
    // GUEST TABS DATA STRUCTURE
    // ==========================================================================
    // Data is stored as:
    // {
    //     "Guest Name": {
    //         drinks: [
    //             { name: "Beer", price: 2.50, timestamp: 1234567890 },
    //             ...
    //         ],
    //         total: 12.50,
    //         paid: false
    //     },
    //     ...
    // }

    /**
     * Initialize storage with guest names from config or custom list.
     * Does not overwrite existing data.
     */
    init() {
        let tabs = this.getAllTabs();
        const guestList = this.getGuestList();

        // Add any new guests that don't exist yet
        guestList.forEach(name => {
            if (!tabs[name]) {
                tabs[name] = {
                    drinks: [],
                    total: 0,
                    paid: false
                };
            }
        });

        this._saveTabs(tabs);
        return tabs;
    },

    /**
     * Get all guest tabs from storage.
     */
    getAllTabs() {
        const data = localStorage.getItem(this._key('tabs'));
        if (data) {
            try {
                return JSON.parse(data);
            } catch (e) {
                console.error('Error parsing stored tabs:', e);
                return {};
            }
        }
        return {};
    },

    /**
     * Get a single guest's tab.
     */
    getGuestTab(guestName) {
        const tabs = this.getAllTabs();
        return tabs[guestName] || { drinks: [], total: 0, paid: false };
    },

    /**
     * Save all tabs to localStorage. Cloud sync happens per guest via
     * FirebaseSync (addDrinkToCloud etc.), never by pushing this whole object.
     */
    _saveTabs(tabs) {
        localStorage.setItem(this._key('tabs'), JSON.stringify(tabs));
    },

    /**
     * Add a drink to a guest's tab.
     * Returns the new drink entry with timestamp.
     */
    addDrink(guestName, drinkName, price) {
        const tabs = this.getAllTabs();

        if (!tabs[guestName]) {
            tabs[guestName] = { drinks: [], total: 0, paid: false };
        }

        // Don't allow adding drinks if guest has paid
        if (tabs[guestName].paid) {
            return null;
        }

        const drinkEntry = {
            name: drinkName,
            price: price,
            timestamp: Date.now(),
            id: this._generateId()
        };

        tabs[guestName].drinks.push(drinkEntry);
        tabs[guestName].total = this._calculateTotal(tabs[guestName].drinks);

        this._saveTabs(tabs);
        if (typeof FirebaseSync !== 'undefined') {
            FirebaseSync.addDrinkToCloud(guestName, drinkEntry);
        }
        return drinkEntry;
    },

    /**
     * Remove a specific drink from a guest's tab (for undo).
     * Only works if the drink ID matches.
     */
    removeDrink(guestName, drinkId) {
        const tabs = this.getAllTabs();

        if (!tabs[guestName]) {
            return false;
        }

        const index = tabs[guestName].drinks.findIndex(d => d.id === drinkId);
        if (index === -1) {
            return false;
        }

        tabs[guestName].drinks.splice(index, 1);
        tabs[guestName].total = this._calculateTotal(tabs[guestName].drinks);

        this._saveTabs(tabs);
        if (typeof FirebaseSync !== 'undefined') {
            FirebaseSync.removeDrinkFromCloud(guestName, drinkId);
        }
        return true;
    },

    /**
     * Mark a guest as paid (optionally with payment method 'cash' or 'card').
     */
    markAsPaid(guestName, paid = true, method = null) {
        const tabs = this.getAllTabs();

        if (tabs[guestName]) {
            tabs[guestName].paid = paid;
            tabs[guestName].paymentMethod = paid ? method : null;
            tabs[guestName].paidAt = paid ? Date.now() : null;
            this._saveTabs(tabs);
            if (typeof FirebaseSync !== 'undefined') {
                FirebaseSync.updateGuestFields(guestName, {
                    paid: tabs[guestName].paid,
                    paymentMethod: tabs[guestName].paymentMethod,
                    paidAt: tabs[guestName].paidAt
                });
            }
            return true;
        }
        return false;
    },

    /**
     * Calculate total from drinks array, summing in whole cents so
     * floating-point errors can't accumulate.
     */
    _calculateTotal(drinks) {
        const cents = drinks.reduce((sum, drink) => sum + Math.round((drink.price || 0) * 100), 0);
        return cents / 100;
    },

    /**
     * Generate a unique ID for drink entries.
     */
    _generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    },

    /**
     * Get summary statistics for admin view.
     */
    getSummary() {
        const tabs = this.getAllTabs();
        let revenueCents = 0;
        let paidCents = 0;
        let unpaidCents = 0;
        let paidCashCents = 0;
        let paidCardCents = 0;
        let guestCount = 0;
        let paidCount = 0;

        Object.keys(tabs).forEach(name => {
            const tab = tabs[name];
            if (tab.drinks.length > 0) {
                guestCount++;
                const cents = Math.round((tab.total || 0) * 100);
                revenueCents += cents;
                if (tab.paid) {
                    paidCount++;
                    paidCents += cents;
                    if (tab.paymentMethod === 'cash') paidCashCents += cents;
                    if (tab.paymentMethod === 'card') paidCardCents += cents;
                } else {
                    unpaidCents += cents;
                }
            }
        });

        return {
            totalRevenue: revenueCents / 100,
            totalPaid: paidCents / 100,
            totalUnpaid: unpaidCents / 100,
            totalPaidCash: paidCashCents / 100,
            totalPaidCard: paidCardCents / 100,
            guestCount,
            paidCount,
            unpaidCount: guestCount - paidCount
        };
    },

    /**
     * Export all data as CSV string.
     */
    exportCSV() {
        const tabs = this.getAllTabs();
        let csv = "Gast,Totaal (EUR),Betaald,Aantal\n";

        // Sort by name
        const sortedNames = Object.keys(tabs).sort();

        sortedNames.forEach(name => {
            const tab = tabs[name];
            if (tab.drinks.length > 0) {
                const total = tab.total.toFixed(2).replace('.', ',');
                const paid = tab.paid ? "Ja" : "Nee";
                csv += `"${name}",${total},${paid},${tab.drinks.length}\n`;
            }
        });

        return csv;
    },

    /**
     * Export detailed data as CSV string (including all drinks).
     */
    exportDetailedCSV() {
        const tabs = this.getAllTabs();
        let csv = "Gast,Item,Prijs (EUR),Datum/Tijd\n";

        const sortedNames = Object.keys(tabs).sort();

        sortedNames.forEach(name => {
            const tab = tabs[name];
            tab.drinks.forEach(drink => {
                const price = drink.price.toFixed(2).replace('.', ',');
                const date = new Date(drink.timestamp).toLocaleString(APP_CONFIG.locale);
                csv += `"${name}","${drink.name}",${price},"${date}"\n`;
            });
        });

        return csv;
    },

    /**
     * Clear all data (use with caution - for starting a new week).
     * Records the reset timestamp so other devices clear via the explicit
     * reset signal instead of interpreting it as data loss.
     */
    clearAll() {
        const resetAt = Date.now();
        localStorage.setItem(this._key('lastResetAt'), String(resetAt));
        localStorage.removeItem(this._key('tabs'));
        localStorage.removeItem(this._key('pendingOps'));
        // Also clear cloud data
        if (typeof FirebaseSync !== 'undefined' && FirebaseSync.isOnline) {
            FirebaseSync.clearAllData(resetAt);
        }
    },

    /**
     * Backup current data (returns JSON string).
     */
    backup() {
        return JSON.stringify(this.getAllTabs(), null, 2);
    },

    /**
     * Restore data from backup JSON string.
     * This is an intentional full replacement, locally and in the cloud.
     */
    restore(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            if (!data || typeof data !== 'object' || Array.isArray(data)) {
                return false;
            }
            this._saveTabs(data);
            if (typeof FirebaseSync !== 'undefined') {
                FirebaseSync.saveTabs(data);
            }
            return true;
        } catch (e) {
            console.error('Error restoring backup:', e);
            return false;
        }
    },

    // ==========================================================================
    // AUTOMATIC BACKUPS
    // ==========================================================================

    /**
     * Write today's automatic backup snapshot if it doesn't exist yet.
     * Keeps the newest 7 snapshots locally and mirrors them to the cloud.
     */
    autoBackup() {
        const tabs = this.getAllTabs();
        const hasData = Object.keys(tabs).some(name =>
            tabs[name] && tabs[name].drinks && tabs[name].drinks.length > 0);
        if (!hasData) return;

        const today = new Date().toISOString().slice(0, 10);
        const key = this._key('autoBackup_' + today);
        if (localStorage.getItem(key)) return;

        this.snapshotBackup(today, tabs);
    },

    /**
     * Write a named backup snapshot (also used for the pre-"Nieuwe Week" copy).
     */
    snapshotBackup(label, tabs = null) {
        const data = tabs || this.getAllTabs();
        try {
            localStorage.setItem(this._key('autoBackup_' + label), JSON.stringify(data));
        } catch (e) {
            console.error('Auto backup failed (storage full?):', e);
            return;
        }
        this._pruneAutoBackups();
        if (typeof FirebaseSync !== 'undefined') {
            FirebaseSync.saveDailyBackup(label, data);
        }
    },

    /**
     * List available automatic backups, newest first.
     */
    listAutoBackups() {
        const prefix = this._key('autoBackup_');
        const backups = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(prefix)) {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    let guestCount = 0;
                    let totalCents = 0;
                    Object.keys(data).forEach(name => {
                        if (data[name].drinks && data[name].drinks.length > 0) {
                            guestCount++;
                            totalCents += Math.round((data[name].total || 0) * 100);
                        }
                    });
                    backups.push({
                        key,
                        label: key.slice(prefix.length),
                        guestCount,
                        total: totalCents / 100
                    });
                } catch (e) {
                    // Skip corrupted snapshots
                }
            }
        }
        return backups.sort((a, b) => b.label.localeCompare(a.label));
    },

    _pruneAutoBackups(keep = 7) {
        const backups = this.listAutoBackups();
        backups.slice(keep).forEach(backup => localStorage.removeItem(backup.key));
    },

    // ==========================================================================
    // GUEST MANAGEMENT
    // ==========================================================================

    /**
     * Get the current guest list.
     * Returns custom list if exists, otherwise default from config.
     */
    getGuestList() {
        const custom = localStorage.getItem(this._key('customGuests'));
        if (custom) {
            try {
                return JSON.parse(custom);
            } catch (e) {
                return GUEST_NAMES;
            }
        }
        return GUEST_NAMES;
    },

    /**
     * Save a custom guest list and sync to cloud.
     */
    saveGuestList(guests) {
        localStorage.setItem(this._key('customGuests'), JSON.stringify(guests));
        // Sync to Firebase if available
        if (typeof FirebaseSync !== 'undefined' && FirebaseSync.isOnline) {
            FirebaseSync.saveGuestList(guests);
        }
    },

    /**
     * Add a new guest to the list.
     */
    addGuest(name) {
        const guests = this.getGuestList();
        if (!guests.includes(name)) {
            guests.push(name);
            this.saveGuestList(guests);
            // Also initialize their tab
            const tabs = this.getAllTabs();
            if (!tabs[name]) {
                tabs[name] = { drinks: [], total: 0, paid: false };
                this._saveTabs(tabs);
                if (typeof FirebaseSync !== 'undefined') {
                    FirebaseSync.saveGuestTab(name, tabs[name]);
                }
            }
            return true;
        }
        return false;
    },

    /**
     * Remove a guest from the list.
     * Only removes if they have no orders.
     */
    removeGuest(name) {
        const tab = this.getGuestTab(name);
        if (tab.drinks.length > 0) {
            return { success: false, reason: 'hasOrders' };
        }

        const guests = this.getGuestList();
        const index = guests.indexOf(name);
        if (index > -1) {
            guests.splice(index, 1);
            this.saveGuestList(guests);
            // Also remove their tab
            const tabs = this.getAllTabs();
            delete tabs[name];
            this._saveTabs(tabs);
            if (typeof FirebaseSync !== 'undefined') {
                FirebaseSync.removeGuestFromCloud(name);
            }
            return { success: true };
        }
        return { success: false, reason: 'notFound' };
    },

    /**
     * Import guests from CSV.
     * Returns number of guests added.
     */
    importGuestsFromCSV(csvText) {
        const lines = csvText.split(/[\r\n]+/).filter(line => line.trim());
        const guests = [];

        lines.forEach(line => {
            // Handle both comma and semicolon separated, and quoted values
            const name = line.replace(/["']/g, '').trim();
            if (name && name.length > 0) {
                guests.push(name);
            }
        });

        if (guests.length > 0) {
            this.saveGuestList(guests);
            this.init(); // Re-initialize tabs
            return guests.length;
        }
        return 0;
    },

    /**
     * Reset guest list to defaults from config.
     */
    resetGuestList() {
        localStorage.removeItem(this._key('customGuests'));
    },

    // ==========================================================================
    // MENU (categorieën + drankjes, bewerkbaar in Beheer)
    // ==========================================================================

    /**
     * Get the current menu: the saved custom menu if present, otherwise the
     * default from config. Coerces item lists back to arrays (Firebase can
     * return array-like objects).
     */
    getMenu() {
        const saved = localStorage.getItem(this._key('menu'));
        if (saved) {
            try {
                const menu = JSON.parse(saved);
                if (Array.isArray(menu) && menu.length > 0) {
                    return menu.map(category => ({
                        ...category,
                        items: Object.values(category.items || {})
                    }));
                }
            } catch (e) {
                console.error('Error parsing stored menu:', e);
            }
        }
        return DEFAULT_MENU;
    },

    /**
     * Save a custom menu and sync to cloud.
     */
    saveMenu(menu) {
        localStorage.setItem(this._key('menu'), JSON.stringify(menu));
        if (typeof FirebaseSync !== 'undefined') {
            FirebaseSync.saveMenu(menu);
        }
    },

    /**
     * Reset the menu to the default from config.
     */
    resetMenu() {
        localStorage.removeItem(this._key('menu'));
        if (typeof FirebaseSync !== 'undefined') {
            FirebaseSync.saveMenu(DEFAULT_MENU);
        }
    },

    // ==========================================================================
    // CATEGORY TOGGLES (Cocktails, Foodtruck, etc.)
    // ==========================================================================

    /**
     * Check if a toggleable category is enabled.
     */
    isCategoryEnabled(toggleKey) {
        const enabled = localStorage.getItem(this._key('category_' + toggleKey));
        return enabled === 'true';
    },

    /**
     * Enable or disable a toggleable category and sync to cloud.
     */
    setCategoryEnabled(toggleKey, enabled) {
        localStorage.setItem(this._key('category_' + toggleKey), enabled ? 'true' : 'false');
        // Sync to Firebase if available
        if (typeof FirebaseSync !== 'undefined' && FirebaseSync.isOnline) {
            FirebaseSync.saveCategoryToggle(toggleKey, enabled);
        }
    }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.Storage = Storage;
}
