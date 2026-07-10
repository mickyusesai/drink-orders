/**
 * CAMPING DU LAC - HONESTY BAR CONFIGURATIE
 *
 * Bewerk dit bestand om gastnamen en drankprijzen aan te passen.
 */

// =============================================================================
// GASTNAMEN
// =============================================================================
// De gastenlijst wordt beheerd in het Beheer-scherm (namen toevoegen,
// importeren of hernoemen). De app start leeg; ook na "Nieuwe Week" is de
// lijst weer helemaal leeg.

const GUEST_NAMES = [];

// =============================================================================
// STANDAARD MENU
// =============================================================================
// Dit is het standaardmenu waarmee de app start. Het menu is daarna te
// bewerken in het Beheer-scherm ("Menu Bewerken"); wijzigingen worden
// opgeslagen en gesynchroniseerd, dus dit bestand hoeft niet meer te worden
// aangepast. "Reset naar standaard" in Beheer zet het menu terug naar deze lijst.
// Elk item heeft zijn eigen prijs (in euro's).

const DEFAULT_MENU = [
    {
        id: "bieren",
        name: "Bieren",
        color: "#f5a623", // Warm amber
        items: [
            { name: "1664 Bier", price: 2.50 },
            { name: "1664 Bier 0.0", price: 2.50 },
            { name: "Speciaal bier", price: 4.00 },
            { name: "IPA", price: 4.00 },
            { name: "Desperados", price: 4.00 }
        ]
    },
    {
        id: "wijnen",
        name: "Wijnen",
        color: "#7b2d5b", // Wine purple
        items: [
            { name: "Glas wijn", price: 2.50 },
            { name: "Fles wijn", price: 10.00 }
        ]
    },
    {
        id: "non-alcoholisch",
        name: "Non-alcoholisch",
        color: "#00a0d2", // Cyan blue (from camping website)
        items: [
            { name: "Fris", price: 2.00 },
            { name: "Groot water", price: 2.00 },
            { name: "Klein water", price: 1.50 },
            { name: "Redbull", price: 4.00 }
        ]
    },
    {
        id: "warme-dranken",
        name: "Warme dranken",
        color: "#8d6e63", // Coffee brown
        items: [
            { name: "Koffie", price: 1.50 },
            { name: "Thee", price: 1.50 }
        ]
    },
    {
        id: "snacks",
        name: "Snacks",
        color: "#7ed957", // Lime green (from camping website)
        items: [
            { name: "Chips", price: 1.50 },
            { name: "Snacks", price: 1.50 }
        ]
    },
    // ==========================================================================
    // SCHAKELBARE CATEGORIEËN (aan/uit te zetten in Beheer)
    // ==========================================================================
    {
        id: "cocktails",
        name: "Cocktails",
        color: "#9c27b0", // Purple
        toggleKey: "cocktails", // Unieke sleutel voor aan/uit zetten
        items: [
            { name: "Cocktail", price: 7.50 },
            { name: "Mocktail", price: 5.00 },
            { name: "Mixer (rum etc.)", price: 4.00 }
        ]
    },
    {
        id: "paninis",
        name: "Panini's",
        color: "#ff5722", // Deep orange
        toggleKey: "foodtruck", // Sleutel blijft "foodtruck" zodat bestaande instellingen behouden blijven
        items: [
            { name: "Panini", price: 5.00 },
            { name: "Smoothie", price: 3.50 }
        ]
    }
];

// =============================================================================
// APP INSTELLINGEN
// =============================================================================

const APP_CONFIG = {
    // Hoe lang de popup zichtbaar blijft voordat deze automatisch sluit (in milliseconden)
    popupTimeoutMs: 5000,

    // Valutasymbool
    currency: "€",

    // Locale voor getalnotatie (bijv. "nl-NL" voor Nederlands)
    locale: "nl-NL",

    // App-titel in de header
    appTitle: "Camping du Lac",
    appSubtitle: "Honesty Bar",

    // Opslagsleutel prefix voor localStorage
    storagePrefix: "campingDuLac_",

    // PIN code voor beheerderstoegang
    adminPin: "12345",

    // PIN code voor algemene toegang (gasten)
    entryPin: "12345"
};

// Export voor gebruik in andere modules
if (typeof window !== 'undefined') {
    window.GUEST_NAMES = GUEST_NAMES;
    window.DEFAULT_MENU = DEFAULT_MENU;
    window.APP_CONFIG = APP_CONFIG;
}
