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

        // Check if entry access is required
        if (!this.checkEntryAccess()) {
            this.showEntryModal();
        }
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

        if (input.value === APP_CONFIG.entryPin) {
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

        if (viewName === 'tab') {
            this.renderTabView();
        } else if (viewName === 'admin') {
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
     * Render drink category buttons - compact horizontal layout.
     */
    renderDrinkButtons() {
        const container = document.getElementById('drink-buttons');
        container.innerHTML = '';

        DRINK_CATEGORIES.forEach(category => {
            // Check if category is toggleable and if it's currently hidden
            if (category.toggleKey && !Storage.isCategoryEnabled(category.toggleKey)) {
                return; // Skip hidden categories
            }

            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'drink-category';

            // Check if category has a fixed price or items have individual prices
            const hasFixedPrice = typeof category.price === 'number';

            const header = document.createElement('div');
            header.className = 'category-header';
            header.style.backgroundColor = category.color;
            header.innerHTML = `
                <span class="category-name">${category.name}</span>
                ${hasFixedPrice ? `<span class="category-price">${this.formatPrice(category.price)}</span>` : ''}
            `;
            categoryDiv.appendChild(header);

            const itemsDiv = document.createElement('div');
            itemsDiv.className = 'category-items';

            category.items.forEach(item => {
                // Handle both string items (fixed price) and object items (individual price)
                const itemName = typeof item === 'string' ? item : item.name;
                const itemPrice = typeof item === 'string' ? category.price : item.price;

                const btn = document.createElement('button');
                btn.className = 'drink-btn';
                btn.innerHTML = `
                    <span class="drink-btn-name">${itemName}</span>
                    <span class="drink-btn-price">${this.formatPrice(itemPrice)}</span>
                `;
                btn.style.setProperty('--category-color', category.color);
                btn.dataset.drink = itemName;
                btn.dataset.price = itemPrice;
                btn.addEventListener('click', () => this.addDrink(itemName, itemPrice));
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
            this.showMessage(
                `${name} heeft al betaald`,
                'Er kunnen geen bestellingen meer worden toegevoegd.',
                'warning'
            );
            return;
        }

        this.selectedGuest = name;

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

        if (success) {
            const updatedTab = Storage.getGuestTab(guestName);

            const overlay = document.getElementById('success-overlay');
            overlay.querySelector('.success-drink-name').textContent = 'Ongedaan gemaakt';
            overlay.querySelector('.success-message').textContent = `${drink.name} verwijderd`;
            overlay.querySelector('.success-total').textContent =
                updatedTab.total > 0 ? `Totaal: ${this.formatPrice(updatedTab.total)}` : 'Totaal: €0,00';
            overlay.querySelector('.undo-link').style.display = 'none';
            overlay.querySelector('.auto-close-hint').textContent = '';

            setTimeout(() => {
                this.closePopupAndReset();
            }, 1500);
        }

        this.lastAddedDrink = null;
        this.clearUndoTimeout();
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
     * Render the tab view.
     */
    renderTabView() {
        const container = document.getElementById('tab-content');
        const guestSelect = document.getElementById('tab-guest-select');
        const guestList = Storage.getGuestList();

        guestSelect.innerHTML = '<option value="">-- Kies je naam --</option>';
        guestList.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            guestSelect.appendChild(option);
        });

        container.innerHTML = '<p class="placeholder-text">Selecteer je naam hierboven.</p>';
    },

    /**
     * Show a specific guest's tab.
     */
    showGuestTab(guestName) {
        const container = document.getElementById('tab-content');
        const tab = Storage.getGuestTab(guestName);

        if (tab.drinks.length === 0) {
            container.innerHTML = `
                <div class="empty-tab">
                    <div class="empty-tab-icon">🍺</div>
                    <p>Nog geen bestellingen.</p>
                </div>
            `;
            return;
        }

        let html = `
            <div class="tab-header-info">
                <h3>${guestName}</h3>
                ${tab.paid ? '<span class="paid-badge">BETAALD</span>' : ''}
            </div>
            <div class="tab-drinks-list">
        `;

        const drinkCounts = {};
        tab.drinks.forEach(drink => {
            const key = `${drink.name}|${drink.price}`;
            if (!drinkCounts[key]) {
                drinkCounts[key] = { name: drink.name, price: drink.price, count: 0 };
            }
            drinkCounts[key].count++;
        });

        Object.values(drinkCounts).forEach(item => {
            html += `
                <div class="tab-drink-item">
                    <span class="drink-count">${item.count}x</span>
                    <span class="drink-name">${item.name}</span>
                    <span class="drink-price">${this.formatPrice(item.price * item.count)}</span>
                </div>
            `;
        });

        html += `
            </div>
            <div class="tab-total">
                <span>Totaal</span>
                <span class="total-amount">${this.formatPrice(tab.total)}</span>
            </div>
        `;

        container.innerHTML = html;
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

        document.getElementById('tab-guest-select').addEventListener('change', (e) => {
            if (e.target.value) {
                this.showGuestTab(e.target.value);
            }
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

        if (input.value === APP_CONFIG.adminPin) {
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
