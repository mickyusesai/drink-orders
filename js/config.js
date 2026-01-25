/**
 * CAMPING DU LAC - HONESTY BAR CONFIGURATIE
 *
 * Bewerk dit bestand om gastnamen en drankprijzen aan te passen.
 */

// =============================================================================
// GASTNAMEN
// =============================================================================
// Wijzig deze lijst aan het begin van elke nieuwe week.
// Je kunt maximaal 50 gasten toevoegen. Voeg namen toe of verwijder ze indien nodig.
// Namen verschijnen als knoppen in de onderstaande volgorde.

const GUEST_NAMES = [
    // Rij 1 - Voorbeeldfamilies
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

    // Rij 2
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

    // Rij 3
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

    // Rij 4
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

    // Rij 5 - Voeg meer namen toe indien nodig
    "Plek 41",
    "Plek 42",
    "Plek 43",
    "Plek 44",
    "Plek 45",
    "Plek 46",
    "Plek 47",
    "Plek 48",
    "Plek 49",
    "Plek 50"
];

// =============================================================================
// DRANKCATEGORIEËN EN PRIJZEN
// =============================================================================
// Bewerk prijzen of voeg nieuwe drankjes toe.
// Elke categorie heeft een naam, prijs (in euro's) en een optionele kleur.

const DRINK_CATEGORIES = [
    {
        name: "Snacks & Kleine drankjes",
        price: 1.50,
        color: "#2D5A27", // Forest green
        items: [
            "Chips",
            "Snacks",
            "Klein water",
            "Thee",
            "Koffie"
        ]
    },
    {
        name: "Frisdrank & Water",
        price: 2.00,
        color: "#1E6B8C", // Lake blue
        items: [
            "Fris",
            "Groot water"
        ]
    },
    {
        name: "Bier & Wijn per glas",
        price: 2.50,
        color: "#8B6914", // Amber/beer color
        items: [
            "1664 Bier",
            "1664 Bier 0.0",
            "Glas wijn"
        ]
    },
    {
        name: "Specials & Mixers",
        price: 4.00,
        color: "#7B3B3B", // Deep red
        items: [
            "Speciaal bier",
            "Redbull",
            "IPA",
            "Desperados",
            "Mixer (rum etc.)"
        ]
    },
    {
        name: "Flessen",
        price: 10.00,
        color: "#5C3D2E", // Wine brown
        items: [
            "Fles wijn"
        ]
    }
];

// =============================================================================
// APP INSTELLINGEN
// =============================================================================

const APP_CONFIG = {
    // Hoe lang de ongedaan-knop zichtbaar blijft (in milliseconden)
    undoTimeoutMs: 8000,

    // Valutasymbool
    currency: "€",

    // Locale voor getalnotatie (bijv. "nl-NL" voor Nederlands)
    locale: "nl-NL",

    // App-titel in de header
    appTitle: "Camping du Lac",
    appSubtitle: "Honesty Bar",

    // Opslagsleutel prefix voor localStorage
    storagePrefix: "campingDuLac_"
};

// Export voor gebruik in andere modules
if (typeof window !== 'undefined') {
    window.GUEST_NAMES = GUEST_NAMES;
    window.DRINK_CATEGORIES = DRINK_CATEGORIES;
    window.APP_CONFIG = APP_CONFIG;
}
