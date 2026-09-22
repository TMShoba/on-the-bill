# Install The LineUp as a mobile app (PWA)

The LineUp is packaged as a **Progressive Web App**. Users can install it on phones and desktops without the App Store.

## For users

### Android (Chrome)
1. Open the live site (e.g. https://on-the-bill.vercel.app)
2. Menu ⋮ → **Install app** / **Add to Home screen**
3. Confirm — the app icon appears on the home screen and opens full-screen

### iPhone / iPad (Safari)
1. Open the site in **Safari**
2. Tap **Share** → **Add to Home Screen**
3. Name it **The LineUp** → Add

### Desktop (Chrome / Edge)
1. Open the site
2. Click the **install** icon in the address bar (or Menu → Install The LineUp)

## For developers

Files added:
- `frontend/public/manifest.webmanifest` — app name, icons, theme
- `frontend/public/sw.js` — offline shell cache
- `frontend/public/icons/` — 192 / 512 / apple-touch icons
- `index.html` — manifest link + service worker registration

Deploy the **frontend** as usual (Vercel). HTTPS is required for install prompts (Vercel provides this).

## Optional: native stores later

For Google Play / App Store distribution, wrap the same web app with **Capacitor**:

```bash
cd frontend
npm install @capacitor/core @capacitor/cli
npx cap init "The LineUp" co.thelineup.app
npx cap add android
npx cap add ios
npm run build && npx cap sync
```

Then open Android Studio / Xcode to build store binaries. PWA is enough for most early users.
