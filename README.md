# Camping du Lac — Honesty Bar

A touch-friendly web app (Dutch UI) for tracking drink orders at the Camping du Lac honesty bar. Runs 24/7 on a tablet; data syncs in real time between devices via Firebase.

## Features

- **Touch-friendly interface** — large buttons for tablets, entry code gate for guests
- **Ordering flow** — tap your name, tap a drink, immediate undo, "Bekijk totaal" shows your bill
- **Editable menu** — categories (Bieren, Wijnen, Non-alcoholisch, Warme dranken, Snacks + toggleable Cocktails and Panini's) with per-item prices, all editable in the admin dashboard
- **Guest management** — add, rename, or remove guests; paste a list of names to import (add or replace)
- **Payments** — mark tabs paid as *Contant* or *PIN*; totals split by method in the summary and CSV exports
- **Multi-device sync** — orders are written per guest with conflict-safe transactions to Firebase Realtime Database; offline orders are queued and replayed on reconnect
- **Data safety** — automatic daily backup snapshots (last 7, local + cloud) restorable from the admin dashboard; an empty cloud state can never wipe local data; "Nieuwe Week" uses an explicit reset signal
- **Kiosk-ready** — Screen Wake Lock keeps the tablet awake (requires HTTPS); a small dot bottom-right always shows the sync status (green = online, red = offline)
- **Admin dashboard** (PIN-protected) — summary, per-guest details, add/remove items, Receptie items, print view, CSV exports (Dutch Excel format), backup/restore, changeable PIN codes

## Running

No build step — static files only.

```bash
npx serve -s . -l 3000      # same command the Railway deployment uses
```

Deployment: Railway (`railway.json`), served with the `serve` package.

## Weekly routine

1. Start of week: import/adjust the guest list in Beheer (paste names, one per line)
2. During the week: everything syncs automatically; daily backups are kept automatically
3. End of week: settle tabs (Contant/PIN), export or print, then **Nieuwe Week** (downloads a backup first and clears all devices)

## Configuration

`js/config.js` contains the *defaults*: guest names (`GUEST_NAMES`), the menu seed (`DEFAULT_MENU`), and app settings (`APP_CONFIG`, including the default PIN codes). Once you edit the menu or PINs in the admin dashboard, those saved values take precedence and sync to all devices — you normally never need to edit this file again.

The Firebase project (`camping-honesty-bar`) is configured in `js/firebase.js`. Note that the database rules live in the Firebase console, not in this repo; ideally restrict them, since the config in the shipped JS is public (the in-app daily `backups/` node is the safety net either way).

## Data storage

- **localStorage** (prefix `campingDuLac_`) is the working copy on each device: tabs, guest list, menu, category toggles, PIN overrides, pending offline writes, and auto-backup snapshots.
- **Firebase Realtime Database** is the shared source of truth between devices: `tabs/<guest>` (per-guest, transactional), `customGuests`, `menu`, `categoryToggles`, `settings/pins`, `meta/resetAt`, `backups/<date>`.
- **Restore**: Beheer → Herstellen shows the automatic snapshots (with date, guest count, and total) plus a file upload for downloaded JSON backups.

## Project structure

```
drink-orders/
├── index.html          # App shell: views + modals
├── css/styles.css      # All styles
├── js/
│   ├── config.js       # Defaults: guest names, menu seed, app settings
│   ├── firebase.js     # Realtime sync, offline queue, cloud backups
│   ├── storage.js      # localStorage persistence + business logic
│   ├── admin.js        # Admin dashboard
│   └── app.js          # Ordering UI, PIN gates, wake lock
├── images/             # Item icons + logos
├── package.json        # `serve` for production
└── railway.json        # Railway deployment config
```

## Tablet tips

1. Use HTTPS (Railway does) — the Wake Lock API doesn't work over plain HTTP
2. Also set the tablet's own display sleep to "never" and disable auto-updates/reboots as belt-and-braces
3. After deploying an update, the page picks it up on the next reload; the `?v=` query on the asset tags is bumped per release so the tablet never runs stale files

## Troubleshooting

- **App looks broken after an update** — hard refresh (Ctrl+Shift+R), or close and reopen the browser tab
- **Red dot bottom-right** — the tablet is offline; orders still work locally and sync automatically when the connection returns
- **Forgot the admin PIN** — on the tablet, open the browser console (F12) and run `localStorage.removeItem('campingDuLac_adminPin')` to fall back to the default from `config.js` (this device only, until it syncs a new one)

## License

Free to use for personal and commercial purposes.
