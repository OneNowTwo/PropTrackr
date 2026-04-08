# PropTrackr Chrome extension

Save the listing on your current tab to your PropTrackr account in one click (after you’re signed in on [PropTrackr](https://proptrackr.onrender.com)).

## Install (developer mode)

1. Open Chrome and go to `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked**.
4. Choose this folder: `PropTrackr/chrome-extension` (the directory that contains `manifest.json`).

## Use it

1. Sign in to PropTrackr in Chrome (same browser profile): open [proptrackr.onrender.com](https://proptrackr.onrender.com) and complete sign-in so session cookies exist for that site.
2. Open a property listing page in a normal tab (http/https).
3. Click the PropTrackr extension icon.
4. Confirm the URL, then click **Save to PropTrackr**.
5. Wait for **Saved!** and use **View in PropTrackr →**, or open the app from **Open PropTrackr**.

If you see **Please log in to PropTrackr first**, use the sign-in link in the popup, sign in, then try again.

## Icons

`icon16.png`, `icon48.png`, and `icon128.png` are tiny placeholders. Replace them with your own assets (same filenames) if you want custom branding.

## CORS note

The API echoes your extension’s `Origin` (for example `chrome-extension://abcdefghijklmnopqrstuvwxyz123456`) because browsers do not allow `Access-Control-Allow-Origin: *` together with credentials.
