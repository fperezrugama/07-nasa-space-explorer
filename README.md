# Project 7: NASA API - Space Explorer App
NASA releases a new "Astronomy Picture of the Day" (APOD) every day—spotlighting breathtaking images of galaxies, stars, planets, and more.

Your task is to build an interactive web app that fetches and displays these photos using [NASA's API](https://api.nasa.gov/). Users will pick a date range and instantly view stunning photos from across the cosmos, along with titles and descriptions.

You'll get to use your skills to build something that's actually connected to real-world data from one of the most iconic organizations in the world.

## Starter Files
- The provided files include a NASA logo, date inputs, a button, a placeholder for your gallery, and basic layout and styling to help you get started.
- It also includes built-in logic (in `dateRange.js`) to handle the valid APOD date range—from June 16, 1995 to today. No need to modify it.
- All your custom JavaScript should go in `script.js`. That's where you'll write the code that fetches data and displays your gallery.

## Features
- Browse APOD images and NASA videos by selecting a date range.
- Search loaded discoveries by title or description.
- Save favorite discoveries in the browser with `localStorage`.
- Open any discovery in an accessible detail lightbox.
- Switch between dark and light themes with a responsive NASA-inspired layout.

## Secure NASA API proxy

The GitHub Pages frontend does not contain a NASA API key. It requests APOD data
from the Cloudflare Worker in [`worker/`](./worker), which reads the
`NASA_API_KEY` secret server-side and forwards only sanitized APOD fields.

### Configure the Worker locally

1. Install Wrangler if needed: `npm install --save-dev wrangler`.
2. From the worker directory, create a local secret file:
   `cp .dev.vars.example .dev.vars`
3. Edit `.dev.vars` locally and set `NASA_API_KEY` to your key. Never commit this file.
4. Test locally with `npx wrangler dev`.
5. Add the deployed Worker URL to `APOD_PROXY_URL` near the top of
   [`js/script.js`](./js/script.js), replacing the `YOUR_SUBDOMAIN` placeholder.

### Configure the production secret

From the `worker/` directory, run this command yourself. Do not put the key in
the repository or in frontend code:

```bash
npx wrangler secret put NASA_API_KEY
```

Alternatively, in the Cloudflare dashboard, open **Workers & Pages**, select the
Worker, open **Settings → Variables and Secrets**, choose **Add**, select
**Secret**, name it `NASA_API_KEY`, paste the value, and save it.

Deploy only after reviewing the Worker and confirming the GitHub Pages origin in
`worker/index.js`. The Worker validates dates, limits ranges to 31 days, applies
origin checks, caches successful responses, and applies a per-IP in-memory
rate limit. Cloudflare's production rate-limiting rules can provide stronger
cross-instance enforcement if needed.
