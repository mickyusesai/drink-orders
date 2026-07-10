/**
 * CAMPING DU LAC - HONESTY BAR
 *
 * Hoofdapplicatie voor het bestellen van drankjes.
 */

const App = {
    selectedGuest: null,
    lastAddedDrink: null,
    undoTimeout: null,
    currentView: 'guests',
    adminUnlocked: false,

    /**
     * Initialize the application.
     */
    init() {
        Storage.init();
        this.renderGuestButtons();
        this.renderDrinkButtons();
        this.setupEventListeners();
        this.showView('guests');

        // Initialize Firebase sync for real-time multi-device support
        if (typeof FirebaseSync !== 'undefined') {
            FirebaseSync.init();
        }

        // Automatic daily backup — checked hourly because the kiosk tablet
        // stays open 24/7 and rarely reloads the page.
        Storage.autoBackup();
        setInterval(() => Storage.autoBackup(), 60 * 60 * 1000);

        // Keep the tablet screen awake (kiosk runs 24/7)
        this.initWakeLock();

        // Check if entry access is required
        if (!this.checkEntryAccess()) {
            this.showEntryModal();
        }
    },

    /**
     * Keep the screen awake via the Wake Lock API (needs HTTPS). The lock is
     * released by the browser when the tab is hidden, so re-request it on
     * visibility changes and on touch as a fallback.
     */
    initWakeLock() {
        if (!('wakeLock' in navigator)) return;

        const request = async () => {
            try {
                this.wakeLock = await navigator.wakeLock.request('screen');
            } catch (e) {
                // Rejected (e.g. battery saver) — the next trigger retries
            }
        };

        request();
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') request();
        });
        document.addEventListener('click', () => {
            if (!this.wakeLock || this.wakeLock.released) request();
        });
    },

    /**
     * Check if the user has valid entry access.
     * Access is stored in localStorage and expires after 7 days.
     */
    checkEntryAccess() {
        const accessData = localStorage.getItem(APP_CONFIG.storagePrefix + 'entryAccess');
        if (!accessData) return false;

        try {
            const { timestamp } = JSON.parse(accessData);
            const sevenDays = 7 * 24 * 60 * 60 * 1000;
            return (Date.now() - timestamp) < sevenDays;
        } catch (e) {
            return false;
        }
    },

    /**
     * Grant entry access (store in localStorage).
     */
    grantEntryAccess() {
        localStorage.setItem(APP_CONFIG.storagePrefix + 'entryAccess', JSON.stringify({
            timestamp: Date.now()
        }));
    },

    /**
     * Show entry code modal.
     */
    showEntryModal() {
        document.getElementById('entry-modal').classList.add('show');
        document.getElementById('entry-pin-input').value = '';
        document.getElementById('entry-pin-error').textContent = '';
        document.getElementById('entry-pin-input').focus();
    },

    /**
     * Add digit to entry PIN input.
     */
    addEntryDigit(digit) {
        const input = document.getElementById('entry-pin-input');
        if (input.value.length < 5) {
            input.value += digit;
        }
    },

    /**
     * Clear entry PIN input.
     */
    clearEntryPin() {
        document.getElementById('entry-pin-input').value = '';
        document.getElementById('entry-pin-error').textContent = '';
    },

    /**
     * Submit entry PIN and verify.
     */
    submitEntryPin() {
        const input = document.getElementById('entry-pin-input');
        const error = document.getElementById('entry-pin-error');

        if (input.value === Storage.getEntryPin()) {
            this.grantEntryAccess();
            document.getElementById('entry-modal').classList.remove('show');
        } else {
            error.textContent = 'Onjuiste code';
            input.value = '';
            input.classList.add('shake');
            setTimeout(() => input.classList.remove('shake'), 500);
        }
    },

    /**
     * Format price in euros.
     */
    formatPrice(amount) {
        return APP_CONFIG.currency + amount.toFixed(2).replace('.', ',');
    },

    /**
     * Show a specific view/screen.
     */
    showView(viewName) {
        // Lock admin when leaving admin view - requires PIN every time
        if (this.currentView === 'admin' && viewName !== 'admin') {
            this.adminUnlocked = false;
        }

        this.currentView = viewName;

        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

        const view = document.getElementById(`${viewName}-view`);
        if (view) {
            view.classList.add('active');
        }

        const navViewName = viewName === 'drinks' ? 'guests' : viewName;
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === navViewName);
        });

        if (viewName === 'admin') {
            Admin.renderAdminView();
        } else if (viewName === 'guests') {
            this.renderGuestButtons();
        }
    },

    /**
     * Go back to guest selection.
     */
    goBackToGuests() {
        this.selectedGuest = null;
        this.showView('guests');
    },

    /**
     * Get icon filename for a drink/item name.
     */
    getItemIcon(itemName) {
        const name = itemName.toLowerCase();
        if (name.includes('wijn') || name.includes('wine') || name.includes('fles wijn')) return 'wine.png';
        if (name.includes('bier') || name.includes('ipa') || name.includes('desperados')) return 'beer.png';
        if (name.includes('water') && !name.includes('watersport')) return 'water.png';
        if (name.includes('chips')) return 'chips.png';
        if (name.includes('snack')) return 'snack.png';
        if (name.includes('thee') || name.includes('koffie') || name.includes('coffee') || name.includes('tea')) return 'coffee tea.png';
        if (name.includes('fris') || name.includes('redbull')) return 'soft drinks redbull.png';
        if (name.includes('cocktail') || name.includes('mocktail') || name.includes('mixer')) return 'cocktails mocktails.png';
        if (name.includes('panini')) return 'panini.png';
        if (name.includes('smoothie')) return 'smoothie.png';
        if (name.includes('ijsje') || name.includes('ice')) return 'ice cream.png';
        if (name.includes('watersport') || name.includes('kayak') || name.includes('pedalo') || name.includes('sup')) return 'water sports.png';
        return null; // No icon
    },

    /**
     * Get unique icon images HTML for a guest's orders.
     */
    getGuestIconsHtml(drinks) {
        const icons = new Set();
        drinks.forEach(drink => {
            const icon = this.getItemIcon(drink.name);
            if (icon) icons.add(icon);
        });
        return Array.from(icons).slice(0, 12).map(icon =>
            `<img src="images/${icon}" alt="" class="guest-icon">`
        ).join('');
    },

    /**
     * Render guest name buttons.
     */
    renderGuestButtons() {
        const container = document.getElementById('guest-buttons');
        container.innerHTML = '';

        const tabs = Storage.getAllTabs();
        const guestList = Storage.getGuestList();

        if (guestList.length === 0) {
            container.innerHTML = `
                <div class="empty-guest-list">
                    <div class="empty-tab-icon">📋</div>
                    <p>Nog geen namen op de lijst.</p>
                    <p class="section-hint">Voeg gasten toe via Beheer &rarr; Gastenlijst (of importeer een lijst).</p>
                </div>
            `;
            return;
        }

        guestList.forEach(name => {
            const btn = document.createElement('button');
            btn.className = 'guest-btn';
            btn.dataset.guest = name;

            const nameSpan = document.createElement('span');
            nameSpan.className = 'guest-btn-name';
            nameSpan.textContent = name;
            btn.appendChild(nameSpan);

            if (tabs[name] && tabs[name].paid) {
                btn.classList.add('paid');
            }

            if (tabs[name] && tabs[name].drinks && tabs[name].drinks.length > 0) {
                const badge = document.createElement('span');
                badge.className = 'guest-icons-badge';
                badge.innerHTML = this.getGuestIconsHtml(tabs[name].drinks);
                btn.appendChild(badge);
            }

            btn.addEventListener('click', () => this.selectGuest(name));
            container.appendChild(btn);
        });
    },

    /**
     * Get favorites for a guest (top 2 items ordered 2+ times, only if 5+ total orders).
     */
    getGuestFavorites(guestName) {
        if (!guestName) return [];

        const tab = Storage.getGuestTab(guestName);
        if (!tab.drinks || tab.drinks.length < 5) return [];

        // Count occurrences of each item
        const counts = {};
        tab.drinks.forEach(drink => {
            counts[drink.name] = (counts[drink.name] || 0) + 1;
        });

        // Filter items ordered 2+ times and sort by count
        const favorites = Object.entries(counts)
            .filter(([name, count]) => count >= 2)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 2)
            .map(([name]) => {
                // Find the price and original category color for this item
                const drink = tab.drinks.find(d => d.name === name);
                const color = this.getItemCategoryColor(name);
                return { name, price: drink.price, color };
            });

        return favorites;
    },

    /**
     * Find the category color for a drink item.
     */
    getItemCategoryColor(itemName) {
        for (const category of Storage.getMenu()) {
            if (category.items.some(item => item.name === itemName)) {
                return category.color;
            }
        }
        return '#666'; // Default gray if not found
    },

    /**
     * Render favorites category at top of drink menu.
     */
    renderFavoritesCategory(container) {
        const favorites = this.getGuestFavorites(this.selectedGuest);
        if (favorites.length === 0) return;

        const favoritesDiv = document.createElement('div');
        favoritesDiv.className = 'favorites-section';

        const title = document.createElement('div');
        title.className = 'favorites-title';
        title.textContent = 'Jouw favorieten:';
        favoritesDiv.appendChild(title);

        const itemsDiv = document.createElement('div');
        itemsDiv.className = 'favorites-items';

        favorites.forEach(item => {
            const btn = document.createElement('button');
            btn.className = 'drink-btn';
            btn.innerHTML = `
                <span class="drink-btn-name">${item.name}</span>
                <span class="drink-btn-price">${this.formatPrice(item.price)}</span>
            `;
            btn.style.setProperty('--category-color', item.color);
            btn.dataset.drink = item.name;
            btn.dataset.price = item.price;
            btn.addEventListener('click', () => this.addDrink(item.name, item.price));
            itemsDiv.appendChild(btn);
        });

        favoritesDiv.appendChild(itemsDiv);
        container.appendChild(favoritesDiv);
    },

    /**
     * Render drink category buttons - compact horizontal layout.
     */
    renderDrinkButtons() {
        const container = document.getElementById('drink-buttons');
        container.innerHTML = '';

        // Render favorites category if guest has 5+ orders
        this.renderFavoritesCategory(container);

        Storage.getMenu().forEach(category => {
            // Check if category is toggleable and if it's currently hidden
            if (category.toggleKey && !Storage.isCategoryEnabled(category.toggleKey)) {
                return; // Skip hidden categories
            }
            if (!category.items || category.items.length === 0) {
                return; // Skip emptied categories
            }

            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'drink-category';

            const header = document.createElement('div');
            header.className = 'category-header';
            header.style.backgroundColor = category.color;
            header.innerHTML = `<span class="category-name">${category.name}</span>`;
            categoryDiv.appendChild(header);

            const itemsDiv = document.createElement('div');
            itemsDiv.className = 'category-items';

            category.items.forEach(item => {
                const btn = document.createElement('button');
                btn.className = 'drink-btn';
                btn.innerHTML = `
                    <span class="drink-btn-name">${item.name}</span>
                    <span class="drink-btn-price">${this.formatPrice(item.price)}</span>
                `;
                btn.style.setProperty('--category-color', category.color);
                btn.dataset.drink = item.name;
                btn.dataset.price = item.price;
                btn.addEventListener('click', () => this.addDrink(item.name, item.price));
                itemsDiv.appendChild(btn);
            });

            categoryDiv.appendChild(itemsDiv);
            container.appendChild(categoryDiv);
        });
    },

    /**
     * Select a guest and go to drinks view.
     */
    selectGuest(name) {
        const tab = Storage.getGuestTab(name);

        if (tab.paid) {
            // Already settled: no new orders, but they can still see their bill
            this.showTabFor(name);
            return;
        }

        this.selectedGuest = name;

        // Re-render drinks to show this guest's favorites
        this.renderDrinkButtons();

        document.getElementById('selected-guest-name').textContent = name;
        document.getElementById('selected-guest-total').textContent =
            tab.total > 0 ? `Huidig: ${this.formatPrice(tab.total)}` : '';

        this.showView('drinks');
    },

    /**
     * Add a drink to the selected guest's tab.
     */
    addDrink(drinkName, price) {
        if (!this.selectedGuest) {
            return;
        }

        const tab = Storage.getGuestTab(this.selectedGuest);
        if (tab.paid) {
            this.showMessage(
                'Niet mogelijk',
                `${this.selectedGuest} heeft al betaald.`,
                'warning'
            );
            return;
        }

        const drinkEntry = Storage.addDrink(this.selectedGuest, drinkName, price);

        if (!drinkEntry) {
            this.showMessage('Fout', 'Kon drankje niet toevoegen.', 'error');
            return;
        }

        this.lastAddedDrink = {
            guestName: this.selectedGuest,
            drink: drinkEntry
        };

        const updatedTab = Storage.getGuestTab(this.selectedGuest);

        this.showSuccessPopup(drinkName, this.selectedGuest, updatedTab.total);

        // Set timeout to auto-close and return to guest selection
        this.clearUndoTimeout();
        this.undoTimeout = setTimeout(() => {
            this.closePopupAndReset();
        }, APP_CONFIG.popupTimeoutMs);
    },

    /**
     * Show success popup with drink confirmation.
     */
    showSuccessPopup(drinkName, guestName, total) {
        const overlay = document.getElementById('success-overlay');
        overlay.querySelector('.success-drink-name').textContent = drinkName;
        overlay.querySelector('.success-message').textContent = `toegevoegd voor ${guestName}`;
        overlay.querySelector('.success-total').textContent = `Totaal: ${this.formatPrice(total)}`;
        overlay.querySelector('.undo-link').style.display = '';
        overlay.querySelector('.auto-close-hint').textContent = 'Sluit automatisch';

        // Reset icon to checkmark
        overlay.querySelector('.success-icon').innerHTML = `
            <svg viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="4"/>
                <path d="M30 50 L45 65 L70 35" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;
        overlay.querySelector('.success-icon').style.color = '';

        overlay.classList.remove('warning');
        overlay.classList.add('show');
    },

    /**
     * Close popup and return to guest selection - KEY SOLUTION
     * This prevents accidental orders under wrong names.
     */
    closePopupAndReset() {
        this.hideSuccessOverlay();
        this.lastAddedDrink = null;
        this.clearUndoTimeout();

        // Return to guest selection so next person must select their name
        this.selectedGuest = null;
        this.showView('guests');
    },

    /**
     * Order another drink for the same guest.
     * Stays on drinks view without returning to guest selection.
     */
    orderAnotherDrink() {
        this.hideSuccessOverlay();
        this.lastAddedDrink = null;
        this.clearUndoTimeout();

        // Update the guest total display
        if (this.selectedGuest) {
            const tab = Storage.getGuestTab(this.selectedGuest);
            document.getElementById('selected-guest-total').textContent =
                tab.total > 0 ? `Huidig: ${this.formatPrice(tab.total)}` : '';
        }
        // Stay on drinks view - don't change selectedGuest
    },

    /**
     * Hide success overlay.
     */
    hideSuccessOverlay() {
        document.getElementById('success-overlay').classList.remove('show');
    },

    /**
     * Show a message (for warnings/errors).
     */
    showMessage(title, message, type = 'info') {
        const overlay = document.getElementById('success-overlay');

        if (type === 'warning' || type === 'error') {
            overlay.querySelector('.success-icon').innerHTML = `
                <svg viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="4"/>
                    <line x1="50" y1="30" x2="50" y2="55" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>
                    <circle cx="50" cy="70" r="4" fill="currentColor"/>
                </svg>
            `;
            overlay.querySelector('.success-icon').style.color = '#e53935';
            overlay.classList.add('warning');
        }

        overlay.querySelector('.success-drink-name').textContent = title;
        overlay.querySelector('.success-message').textContent = message;
        overlay.querySelector('.success-total').textContent = '';
        overlay.querySelector('.undo-link').style.display = 'none';
        overlay.querySelector('.auto-close-hint').textContent = '';

        overlay.classList.add('show');

        setTimeout(() => {
            this.hideSuccessOverlay();
            overlay.classList.remove('warning');
        }, 3000);
    },

    /**
     * Undo the last added drink.
     */
    undoLastDrink() {
        if (!this.lastAddedDrink) {
            return;
        }

        const { guestName, drink } = this.lastAddedDrink;
        const success = Storage.removeDrink(guestName, drink.id);

        this.lastAddedDrink = null;
        this.clearUndoTimeout();

        if (success) {
            const updatedTab = Storage.getGuestTab(guestName);

            const overlay = document.getElementById('success-overlay');
            overlay.querySelector('.success-drink-name').textContent = 'Ongedaan gemaakt';
            overlay.querySelector('.success-message').textContent = `${drink.name} verwijderd`;
            overlay.querySelector('.success-total').textContent =
                updatedTab.total > 0 ? `Totaal: ${this.formatPrice(updatedTab.total)}` : 'Totaal: €0,00';
            overlay.querySelector('.undo-link').style.display = 'none';
            overlay.querySelector('.auto-close-hint').textContent = '';

            // Track the timer so closing the popup by hand cancels it —
            // otherwise it would later yank the view back to the guest list.
            this.undoTimeout = setTimeout(() => {
                this.closePopupAndReset();
            }, 1500);
        }
    },

    /**
     * Clear the undo timeout.
     */
    clearUndoTimeout() {
        if (this.undoTimeout) {
            clearTimeout(this.undoTimeout);
            this.undoTimeout = null;
        }
    },

    /**
     * Escape HTML special characters for safe rendering.
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * Show the "Bekijk totaal" modal for the currently selected guest.
     */
    showMyTab() {
        if (!this.selectedGuest) return;
        this.showTabFor(this.selectedGuest);
    },

    /**
     * Show a guest's bill (grouped items + total) in a modal.
     */
    showTabFor(guestName) {
        const tab = Storage.getGuestTab(guestName);
        const modal = document.getElementById('details-modal');
        const content = document.getElementById('details-content');

        let listHtml;
        if (tab.drinks.length === 0) {
            listHtml = `
                <div class="empty-tab">
                    <div class="empty-tab-icon">🍺</div>
                    <p>Nog geen bestellingen.</p>
                </div>
            `;
        } else {
            const drinkCounts = {};
            tab.drinks.forEach(drink => {
                const key = `${drink.name}|${drink.price}`;
                if (!drinkCounts[key]) {
                    drinkCounts[key] = { name: drink.name, price: drink.price, count: 0 };
                }
                drinkCounts[key].count++;
            });

            listHtml = '<div class="tab-drinks-list">';
            Object.values(drinkCounts).forEach(item => {
                listHtml += `
                    <div class="tab-drink-item">
                        <span class="drink-count">${item.count}x</span>
                        <span class="drink-name">${this.escapeHtml(item.name)}</span>
                        <span class="drink-price">${this.formatPrice(item.price * item.count)}</span>
                    </div>
                `;
            });
            listHtml += '</div>';
        }

        content.innerHTML = `
            <div class="modal-header">
                <h2>${this.escapeHtml(guestName)}</h2>
                ${tab.paid ? '<span class="paid-badge large">BETAALD</span>' : ''}
                <button class="close-btn" onclick="App.closeTabModal()">&times;</button>
            </div>
            <div class="modal-body my-tab-body">
                ${listHtml}
                <div class="tab-total">
                    <span>Totaal</span>
                    <span class="total-amount">${this.formatPrice(tab.total)}</span>
                </div>
            </div>
            <div class="modal-footer my-tab-footer">
                <button class="action-btn details-btn tab-close-btn" onclick="App.closeTabModal()">Sluiten</button>
            </div>
        `;

        modal.classList.add('show');
    },

    /**
     * Close the bill modal.
     */
    closeTabModal() {
        document.getElementById('details-modal').classList.remove('show');
    },

    /**
     * Set up event listeners.
     */
    setupEventListeners() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.dataset.view;
                if (view) {
                    // Admin view requires PIN
                    if (view === 'admin' && !this.adminUnlocked) {
                        this.showPinModal();
                    } else {
                        this.showView(view);
                    }
                }
            });
        });

        // Click on overlay background also closes and resets
        document.getElementById('success-overlay').addEventListener('click', (e) => {
            if (e.target.id === 'success-overlay') {
                this.closePopupAndReset();
            }
        });

        // PIN input enter key
        document.getElementById('pin-input').addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                this.submitPin();
            }
        });

        // Entry PIN input enter key
        document.getElementById('entry-pin-input').addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                this.submitEntryPin();
            }
        });
    },

    /**
     * Show PIN modal for admin access.
     */
    showPinModal() {
        document.getElementById('pin-modal').classList.add('show');
        document.getElementById('pin-input').value = '';
        document.getElementById('pin-error').textContent = '';
        document.getElementById('pin-input').focus();
    },

    /**
     * Close PIN modal.
     */
    closePinModal() {
        document.getElementById('pin-modal').classList.remove('show');
        document.getElementById('pin-input').value = '';
        document.getElementById('pin-error').textContent = '';
    },

    /**
     * Add digit to PIN input.
     */
    addPinDigit(digit) {
        const input = document.getElementById('pin-input');
        if (input.value.length < 5) {
            input.value += digit;
        }
    },

    /**
     * Clear PIN input.
     */
    clearPin() {
        document.getElementById('pin-input').value = '';
        document.getElementById('pin-error').textContent = '';
    },

    /**
     * Submit PIN and verify.
     */
    submitPin() {
        const input = document.getElementById('pin-input');
        const error = document.getElementById('pin-error');

        if (input.value === Storage.getAdminPin()) {
            this.adminUnlocked = true;
            this.closePinModal();
            this.showView('admin');
        } else {
            error.textContent = 'Onjuiste PIN';
            input.value = '';
            input.classList.add('shake');
            setTimeout(() => input.classList.remove('shake'), 500);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
