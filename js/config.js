/**
 * CAMPSITE HONESTY BAR - CONFIGURATION
 *
 * Edit this file to update guest names and drink prices each week.
 */

// =============================================================================
// GUEST NAMES
// =============================================================================
// Change this list at the start of each new week.
// You can have up to 50 guests. Add or remove names as needed.
// Names will appear as buttons in the order listed here.

const GUEST_NAMES = [
    // Row 1 - Example family groups
    "Van den Berg",
    "Jansen Familie",
    "De Vries",
    "Bakker",
    "Visser",
    "Smit",
    "Meijer",
    "De Boer",
    "Mulder",
    "De Groot",

    // Row 2
    "Bos Familie",
    "Vos",
    "Peters",
    "Hendriks",
    "Van Dijk",
    "Van den Broek",
    "De Jong",
    "Janssen",
    "Van Leeuwen",
    "Koster",

    // Row 3
    "Vermeer",
    "Van der Meer",
    "Dijkstra",
    "Kuijpers",
    "Kramer",
    "Schouten",
    "Van Beek",
    "Willems",
    "Dekker",
    "De Wit",

    // Row 4
    "Scholten",
    "Van der Berg",
    "Post",
    "Jacobs",
    "Van Es",
    "Van der Veen",
    "Groen",
    "Huisman",
    "Maas",
    "Van der Linden",

    // Row 5 - Add more names below as needed
    "Tent 41",
    "Tent 42",
    "Tent 43",
    "Tent 44",
    "Tent 45",
    "Tent 46",
    "Tent 47",
    "Tent 48",
    "Tent 49",
    "Tent 50"
];

// =============================================================================
// DRINK CATEGORIES AND PRICES
// =============================================================================
// Edit prices or add new drink items here.
// Each category has a name, price (in euros), and optional color for styling.
// The 'items' array lists the individual drinks shown on buttons.

const DRINK_CATEGORIES = [
    {
        name: "Snacks & Small Drinks",
        price: 1.50,
        color: "#4CAF50", // Green
        items: [
            "Chips",
            "Snacks",
            "Small Water",
            "Tea",
            "Coffee"
        ]
    },
    {
        name: "Soft Drinks",
        price: 2.00,
        color: "#2196F3", // Blue
        items: [
            "Cola",
            "Fanta",
            "Sprite",
            "Ice Tea",
            "Large Water",
            "Juice"
        ]
    },
    {
        name: "Regular Beer & Wine",
        price: 2.50,
        color: "#FF9800", // Orange
        items: [
            "1664 Beer",
            "1664 Beer 0.0",
            "Glass of Wine (Red)",
            "Glass of Wine (White)",
            "Glass of Wine (Rosé)"
        ]
    },
    {
        name: "Special Drinks",
        price: 4.00,
        color: "#9C27B0", // Purple
        items: [
            "Special Beer",
            "Red Bull",
            "IPA",
            "Desperados"
        ]
    },
    {
        name: "Spirits",
        price: 4.00,
        color: "#E91E63", // Pink
        items: [
            "Vodka",
            "Rum",
            "Whiskey",
            "Gin"
        ]
    },
    {
        name: "Bottles",
        price: 10.00,
        color: "#795548", // Brown
        items: [
            "Bottle of Wine (Red)",
            "Bottle of Wine (White)",
            "Bottle of Wine (Rosé)"
        ]
    }
];

// =============================================================================
// APP SETTINGS
// =============================================================================

const APP_CONFIG = {
    // How long the undo button stays visible (in milliseconds)
    undoTimeoutMs: 8000,

    // Currency symbol
    currency: "€",

    // Locale for number formatting (e.g., "nl-NL" for Dutch, "en-US" for US)
    locale: "nl-NL",

    // App title shown in header
    appTitle: "Campsite Honesty Bar",

    // Storage key prefix for localStorage
    storagePrefix: "campsiteBar_"
};

// Export for use in other modules (works in browser without module bundler)
if (typeof window !== 'undefined') {
    window.GUEST_NAMES = GUEST_NAMES;
    window.DRINK_CATEGORIES = DRINK_CATEGORIES;
    window.APP_CONFIG = APP_CONFIG;
}
