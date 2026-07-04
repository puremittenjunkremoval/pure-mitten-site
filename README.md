# Pure Mitten Junk Removal Website

Static multi-page website for Pure Mitten Junk Removal, deployed on Cloudflare Pages with Pages Functions for booking APIs.

## Cloudflare Pages

Project name: `pure-mitten-site`
Production branch: `main`
Build command: leave blank or use `npm install`
Build output directory: `public`
Functions directory: `functions`

The checked-in `wrangler.jsonc` sets `pages_build_output_dir` to `public` because the site is plain HTML/CSS/JS and does not need a build step.

## Local development

Install dependencies once:

```bash
npm install
```

Run the Pages dev server:

```bash
npm run dev
```

For local booking API testing, create a `.dev.vars` file with the Google Calendar and optional Resend variables from `BOOKING_BACKEND.md`.

## Deploy

Deploy directly with Wrangler:

```bash
npm run deploy
```

Or connect the GitHub repo to Cloudflare Pages and use the settings above for automatic deploys from `main`.

## Pages

- `index.html` - Home
- `services.html` - Services
- `pricing.html` - Load sizes and minimum pickup
- `about.html` - About and service area
- `quote.html` - Booking request form

## Assets

The published site uses files in the `public/assets/` folder for the logo and Michigan outline. Keep the folder structure the same so the image paths continue to work.
