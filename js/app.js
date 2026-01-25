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

    /**
     * Initialize the application.
     */
    init() {
        // Initialize storage
        Storage.init();

        // Set up the UI
        this.renderGuestButtons();
        this.renderDrinkButtons();
        this.setupEventListeners();

        // Update header
        document.getElementById('app-title').textContent = APP_CONFIG.appTitle;
        document.getElementById('app-subtitle').textContent = APP_CONFIG.appSubtitle;

        // Show default view
        this.showView('guests');
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
        this.currentView = viewName;

        // Hide all views
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

        // Show the requested view
        const view = document.getElementById(`${viewName}-view`);
        if (view) {
            view.classList.add('active');
        }

        // Update nav buttons - map drinks view to guests nav button
        const navViewName = viewName === 'drinks' ? 'guests' : viewName;
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === navViewName);
        });

        // Handle view-specific setup
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
     * Render guest name buttons.
     */
    renderGuestButtons() {
        const container = document.getElementById('guest-buttons');
        container.innerHTML = '';

        const tabs = Storage.getAllTabs();

        GUEST_NAMES.forEach(name => {
            const btn = document.createElement('button');
            btn.className = 'guest-btn';
            btn.dataset.guest = name;

            const nameSpan = document.createElement('span');
            nameSpan.className = 'guest-btn-name';
            nameSpan.textContent = name;
            btn.appendChild(nameSpan);

            // Add paid indicator
            if (tabs[name] && tabs[name].paid) {
                btn.classList.add('paid');
            }

            // Add total if any
            if (tabs[name] && tabs[name].total > 0) {
                const badge = document.createElement('span');
                badge.className = 'guest-total-badge';
                badge.textContent = this.formatPrice(tabs[name].total);
                btn.appendChild(badge);
            }

            btn.addEventListener('click', () => this.selectGuest(name));
            container.appendChild(btn);
        });
    },

    /**
     * Render drink category buttons.
     */
    renderDrinkButtons() {
        const container = document.getElementById('drink-buttons');
        container.innerHTML = '';

        DRINK_CATEGORIES.forEach(category => {
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'drink-category';

            const header = document.createElement('div');
            header.className = 'category-header';
            header.style.backgroundColor = category.color;
            header.innerHTML = `
                <span class="category-name">${category.name}</span>
                <span class="category-price">${this.formatPrice(category.price)}</span>
            `;
            categoryDiv.appendChild(header);

            const itemsDiv = document.createElement('div');
            itemsDiv.className = 'category-items';

            category.items.forEach(item => {
                const btn = document.createElement('button');
                btn.className = 'drink-btn';
                btn.innerHTML = `
                    <span class="drink-btn-name">${item}</span>
                    <span class="drink-btn-price">${this.formatPrice(category.price)}</span>
                `;
                btn.style.setProperty('--category-color', category.color);
                btn.dataset.drink = item;
                btn.dataset.price = category.price;
                btn.addEventListener('click', () => this.addDrink(item, category.price));
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

        // Check if guest has paid
        if (tab.paid) {
            this.showMessage(
                `${name} heeft al betaald`,
                'Er kunnen geen bestellingen meer worden toegevoegd.',
                'warning'
            );
            return;
        }

        this.selectedGuest = name;

        // Update selected guest display in drinks view
        document.getElementById('selected-guest-name').textContent = name;
        document.getElementById('selected-guest-total').textContent =
            tab.total > 0 ? `Huidig: ${this.formatPrice(tab.total)}` : '';

        // Go to drinks view
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

        // Add the drink
        const drinkEntry = Storage.addDrink(this.selectedGuest, drinkName, price);

        if (!drinkEntry) {
            this.showMessage('Fout', 'Kon drankje niet toevoegen. Probeer opnieuw.', 'error');
            return;
        }

        // Store for undo
        this.lastAddedDrink = {
            guestName: this.selectedGuest,
            drink: drinkEntry
        };

        // Get updated total
        const updatedTab = Storage.getGuestTab(this.selectedGuest);

        // Show success overlay
        this.showSuccessOverlay(drinkName, this.selectedGuest, updatedTab.total);

        // Update the guest total in drinks view
        document.getElementById('selected-guest-total').textContent =
            `Huidig: ${this.formatPrice(updatedTab.total)}`;

        // Set timeout to hide undo option
        this.clearUndoTimeout();
        this.undoTimeout = setTimeout(() => {
            this.lastAddedDrink = null;
            this.hideSuccessOverlay();
        }, APP_CONFIG.undoTimeoutMs);
    },

    /**
     * Show success overlay with drink confirmation.
     */
    showSuccessOverlay(drinkName, guestName, total) {
        const overlay = document.getElementById('success-overlay');
        overlay.querySelector('.success-drink-name').textContent = drinkName;
        overlay.querySelector('.success-message').textContent = `toegevoegd voor ${guestName}`;
        overlay.querySelector('.success-total').textContent = `Totaal: ${this.formatPrice(total)}`;

        // Set up undo button
        const undoBtn = overlay.querySelector('.undo-btn');
        undoBtn.onclick = () => this.undoLastDrink();

        overlay.classList.add('show');
    },

    /**
     * Hide success overlay.
     */
    hideSuccessOverlay() {
        const overlay = document.getElementById('success-overlay');
        overlay.classList.remove('show');
    },

    /**
     * Show a message (for warnings/errors).
     */
    showMessage(title, message, type = 'info') {
        const overlay = document.getElementById('success-overlay');
        const iconSvg = overlay.querySelector('.success-icon svg');

        // Change icon based on type
        if (type === 'warning' || type === 'error') {
            iconSvg.innerHTML = `
                <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="4"/>
                <line x1="50" y1="30" x2="50" y2="55" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>
                <circle cx="50" cy="70" r="4" fill="currentColor"/>
            `;
        }

        overlay.querySelector('.success-drink-name').textContent = title;
        overlay.querySelector('.success-message').textContent = message;
        overlay.querySelector('.success-total').textContent = '';
        overlay.querySelector('.undo-btn').style.display = 'none';

        overlay.classList.add('show', type);

        // Auto-hide after 3 seconds
        setTimeout(() => {
            overlay.classList.remove('show', type);
            overlay.querySelector('.undo-btn').style.display = '';
            // Restore checkmark icon
            iconSvg.innerHTML = `
                <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="4"/>
                <path d="M30 50 L45 65 L70 35" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
            `;
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

        // Remove the drink
        const success = Storage.removeDrink(guestName, drink.id);

        if (success) {
            const updatedTab = Storage.getGuestTab(guestName);

            // Update displays
            if (this.selectedGuest === guestName) {
                document.getElementById('selected-guest-total').textContent =
                    updatedTab.total > 0 ? `Huidig: ${this.formatPrice(updatedTab.total)}` : '';
            }

            // Update overlay to show undo confirmation
            const overlay = document.getElementById('success-overlay');
            overlay.querySelector('.success-drink-name').textContent = 'Ongedaan gemaakt';
            overlay.querySelector('.success-message').textContent = `${drink.name} verwijderd`;
            overlay.querySelector('.success-total').textContent =
                updatedTab.total > 0 ? `Totaal: ${this.formatPrice(updatedTab.total)}` : 'Totaal: €0,00';
            overlay.querySelector('.undo-btn').style.display = 'none';

            // Auto-hide after 2 seconds
            setTimeout(() => {
                this.hideSuccessOverlay();
                overlay.querySelector('.undo-btn').style.display = '';
            }, 2000);
        }

        // Clear undo state
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
     * Render the tab view for the selected guest.
     */
    renderTabView() {
        const container = document.getElementById('tab-content');
        const guestSelect = document.getElementById('tab-guest-select');

        // Populate guest dropdown
        guestSelect.innerHTML = '<option value="">-- Kies je naam --</option>';
        GUEST_NAMES.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            if (name === this.selectedGuest) {
                option.selected = true;
            }
            guestSelect.appendChild(option);
        });

        // If a guest is selected, show their tab
        if (this.selectedGuest) {
            this.showGuestTab(this.selectedGuest);
        } else {
            container.innerHTML = '<p class="placeholder-text">Selecteer je naam hierboven om je rekening te zien.</p>';
        }
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
                    <div class="empty-tab-icon">&#127866;</div>
                    <p>Nog geen bestellingen.</p>
                    <p class="empty-tab-hint">Ga naar "Bestellen" om iets te pakken!</p>
                </div>
            `;
            return;
        }

        let html = `
            <div class="tab-header-info">
                <h3>${guestName}</h3>
                ${tab.paid ? '<span class="paid-badge large">BETAALD</span>' : ''}
            </div>
            <div class="tab-drinks-list">
        `;

        // Group drinks for easier reading
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
        // Navigation buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.dataset.view;
                if (view) {
                    this.showView(view);
                }
            });
        });

        // Tab view guest select
        document.getElementById('tab-guest-select').addEventListener('change', (e) => {
            if (e.target.value) {
                this.selectedGuest = e.target.value;
                this.showGuestTab(e.target.value);
            }
        });

        // Close success overlay when clicking outside
        document.getElementById('success-overlay').addEventListener('click', (e) => {
            if (e.target.id === 'success-overlay') {
                this.hideSuccessOverlay();
                this.lastAddedDrink = null;
                this.clearUndoTimeout();
            }
        });
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
