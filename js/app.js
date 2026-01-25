/**
 * CAMPSITE HONESTY BAR - MAIN APPLICATION
 *
 * Handles the main user interface for ordering drinks.
 */

const App = {
    selectedGuest: null,
    lastAddedDrink: null,
    undoTimeout: null,

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

        // Update header title
        document.getElementById('app-title').textContent = APP_CONFIG.appTitle;

        // Show default view
        this.showView('order');
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
        // Hide all views
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

        // Show the requested view
        const view = document.getElementById(`${viewName}-view`);
        if (view) {
            view.classList.add('active');
        }

        // Update nav buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === viewName);
        });

        // Handle view-specific setup
        if (viewName === 'tab') {
            this.renderTabView();
        } else if (viewName === 'admin') {
            Admin.renderAdminView();
        }
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
            btn.textContent = name;
            btn.dataset.guest = name;

            // Add paid indicator
            if (tabs[name] && tabs[name].paid) {
                btn.classList.add('paid');
                btn.title = 'This guest has paid';
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
                btn.textContent = item;
                btn.style.borderColor = category.color;
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
     * Select a guest.
     */
    selectGuest(name) {
        this.selectedGuest = name;

        // Update UI to show selection
        document.querySelectorAll('.guest-btn').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.guest === name);
        });

        // Update selected guest display
        const display = document.getElementById('selected-guest-display');
        const tab = Storage.getGuestTab(name);

        if (tab.paid) {
            display.innerHTML = `
                <strong>${name}</strong>
                <span class="paid-badge">PAID</span>
                <span class="guest-current-total">${this.formatPrice(tab.total)}</span>
            `;
            display.classList.add('guest-paid');
        } else {
            display.innerHTML = `
                <strong>${name}</strong>
                <span class="guest-current-total">${this.formatPrice(tab.total)}</span>
            `;
            display.classList.remove('guest-paid');
        }
        display.classList.add('has-selection');

        // Hide any existing notification
        this.hideNotification();
    },

    /**
     * Add a drink to the selected guest's tab.
     */
    addDrink(drinkName, price) {
        if (!this.selectedGuest) {
            this.showNotification('Please select your name first!', 'warning');
            return;
        }

        const tab = Storage.getGuestTab(this.selectedGuest);
        if (tab.paid) {
            this.showNotification(`${this.selectedGuest} has already paid. No more drinks can be added.`, 'warning');
            return;
        }

        // Add the drink
        const drinkEntry = Storage.addDrink(this.selectedGuest, drinkName, price);

        if (!drinkEntry) {
            this.showNotification('Could not add drink. Please try again.', 'error');
            return;
        }

        // Store for undo
        this.lastAddedDrink = {
            guestName: this.selectedGuest,
            drink: drinkEntry
        };

        // Update the UI
        const updatedTab = Storage.getGuestTab(this.selectedGuest);

        // Show confirmation with undo button
        this.showNotification(
            `Added one <strong>${drinkName}</strong> for <strong>${this.selectedGuest}</strong>.<br>
             Total for this guest is now <strong>${this.formatPrice(updatedTab.total)}</strong>.`,
            'success',
            true // Show undo button
        );

        // Update guest buttons to show new total
        this.renderGuestButtons();
        this.selectGuest(this.selectedGuest);

        // Set timeout to hide undo option
        this.clearUndoTimeout();
        this.undoTimeout = setTimeout(() => {
            this.lastAddedDrink = null;
            this.hideUndoButton();
        }, APP_CONFIG.undoTimeoutMs);
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
            this.showNotification(
                `Removed <strong>${drink.name}</strong> from <strong>${guestName}</strong>'s tab.<br>
                 Total is now <strong>${this.formatPrice(updatedTab.total)}</strong>.`,
                'info',
                false
            );

            // Update UI
            this.renderGuestButtons();
            if (this.selectedGuest === guestName) {
                this.selectGuest(guestName);
            }
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
     * Hide the undo button in the notification.
     */
    hideUndoButton() {
        const undoBtn = document.querySelector('.undo-btn');
        if (undoBtn) {
            undoBtn.style.display = 'none';
        }
    },

    /**
     * Show a notification message.
     */
    showNotification(message, type = 'info', showUndo = false) {
        const container = document.getElementById('notification');
        container.className = `notification ${type} show`;

        let html = `<div class="notification-message">${message}</div>`;

        if (showUndo) {
            html += `<button class="undo-btn" onclick="App.undoLastDrink()">Undo</button>`;
        }

        container.innerHTML = html;
    },

    /**
     * Hide the notification.
     */
    hideNotification() {
        const container = document.getElementById('notification');
        container.classList.remove('show');
    },

    /**
     * Render the tab view for the selected guest.
     */
    renderTabView() {
        const container = document.getElementById('tab-content');
        const guestSelect = document.getElementById('tab-guest-select');

        // Populate guest dropdown
        guestSelect.innerHTML = '<option value="">-- Select your name --</option>';
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
            container.innerHTML = '<p class="placeholder-text">Select your name above to view your tab.</p>';
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
                    <p>No drinks on your tab yet.</p>
                    <p>Go to "Add Drinks" to start ordering!</p>
                </div>
            `;
            return;
        }

        let html = `
            <div class="tab-header">
                <h3>${guestName}</h3>
                ${tab.paid ? '<span class="paid-badge large">PAID</span>' : ''}
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
                    <span class="drink-name">${item.count}x ${item.name}</span>
                    <span class="drink-price">${this.formatPrice(item.price * item.count)}</span>
                </div>
            `;
        });

        html += `
            </div>
            <div class="tab-total">
                <span>Total:</span>
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

        // Click anywhere to clear undo (except on undo button itself)
        document.addEventListener('click', (e) => {
            if (!e.target.classList.contains('undo-btn') && this.lastAddedDrink) {
                // Give a bit of grace period - don't immediately clear
                // The timeout will handle it
            }
        });
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
