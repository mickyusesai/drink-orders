/**
 * CAMPING DU LAC - FIREBASE SYNC
 *
 * Real-time database synchronization for multi-device support.
 */

const FirebaseSync = {
    db: null,
    isOnline: false,
    listeners: [],

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
        }
    },

    /**
     * Set up real-time listeners for data changes.
     */
    setupRealtimeListeners() {
        if (!this.db) return;

        // Listen for tabs (orders) changes
        this.db.ref('tabs').on('value', (snapshot) => {
            const cloudData = snapshot.val() || {};

            // Update localStorage with cloud data
            localStorage.setItem(APP_CONFIG.storagePrefix + 'tabs', JSON.stringify(cloudData));

            // Re-render the UI
            if (typeof App !== 'undefined' && App.renderGuestButtons) {
                App.renderGuestButtons();
            }
            if (typeof Admin !== 'undefined' && Admin.renderAdminView &&
                document.getElementById('admin-view')?.classList.contains('active')) {
                Admin.renderAdminView();
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

            // If cloud is empty, push local data
            if (!cloudTabs) {
                const localTabs = JSON.parse(localStorage.getItem(APP_CONFIG.storagePrefix + 'tabs') || '{}');
                if (Object.keys(localTabs).length > 0) {
                    await this.db.ref('tabs').set(localTabs);
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
     * Save tabs data to Firebase.
     */
    saveTabs(tabs) {
        if (!this.db || !this.isOnline) return;

        this.showSyncStatus('syncing');
        this.db.ref('tabs').set(tabs)
            .then(() => this.showSyncStatus('online'))
            .catch(err => {
                console.error('Save tabs error:', err);
                this.showSyncStatus('offline');
            });
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
     * Clear all cloud data (for new week).
     */
    async clearAllData() {
        if (!this.db || !this.isOnline) return;

        try {
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
