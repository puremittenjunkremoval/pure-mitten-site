# Google Calendar Booking Setup

The booking page uses two API routes:

- `/api/availability?date=YYYY-MM-DD`
- `/api/bookings`

These are Cloudflare Pages Functions that talk to Google Calendar. Availability checks use Google Calendar busy windows, and booking requests create a calendar event for the selected pickup window.

## 1. Create the Google service account

In Google Cloud Console:

1. Create or open a Google Cloud project.
2. Enable the Google Calendar API.
3. Create a service account.
4. Create a JSON key for that service account.
5. Open the Google Calendar you want to use for bookings, then share it with the service account email and give it permission to make changes to events.

## 2. Add Cloudflare Pages environment variables

Add these variables to the Pure Mitten Cloudflare Pages project:

```text
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
GOOGLE_CALENDAR_ID=your-calendar-id@group.calendar.google.com
GOOGLE_CALENDAR_TIME_ZONE=America/Detroit
```

Use the `client_email` value from the service account JSON for `GOOGLE_SERVICE_ACCOUNT_EMAIL`.

Use the `private_key` value from the service account JSON for `GOOGLE_PRIVATE_KEY`. Keep the `\n` line breaks exactly as Google provides them.

## 3. Email notifications

The Google Calendar event itself becomes the main booking record. If you also want email notifications with uploaded photos, add:

```text
RESEND_API_KEY=your_resend_api_key
BOOKING_NOTIFY_TO=info@puremittenjunkremoval.com,sales@puremittenjunkremoval.com
BOOKING_FROM=Pure Mitten Junk Removal <bookings@puremittenjunkremoval.com>
```

The `BOOKING_FROM` domain needs to be verified in Resend.

## 4. How double-booking prevention works

Each pickup window creates one Google Calendar event with a deterministic event ID based on the day and time window. If two customers submit the same window, Google Calendar rejects the second event with a conflict, and the customer is asked to choose another time.

The availability endpoint also checks the calendar's busy windows, so manually blocked calendar time can hide slots from the form.

## 5. Test

After deployment, visit:

```text
https://puremittenjunkremoval.com/api/availability?date=2026-07-10
```

Then submit the booking form twice for the same date and time window. The first request should create a Google Calendar event, and the second should ask the customer to pick another window.
