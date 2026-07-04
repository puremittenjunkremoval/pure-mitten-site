const WINDOWS = [
  { label: "Morning: 8 AM - 10 AM", start: "08:00", end: "10:00" },
  { label: "Late Morning: 10 AM - 12 PM", start: "10:00", end: "12:00" },
  { label: "Afternoon: 12 PM - 2 PM", start: "12:00", end: "14:00" },
  { label: "Late Afternoon: 2 PM - 4 PM", start: "14:00", end: "16:00" },
  { label: "Evening: 4 PM - 6 PM", start: "16:00", end: "18:00" },
];

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const TIME_ZONE = "America/Detroit";
const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
let tokenCache = null;

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  },
});

const clean = (value) => String(value || "").trim();
const isIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || "");
const field = (formData, name) => clean(formData.get(name));

const escapeHtml = (value) => clean(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

const plainText = (value) => clean(value).replace(/\r?\n/g, "\n");

const base64Url = (value) => {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";

  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const bytesToBase64 = (bytes) => {
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
};

const pemToArrayBuffer = (pem) => {
  const base64 = pem
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
};

const getAccessToken = async (env) => {
  const now = Math.floor(Date.now() / 1000);

  if (tokenCache && tokenCache.expiresAt > now + 60) {
    return tokenCache.accessToken;
  }

  if (!env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_PRIVATE_KEY) {
    throw new Error("Google Calendar service account is not configured.");
  }

  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(JSON.stringify({
    iss: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    scope: CALENDAR_SCOPE,
    aud: TOKEN_URL,
    exp: now + 3600,
    iat: now,
  }));
  const unsignedJwt = `${header}.${claim}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(env.GOOGLE_PRIVATE_KEY),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsignedJwt)
  );
  const assertion = `${unsignedJwt}.${base64Url(new Uint8Array(signature))}`;
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const data = await response.json();
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: now + Number(data.expires_in || 3600),
  };

  return tokenCache.accessToken;
};

const googleRequest = async (env, path, options = {}) => {
  if (!env.GOOGLE_CALENDAR_ID) {
    throw new Error("Google Calendar ID is not configured.");
  }

  const accessToken = await getAccessToken(env);

  return fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
};

const zonedDateTime = (date, time) => `${date}T${time}:00`;

const slotRange = (date, slot) => ({
  start: zonedDateTime(date, slot.start),
  end: zonedDateTime(date, slot.end),
});

const zonedTimeToUtc = (date, time, timeZone) => {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(utcGuess);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const asZoneTime = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  );
  const offset = asZoneTime - utcGuess.getTime();

  return new Date(utcGuess.getTime() - offset);
};

const slotUtcRange = (date, slot, timeZone) => ({
  start: zonedTimeToUtc(date, slot.start, timeZone),
  end: zonedTimeToUtc(date, slot.end, timeZone),
});

const deterministicEventId = async (booking) => {
  const bytes = new TextEncoder().encode(`puremitten:${booking.preferred_day}:${booking.preferred_window}`);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  const hex = Array.from(hash).map((byte) => byte.toString(16).padStart(2, "0")).join("");

  return `pmjr${hex}`;
};

const isFileUpload = (value) => (
  value &&
  typeof value === "object" &&
  typeof value.name === "string" &&
  typeof value.size === "number" &&
  value.size > 0
);

const isSlotBusy = async (env, date, slot, timeZone) => {
  const range = slotUtcRange(date, slot, timeZone);
  const response = await googleRequest(env, "/freeBusy", {
    method: "POST",
    body: JSON.stringify({
      timeMin: range.start.toISOString(),
      timeMax: range.end.toISOString(),
      timeZone,
      items: [{ id: env.GOOGLE_CALENDAR_ID }],
    }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const data = await response.json();
  const busy = data.calendars?.[env.GOOGLE_CALENDAR_ID]?.busy || [];

  return busy.length > 0;
};

const buildDescription = (booking) => [
  "New pickup booking request",
  "",
  `Name: ${booking.name}`,
  `Phone: ${booking.phone}`,
  `Email: ${booking.email}`,
  `Pickup address: ${booking.pickup_address}`,
  `City / ZIP: ${booking.pickup_city} ${booking.pickup_zip}`,
  `Location type: ${booking.location_type}`,
  `Customer present: ${booking.customer_present}`,
  `Estimated load: ${booking.estimated_load || "Not sure yet"}`,
  `Job notes: ${booking.job_notes || "None selected"}`,
  `Photos attached to email: ${booking.photo_count}`,
  "",
  "Items to remove:",
  plainText(booking.items_to_remove),
].join("\n");

const buildEmailHtml = (booking) => `
  <h1>New pickup booking request</h1>
  <p><strong>Preferred window:</strong> ${escapeHtml(booking.preferred_day)} ${escapeHtml(booking.preferred_window)}</p>
  <p><strong>Name:</strong> ${escapeHtml(booking.name)}</p>
  <p><strong>Phone:</strong> ${escapeHtml(booking.phone)}</p>
  <p><strong>Email:</strong> ${escapeHtml(booking.email)}</p>
  <p><strong>Pickup address:</strong> ${escapeHtml(booking.pickup_address)}</p>
  <p><strong>City / ZIP:</strong> ${escapeHtml(booking.pickup_city)} ${escapeHtml(booking.pickup_zip)}</p>
  <p><strong>Location type:</strong> ${escapeHtml(booking.location_type)}</p>
  <p><strong>Customer present:</strong> ${escapeHtml(booking.customer_present)}</p>
  <p><strong>Estimated load:</strong> ${escapeHtml(booking.estimated_load || "Not sure yet")}</p>
  <p><strong>Job notes:</strong> ${escapeHtml(booking.job_notes || "None selected")}</p>
  <p><strong>Items to remove:</strong><br>${escapeHtml(booking.items_to_remove).replace(/\n/g, "<br>")}</p>
  <p><strong>Photos attached:</strong> ${booking.photo_count}</p>
`;

const collectAttachments = async (files) => {
  const attachments = [];
  let totalBytes = 0;

  for (const file of files.slice(0, MAX_ATTACHMENTS)) {
    totalBytes += file.size;
    if (totalBytes > MAX_ATTACHMENT_BYTES) break;

    const bytes = new Uint8Array(await file.arrayBuffer());
    attachments.push({
      filename: file.name,
      content: bytesToBase64(bytes),
    });
  }

  return attachments;
};

const sendNotificationEmail = async (env, booking, files) => {
  if (!env.RESEND_API_KEY || !env.BOOKING_NOTIFY_TO || !env.BOOKING_FROM) {
    return { sent: false, reason: "Email environment variables are not configured." };
  }

  const attachments = await collectAttachments(files);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.BOOKING_FROM,
      to: env.BOOKING_NOTIFY_TO.split(",").map((item) => item.trim()).filter(Boolean),
      subject: `New pickup request: ${booking.preferred_day} ${booking.preferred_window}`,
      html: buildEmailHtml(booking),
      attachments,
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    return { sent: false, reason: message };
  }

  return { sent: true };
};

export async function onRequestPost({ request, env }) {
  const formData = await request.formData();

  if (field(formData, "_honey")) {
    return json({ ok: true });
  }

  const files = formData.getAll("attachment").filter(isFileUpload);
  const booking = {
    pickup_city: field(formData, "pickup_city"),
    pickup_zip: field(formData, "pickup_zip"),
    preferred_day: field(formData, "preferred_day"),
    preferred_window: field(formData, "preferred_window"),
    location_type: field(formData, "location_type"),
    customer_present: field(formData, "customer_present"),
    pickup_address: field(formData, "pickup_address"),
    name: field(formData, "name"),
    phone: field(formData, "phone"),
    email: field(formData, "email"),
    estimated_load: field(formData, "estimated_load"),
    job_notes: formData.getAll("job_notes[]").map(clean).filter(Boolean).join(", "),
    items_to_remove: field(formData, "items_to_remove"),
    photo_count: files.length,
  };
  const required = [
    "pickup_city",
    "preferred_day",
    "preferred_window",
    "location_type",
    "customer_present",
    "pickup_address",
    "name",
    "phone",
    "email",
    "items_to_remove",
  ];
  const missing = required.filter((name) => !booking[name]);

  if (missing.length) {
    return json({ message: "Please fill out all required booking fields." }, 400);
  }

  if (!isIsoDate(booking.preferred_day)) {
    return json({ message: "Please choose a valid pickup date." }, 400);
  }

  const selectedSlot = WINDOWS.find((slot) => slot.label === booking.preferred_window);
  if (!selectedSlot) {
    return json({ message: "Please choose a valid pickup window." }, 400);
  }

  try {
    const timeZone = env.GOOGLE_CALENDAR_TIME_ZONE || TIME_ZONE;
    const range = slotRange(booking.preferred_day, selectedSlot);
    const calendar = encodeURIComponent(env.GOOGLE_CALENDAR_ID);
    const eventId = await deterministicEventId(booking);

    if (await isSlotBusy(env, booking.preferred_day, selectedSlot, timeZone)) {
      return json({ message: "That pickup window is no longer available. Please choose another time." }, 409);
    }

    const response = await googleRequest(env, `/calendars/${calendar}/events?sendUpdates=none`, {
      method: "POST",
      body: JSON.stringify({
        id: eventId,
        summary: `Pickup request - ${booking.name} - ${booking.pickup_city}`,
        location: booking.pickup_address,
        description: buildDescription(booking),
        start: { dateTime: range.start, timeZone },
        end: { dateTime: range.end, timeZone },
        extendedProperties: {
          private: {
            source: "pure-mitten-booking-form",
            preferred_day: booking.preferred_day,
            preferred_window: booking.preferred_window,
            customer_phone: booking.phone,
            customer_email: booking.email,
          },
        },
      }),
    });

    if (response.status === 409) {
      return json({ message: "That pickup window is no longer available. Please choose another time." }, 409);
    }

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const event = await response.json();
    const email = await sendNotificationEmail(env, booking, files);

    return json({
      ok: true,
      eventId: event.id,
      eventLink: event.htmlLink,
      emailSent: email.sent,
    });
  } catch (error) {
    return json({ message: "Something went wrong sending the booking request. Please call or text 734-480-8190." }, 500);
  }
}
