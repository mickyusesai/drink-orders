# Campsite Honesty Bar

A simple, touch-friendly web app for tracking drink orders at a campsite honesty bar.

## Features

- **Touch-friendly interface** - Large buttons for easy tapping on tablets and phones
- **Guest management** - 50 guest slots per week with customizable names
- **Drink categories** - Organized by price with easy configuration
- **Running tabs** - Automatic price tracking per guest
- **Immediate undo** - Guests can undo a drink only immediately after adding
- **Tab viewing** - Guests can see their current tab at any time
- **Organizer view** - Overview of all tabs, mark as paid, export data
- **Data persistence** - Uses browser localStorage (survives page refresh)
- **Responsive design** - Works on tablets, phones, and laptops

## Quick Start

### Option 1: Open directly in browser

Simply open `index.html` in a modern web browser:

```bash
# On macOS
open index.html

# On Linux
xdg-open index.html

# Or just double-click index.html in your file manager
```

### Option 2: Use a simple web server (recommended)

For the best experience, use a simple web server:

```bash
# Using Python 3
cd drink-orders
python3 -m http.server 8000

# Or using Node.js (if installed)
npx serve .

# Or using PHP (if installed)
php -S localhost:8000
```

Then open `http://localhost:8000` in your browser.

### Option 3: Use Node.js server (for additional robustness)

If you want a more robust setup with optional JSON file backup, you can create a simple Node.js server. See the "Optional Node.js Server" section below.

## How to Use

### For Guests

1. **Add Drinks**
   - Tap your name from the guest list
   - Tap the drink you're taking
   - A confirmation message appears with your new total
   - If you made a mistake, tap "Undo" immediately

2. **View Your Tab**
   - Tap "View Tab" in the navigation
   - Select your name from the dropdown
   - See all drinks and your total

### For Organisers

1. **Access Admin View**
   - Tap "Organiser" in the navigation

2. **View Summary**
   - See total revenue, paid/unpaid amounts
   - View all guests with tabs

3. **Mark Guests as Paid**
   - Click "Mark Paid" next to a guest
   - Once paid, no more drinks can be added

4. **Export Data**
   - **Print Overview**: Opens a printable page
   - **Copy CSV**: Copies summary to clipboard
   - **Download CSV**: Downloads summary file
   - **Detailed CSV**: Downloads all individual drink entries
   - **Backup Data**: Downloads full JSON backup

5. **Start New Week**
   - Click "New Week" to clear all data
   - Make sure to export/print first!

## Configuration

### Changing Guest Names

Edit `js/config.js` and modify the `GUEST_NAMES` array:

```javascript
const GUEST_NAMES = [
    "Family Smith",
    "The Johnsons",
    "Tent 3",
    // ... add up to 50 names
];
```

### Changing Drink Categories and Prices

Edit `js/config.js` and modify the `DRINK_CATEGORIES` array:

```javascript
const DRINK_CATEGORIES = [
    {
        name: "Category Name",
        price: 2.50,  // Price in euros
        color: "#FF9800",  // Button color
        items: [
            "Drink 1",
            "Drink 2",
            // ...
        ]
    },
    // ... more categories
];
```

### Other Settings

In `js/config.js`, you can also modify:

```javascript
const APP_CONFIG = {
    undoTimeoutMs: 8000,     // How long undo button shows (milliseconds)
    currency: "€",           // Currency symbol
    locale: "nl-NL",         // Number/date formatting locale
    appTitle: "Campsite Honesty Bar",  // App title
    storagePrefix: "campsiteBar_"      // localStorage key prefix
};
```

## Data Storage

By default, all data is stored in the browser's localStorage. This means:

- Data survives page refreshes and browser restarts
- Data is tied to the specific browser on the specific device
- Clearing browser data will erase the tabs

### Backing Up Data

1. Go to Organiser view
2. Click "Backup Data" to download a JSON file
3. Store this file safely

### Restoring Data

If you need to restore from a backup, open the browser console (F12) and run:

```javascript
Storage.restore('{"paste your JSON backup here"}');
location.reload();
```

## Optional Node.js Server

For a more robust setup with server-side storage, create a `server.js` file:

```javascript
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const DATA_FILE = 'bar-data.json';

const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json'
};

const server = http.createServer((req, res) => {
    // Handle API endpoints
    if (req.url === '/api/data' && req.method === 'GET') {
        if (fs.existsSync(DATA_FILE)) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(fs.readFileSync(DATA_FILE));
        } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end('{}');
        }
        return;
    }

    if (req.url === '/api/data' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            fs.writeFileSync(DATA_FILE, body);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end('{"success": true}');
        });
        return;
    }

    // Serve static files
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(__dirname, filePath);

    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404);
            res.end('Not found');
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

server.listen(PORT, () => {
    console.log(`Honesty Bar running at http://localhost:${PORT}`);
});
```

Then run with: `node server.js`

## Project Structure

```
drink-orders/
├── index.html          # Main HTML file
├── css/
│   └── styles.css      # All styles
├── js/
│   ├── config.js       # Guest names & drink prices (EDIT THIS)
│   ├── storage.js      # LocalStorage handling
│   ├── app.js          # Main application logic
│   └── admin.js        # Organiser/admin functions
└── README.md           # This file
```

## Browser Support

Works in all modern browsers:
- Chrome / Chromium
- Firefox
- Safari
- Edge

## Tips for Campsite Use

1. **Set up a dedicated device** - Use a tablet mounted at the bar
2. **Enable kiosk mode** - Most browsers have a fullscreen/kiosk mode
3. **Disable sleep** - Keep the screen always on
4. **Weekly routine**:
   - Start of week: Update guest names in `config.js`
   - End of week: Export data, mark everyone as paid, click "New Week"

## Troubleshooting

**Data disappeared after update?**
- Data is stored in localStorage. If you changed the `storagePrefix` in config, old data won't be found.

**App looks broken?**
- Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)
- Clear browser cache and reload

**Need to reset everything?**
- Open browser console (F12) and run: `localStorage.clear(); location.reload();`

## License

Free to use for personal and commercial purposes.
