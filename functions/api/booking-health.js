const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  },
});

const calendarVars = [
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_PRIVATE_KEY",
  "GOOGLE_CALENDAR_ID",
];

const emailVars = [
  "RESEND_API_KEY",
  "BOOKING_NOTIFY_TO",
  "BOOKING_FROM",
];

const missing = (env, names) => names.filter((name) => !env[name]);

export async function onRequestGet({ env }) {
  const missingCalendar = missing(env, calendarVars);
  const missingEmail = missing(env, emailVars);

  return json({
    ok: missingCalendar.length === 0 && missingEmail.length === 0,
    calendarConfigured: missingCalendar.length === 0,
    emailConfigured: missingEmail.length === 0,
    missingCalendar,
    missingEmail,
  }, missingCalendar.length === 0 && missingEmail.length === 0 ? 200 : 503);
}
