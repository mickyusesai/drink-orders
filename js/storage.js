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
     * Save all tabs to storage.
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
        return true;
    },

    /**
     * Mark a guest as paid.
     */
    markAsPaid(guestName, paid = true) {
        const tabs = this.getAllTabs();

        if (tabs[guestName]) {
            tabs[guestName].paid = paid;
            this._saveTabs(tabs);
            return true;
        }
        return false;
    },

    /**
     * Calculate total from drinks array.
     */
    _calculateTotal(drinks) {
        return drinks.reduce((sum, drink) => sum + drink.price, 0);
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
        let totalRevenue = 0;
        let totalPaid = 0;
        let totalUnpaid = 0;
        let guestCount = 0;
        let paidCount = 0;

        Object.keys(tabs).forEach(name => {
            const tab = tabs[name];
            if (tab.drinks.length > 0) {
                guestCount++;
                totalRevenue += tab.total;
                if (tab.paid) {
                    paidCount++;
                    totalPaid += tab.total;
                } else {
                    totalUnpaid += tab.total;
                }
            }
        });

        return {
            totalRevenue,
            totalPaid,
            totalUnpaid,
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
     */
    clearAll() {
        localStorage.removeItem(this._key('tabs'));
    },

    /**
     * Backup current data (returns JSON string).
     */
    backup() {
        return JSON.stringify(this.getAllTabs(), null, 2);
    },

    /**
     * Restore data from backup JSON string.
     */
    restore(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            localStorage.setItem(this._key('tabs'), JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('Error restoring backup:', e);
            return false;
        }
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
     * Save a custom guest list.
     */
    saveGuestList(guests) {
        localStorage.setItem(this._key('customGuests'), JSON.stringify(guests));
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
    }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.Storage = Storage;
}
