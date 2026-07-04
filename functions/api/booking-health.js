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
  "BOOKING_NOTIFY_TO",
  "BOOKING_FROM",
];

const missing = (env, names) => names.filter((name) => !env[name]);

export async function onRequestGet({ env }) {
  const missingCalendar = missing(env, calendarVars);
  const missingEmail = missing(env, emailVars);
  const resendConfigured = Boolean(env.RESEND_API_KEY);
  const calendarEmailConfigured = missingCalendar.length === 0 && missingEmail.length === 0;

  return json({
    ok: missingCalendar.length === 0 && (calendarEmailConfigured || resendConfigured),
    calendarConfigured: missingCalendar.length === 0,
    emailConfigured: calendarEmailConfigured || resendConfigured,
    calendarEmailConfigured,
    resendConfigured,
    missingCalendar,
    missingEmail,
    missingResend: resendConfigured ? [] : ["RESEND_API_KEY"],
  }, missingCalendar.length === 0 && (calendarEmailConfigured || resendConfigured) ? 200 : 503);
}
