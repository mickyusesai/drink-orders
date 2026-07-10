/**
 * CAMPING DU LAC - FIREBASE SYNC
 *
 * Real-time database synchronization for multi-device support.
 *
 * Sync model:
 * - Guest tabs live under 'tabs/<encodedGuestName>' and are written per guest,
 *   with drink add/remove done in transactions (idempotent by drink id), so
 *   multiple devices can order at the same time without overwriting each other.
 * - An empty cloud snapshot never wipes non-empty local data; intentional
 *   resets ("Nieuwe Week") propagate via the 'meta/resetAt' timestamp instead.
 * - Writes made while offline are queued in localStorage ('pendingOps') and
 *   replayed in order on reconnect.
 */

const FirebaseSync = {
    db: null,
    isOnline: false,
    _replaying: false,

    /**
     * Initialize Firebase connection.
     */
    async init() {
        try {
            // Firebase config
            const firebaseConfig = {
                apiKey: "AIzaSyAqY6gsk6jUuROt-xu9So27ennqIKMDuXE",
                authDomain: "camping-honesty-bar.firebaseapp.com",
                databaseURL: "https://camping-honesty-bar-default-rtdb.europe-west1.firebasedatabase.app",
                projectId: "camping-honesty-bar",
                storageBucket: "camping-honesty-bar.firebasestorage.app",
                messagingSenderId: "968238239099",
                appId: "1:968238239099:web:2977a587ad307c7f0901de"
            };

            // Initialize Firebase
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }

            this.db = firebase.database();
            this.isOnline = true;

            // Set up real-time listeners
            this.setupRealtimeListeners();

            // Sync local data to cloud on first connect
            this.syncLocalToCloud();

            console.log('Firebase connected successfully');
            this.showSyncStatus('online');

        } catch (error) {
            console.error('Firebase init error:', error);
            this.isOnline = false;
            this.showSyncStatus('offline');
        }
    },

    /**
     * Firebase keys may not contain . # $ / [ ] — sanitize guest names for
     * use as child keys. The display name is kept in the tab's 'name' field.
     */
    encodeGuestKey(name) {
        return String(name).replace(/[.#$/\[\]]/g, '_');
    },

    _tabRef(guestName) {
        return this.db.ref('tabs/' + this.encodeGuestKey(guestName));
    },

    /**
     * Recalculate a total in whole cents to avoid float drift.
     */
    _totalOf(drinks) {
        return Math.round(drinks.reduce((sum, d) => sum + Math.round((d && d.price || 0) * 100), 0)) / 100;
    },

    /**
     * Normalize a tab coming from the cloud: transactions can turn the drinks
     * array into an array-like object, so coerce it back.
     */
    _normalizeTab(tab, fallbackName) {
        const drinks = Object.values((tab && tab.drinks) || {}).filter(d => d && d.id);
        return {
            drinks: drinks,
            total: this._totalOf(drinks),
            paid: !!(tab && tab.paid),
            paymentMethod: (tab && tab.paymentMethod) || null,
            paidAt: (tab && tab.paidAt) || null,
            name: (tab && tab.name) || fallbackName
        };
    },

    /**
     * Show sync status indicator.
     */
    showSyncStatus(status) {
        let indicator = document.getElementById('sync-status');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'sync-status';
            document.body.appendChild(indicator);
        }

        if (status === 'online') {
            indicator.className = 'sync-status online';
            indicator.innerHTML = '&#x2713; Gesynchroniseerd';
            setTimeout(() => indicator.classList.add('hidden'), 3000);
        } else if (status === 'syncing') {
            indicator.className = 'sync-status syncing';
            indicator.innerHTML = '&#x21bb; Synchroniseren...';
            indicator.classList.remove('hidden');
        } else {
            indicator.className = 'sync-status offline';
            indicator.innerHTML = '&#x2717; Offline modus';
            indicator.classList.remove('hidden');
        }
    },

    _rerender() {
        if (typeof App !== 'undefined' && App.renderGuestButtons) {
            App.renderGuestButtons();
        }
        if (typeof Admin !== 'undefined' && Admin.renderAdminView &&
            document.getElementById('admin-view')?.classList.contains('active')) {
            Admin.renderAdminView();
        }
    },

    /**
     * Set up real-time listeners for data changes.
     */
    setupRealtimeListeners() {
        if (!this.db) return;

        // Listen for tabs (orders) changes
        this.db.ref('tabs').on('value', (snapshot) => {
            const cloudData = snapshot.val();

            // Don't apply cloud snapshots while local writes are still queued —
            // the replay will trigger a fresh snapshot afterwards.
            if (this._getQueue().length > 0) return;

            const localTabs = JSON.parse(localStorage.getItem(APP_CONFIG.storagePrefix + 'tabs') || '{}');
            const normalized = {};
            if (cloudData) {
                Object.keys(cloudData).forEach(key => {
                    const tab = this._normalizeTab(cloudData[key], key);
                    normalized[tab.name] = tab;
                });
            }

            // Never let an empty cloud wipe non-empty local data. Intentional
            // clears ("Nieuwe Week") arrive via the meta/resetAt listener.
            const localHasData = Object.keys(localTabs).some(n =>
                localTabs[n] && localTabs[n].drinks && localTabs[n].drinks.length > 0);
            if (Object.keys(normalized).length === 0 && localHasData) return;

            // Keep locally seeded (empty) guests that the cloud doesn't know yet
            Object.keys(localTabs).forEach(name => {
                if (!normalized[name]) {
                    const localTab = localTabs[name];
                    if (!localTab || !localTab.drinks || localTab.drinks.length === 0) {
                        normalized[name] = localTab;
                    }
                }
            });

            localStorage.setItem(APP_CONFIG.storagePrefix + 'tabs', JSON.stringify(normalized));
            this._rerender();
        });

        // Listen for the explicit reset signal (Nieuwe Week)
        this.db.ref('meta/resetAt').on('value', (snapshot) => {
            const resetAt = snapshot.val();
            if (!resetAt) return;

            const localKey = APP_CONFIG.storagePrefix + 'lastResetAt';
            const localResetAt = parseInt(localStorage.getItem(localKey) || '0', 10);

            if (!localResetAt) {
                // First time this device sees the signal (fresh install or
                // upgrade): adopt the value without clearing anything.
                localStorage.setItem(localKey, String(resetAt));
                return;
            }

            if (resetAt > localResetAt) {
                localStorage.setItem(localKey, String(resetAt));
                localStorage.removeItem(APP_CONFIG.storagePrefix + 'tabs');
                // Offline orders from before the reset belong to the old week
                localStorage.removeItem(APP_CONFIG.storagePrefix + 'pendingOps');
                if (typeof Storage !== 'undefined') {
                    Storage.init();
                }
                this._rerender();
            }
        });

        // Listen for guest list changes
        this.db.ref('customGuests').on('value', (snapshot) => {
            const cloudData = snapshot.val();
            if (cloudData) {
                localStorage.setItem(APP_CONFIG.storagePrefix + 'customGuests', JSON.stringify(cloudData));
                if (typeof App !== 'undefined' && App.renderGuestButtons) {
                    App.renderGuestButtons();
                }
            }
        });

        // Listen for category toggle changes
        this.db.ref('categoryToggles').on('value', (snapshot) => {
            const cloudData = snapshot.val() || {};
            Object.keys(cloudData).forEach(key => {
                localStorage.setItem(APP_CONFIG.storagePrefix + 'category_' + key, cloudData[key] ? 'true' : 'false');
            });
            if (typeof App !== 'undefined' && App.renderDrinkButtons) {
                App.renderDrinkButtons();
            }
            if (typeof Admin !== 'undefined' && Admin.renderCategoryToggles) {
                Admin.renderCategoryToggles();
            }
        });

        // Connection state monitoring
        this.db.ref('.info/connected').on('value', (snapshot) => {
            this.isOnline = snapshot.val() === true;
            this.showSyncStatus(this.isOnline ? 'online' : 'offline');
            if (this.isOnline) {
                this.replayPendingOps();
            }
        });
    },

    /**
     * Sync local localStorage data to Firebase (initial sync).
     */
    async syncLocalToCloud() {
        if (!this.db || !this.isOnline) return;

        try {
            // Check if cloud has any data
            const snapshot = await this.db.ref('tabs').once('value');
            const cloudTabs = snapshot.val();

            // If cloud is empty, push local data (per-guest keys)
            if (!cloudTabs) {
                const localTabs = JSON.parse(localStorage.getItem(APP_CONFIG.storagePrefix + 'tabs') || '{}');
                if (Object.keys(localTabs).length > 0) {
                    await this.db.ref('tabs').set(this._encodeTabs(localTabs));
                    console.log('Initial sync: local data pushed to cloud');
                }
            }

            // Sync custom guests
            const guestsSnapshot = await this.db.ref('customGuests').once('value');
            if (!guestsSnapshot.val()) {
                const localGuests = JSON.parse(localStorage.getItem(APP_CONFIG.storagePrefix + 'customGuests') || 'null');
                if (localGuests) {
                    await this.db.ref('customGuests').set(localGuests);
                }
            }

        } catch (error) {
            console.error('Sync error:', error);
        }
    },

    /**
     * Convert a local tabs object to the cloud layout (encoded keys, name field).
     */
    _encodeTabs(tabs) {
        const encoded = {};
        Object.keys(tabs).forEach(name => {
            encoded[this.encodeGuestKey(name)] = { ...tabs[name], name: name };
        });
        return encoded;
    },

    // ==========================================================================
    // PER-GUEST WRITES (safe for concurrent devices)
    // ==========================================================================

    /**
     * Add a drink to a guest's cloud tab via a transaction.
     * Idempotent by drink id, so replays and races are safe.
     */
    addDrinkToCloud(guestName, drinkEntry) {
        if (!this.db || !this.isOnline) {
            this._queueOp({ type: 'addDrink', guest: guestName, payload: drinkEntry });
            return;
        }

        this.showSyncStatus('syncing');
        this._tabRef(guestName).transaction(tab => {
            const base = tab || { name: guestName, drinks: [], total: 0, paid: false };
            const drinks = Object.values(base.drinks || {}).filter(d => d && d.id);
            if (!drinks.some(d => d.id === drinkEntry.id)) {
                drinks.push(drinkEntry);
            }
            return {
                ...base,
                name: base.name || guestName,
                drinks: drinks,
                total: this._totalOf(drinks)
            };
        })
            .then(() => this.showSyncStatus('online'))
            .catch(err => {
                console.error('Add drink sync error:', err);
                this._queueOp({ type: 'addDrink', guest: guestName, payload: drinkEntry });
                this.showSyncStatus('offline');
            });
    },

    /**
     * Remove a drink (by id) from a guest's cloud tab via a transaction.
     */
    removeDrinkFromCloud(guestName, drinkId) {
        if (!this.db || !this.isOnline) {
            this._queueOp({ type: 'removeDrink', guest: guestName, payload: drinkId });
            return;
        }

        this.showSyncStatus('syncing');
        this._tabRef(guestName).transaction(tab => {
            if (!tab) return tab; // nothing to remove
            const drinks = Object.values(tab.drinks || {}).filter(d => d && d.id && d.id !== drinkId);
            return {
                ...tab,
                drinks: drinks,
                total: this._totalOf(drinks)
            };
        })
            .then(() => this.showSyncStatus('online'))
            .catch(err => {
                console.error('Remove drink sync error:', err);
                this._queueOp({ type: 'removeDrink', guest: guestName, payload: drinkId });
                this.showSyncStatus('offline');
            });
    },

    /**
     * Update guest fields (paid, paymentMethod, paidAt) without touching drinks.
     */
    updateGuestFields(guestName, fields) {
        if (!this.db || !this.isOnline) {
            this._queueOp({ type: 'updateFields', guest: guestName, payload: fields });
            return;
        }

        this._tabRef(guestName).update({ ...fields, name: guestName })
            .catch(err => {
                console.error('Update guest sync error:', err);
                this._queueOp({ type: 'updateFields', guest: guestName, payload: fields });
            });
    },

    /**
     * Write a single guest's whole tab (new guest, restore of one guest).
     */
    saveGuestTab(guestName, tab) {
        if (!this.db || !this.isOnline) {
            this._queueOp({ type: 'saveTab', guest: guestName, payload: tab });
            return;
        }

        this._tabRef(guestName).set({ ...tab, name: guestName })
            .catch(err => {
                console.error('Save guest tab error:', err);
                this._queueOp({ type: 'saveTab', guest: guestName, payload: tab });
            });
    },

    /**
     * Remove a guest's tab from the cloud.
     */
    removeGuestFromCloud(guestName) {
        if (!this.db || !this.isOnline) {
            this._queueOp({ type: 'removeGuest', guest: guestName });
            return;
        }

        this._tabRef(guestName).remove()
            .catch(err => {
                console.error('Remove guest sync error:', err);
                this._queueOp({ type: 'removeGuest', guest: guestName });
            });
    },

    /**
     * Atomically move a guest's tab to a new name (rename).
     */
    renameGuestTab(oldName, newName, tab) {
        if (!this.db || !this.isOnline) {
            this._queueOp({ type: 'renameGuest', guest: oldName, payload: { newName, tab } });
            return;
        }

        this.db.ref('tabs').update({
            [this.encodeGuestKey(newName)]: { ...tab, name: newName },
            [this.encodeGuestKey(oldName)]: null
        })
            .catch(err => {
                console.error('Rename guest sync error:', err);
                this._queueOp({ type: 'renameGuest', guest: oldName, payload: { newName, tab } });
            });
    },

    /**
     * Replace the whole tabs tree. Only for intentional full replacements
     * (backup restore) — never for regular order writes.
     */
    saveTabs(tabs) {
        if (!this.db || !this.isOnline) return;

        this.showSyncStatus('syncing');
        this.db.ref('tabs').set(this._encodeTabs(tabs))
            .then(() => this.showSyncStatus('online'))
            .catch(err => {
                console.error('Save tabs error:', err);
                this.showSyncStatus('offline');
            });
    },

    // ==========================================================================
    // OFFLINE PENDING-WRITE QUEUE
    // ==========================================================================

    _getQueue() {
        try {
            return JSON.parse(localStorage.getItem(APP_CONFIG.storagePrefix + 'pendingOps') || '[]');
        } catch (e) {
            return [];
        }
    },

    _saveQueue(queue) {
        localStorage.setItem(APP_CONFIG.storagePrefix + 'pendingOps', JSON.stringify(queue));
    },

    _queueOp(op) {
        const queue = this._getQueue();
        queue.push({ ...op, ts: Date.now() });
        this._saveQueue(queue);
    },

    _applyOp(op) {
        switch (op.type) {
            case 'addDrink':
                return this._tabRef(op.guest).transaction(tab => {
                    const base = tab || { name: op.guest, drinks: [], total: 0, paid: false };
                    const drinks = Object.values(base.drinks || {}).filter(d => d && d.id);
                    if (!drinks.some(d => d.id === op.payload.id)) {
                        drinks.push(op.payload);
                    }
                    return { ...base, name: base.name || op.guest, drinks, total: this._totalOf(drinks) };
                });
            case 'removeDrink':
                return this._tabRef(op.guest).transaction(tab => {
                    if (!tab) return tab;
                    const drinks = Object.values(tab.drinks || {}).filter(d => d && d.id && d.id !== op.payload);
                    return { ...tab, drinks, total: this._totalOf(drinks) };
                });
            case 'updateFields':
                return this._tabRef(op.guest).update({ ...op.payload, name: op.guest });
            case 'saveTab':
                return this._tabRef(op.guest).set({ ...op.payload, name: op.guest });
            case 'removeGuest':
                return this._tabRef(op.guest).remove();
            case 'renameGuest':
                return this.db.ref('tabs').update({
                    [this.encodeGuestKey(op.payload.newName)]: { ...op.payload.tab, name: op.payload.newName },
                    [this.encodeGuestKey(op.guest)]: null
                });
            default:
                return Promise.resolve();
        }
    },

    /**
     * Replay queued offline writes in order. Ops are idempotent (drink ids),
     * so a repeat after a partial failure is harmless.
     */
    async replayPendingOps() {
        if (this._replaying || !this.db) return;
        if (this._getQueue().length === 0) return;

        this._replaying = true;
        this.showSyncStatus('syncing');
        try {
            while (true) {
                const queue = this._getQueue();
                if (queue.length === 0) break;
                await this._applyOp(queue[0]);
                const updated = this._getQueue();
                updated.shift();
                this._saveQueue(updated);
            }
            this.showSyncStatus('online');
        } catch (error) {
            console.error('Replay pending ops error:', error);
            this.showSyncStatus('offline');
        }
        this._replaying = false;
    },

    // ==========================================================================
    // BACKUPS & RESET
    // ==========================================================================

    /**
     * Store a daily backup snapshot in the cloud, keep the newest 7.
     */
    saveDailyBackup(dateKey, tabs) {
        if (!this.db || !this.isOnline) return;

        this.db.ref('backups/' + dateKey).set(this._encodeTabs(tabs))
            .then(() => this.db.ref('backups').once('value'))
            .then(snapshot => {
                const backups = snapshot.val() || {};
                const keys = Object.keys(backups).sort();
                while (keys.length > 7) {
                    const oldest = keys.shift();
                    this.db.ref('backups/' + oldest).remove();
                }
            })
            .catch(err => console.error('Save backup error:', err));
    },

    /**
     * Save custom guest list to Firebase.
     */
    saveGuestList(guests) {
        if (!this.db || !this.isOnline) return;

        this.db.ref('customGuests').set(guests)
            .catch(err => console.error('Save guests error:', err));
    },

    /**
     * Save category toggle state to Firebase.
     */
    saveCategoryToggle(toggleKey, enabled) {
        if (!this.db || !this.isOnline) return;

        this.db.ref('categoryToggles/' + toggleKey).set(enabled)
            .catch(err => console.error('Save toggle error:', err));
    },

    /**
     * Clear all cloud order data (for new week). Sets the reset signal first
     * so other devices clear intentionally instead of via an empty snapshot.
     */
    async clearAllData(resetAt) {
        if (!this.db || !this.isOnline) return;

        try {
            await this.db.ref('meta/resetAt').set(resetAt || Date.now());
            await this.db.ref('tabs').remove();
            console.log('Cloud data cleared');
        } catch (error) {
            console.error('Clear data error:', error);
        }
    }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.FirebaseSync = FirebaseSync;
}
