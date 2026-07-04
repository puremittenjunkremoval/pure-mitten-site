# Booking Backend Setup

The booking page now uses live availability checks through two API routes:

- `/api/availability?date=YYYY-MM-DD`
- `/api/bookings`

These routes are Cloudflare Pages Functions. They need a Cloudflare D1 database binding named `DB`.

## 1. Create the D1 database

Create a Cloudflare D1 database named `pure-mitten-bookings`, then run:

```bash
npx wrangler d1 execute pure-mitten-bookings --file=database/schema.sql --remote
```

You can also paste `database/schema.sql` into the D1 console in the Cloudflare dashboard.

## 2. Bind the database

In Cloudflare Pages, open the Pure Mitten project settings and add a D1 binding:

```text
Variable name: DB
Database: pure-mitten-bookings
```

The database has a unique active slot rule for `preferred_day + preferred_window`, so a second request for the same active window is rejected.

## 3. Email notifications

Add these environment variables in Cloudflare Pages if you want booking requests emailed:

```text
RESEND_API_KEY=your_resend_api_key
BOOKING_NOTIFY_TO=info@puremittenjunkremoval.com,sales@puremittenjunkremoval.com
BOOKING_FROM=Pure Mitten Junk Removal <bookings@puremittenjunkremoval.com>
```

The `BOOKING_FROM` domain needs to be verified in Resend.

## 4. Test

After deployment, visit:

```text
https://puremittenjunkremoval.com/api/availability?date=2026-07-10
```

Then submit the booking form twice for the same date and time window. The first request should save, and the second should ask the customer to pick another window.
