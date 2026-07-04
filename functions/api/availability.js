const WINDOWS = [
  "Morning: 8 AM - 10 AM",
  "Late Morning: 10 AM - 12 PM",
  "Afternoon: 12 PM - 2 PM",
  "Late Afternoon: 2 PM - 4 PM",
  "Evening: 4 PM - 6 PM",
];

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  },
});

const isIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || "");

export async function onRequestGet({ request, env }) {
  if (!env.DB) {
    return json({ message: "Booking calendar is not configured yet." }, 503);
  }

  const url = new URL(request.url);
  const date = url.searchParams.get("date");

  if (!isIsoDate(date)) {
    return json({ message: "Please choose a valid pickup date." }, 400);
  }

  const result = await env.DB.prepare(`
    SELECT preferred_window
    FROM bookings
    WHERE preferred_day = ?
      AND status IN ('pending', 'confirmed')
  `).bind(date).all();

  const booked = new Set((result.results || []).map((row) => row.preferred_window));
  const windows = WINDOWS.map((window) => ({
    window,
    available: !booked.has(window),
  }));

  return json({ date, windows });
}
