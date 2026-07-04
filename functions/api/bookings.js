const WINDOWS = [
  "Morning: 8 AM - 10 AM",
  "Late Morning: 10 AM - 12 PM",
  "Afternoon: 12 PM - 2 PM",
  "Late Afternoon: 2 PM - 4 PM",
  "Evening: 4 PM - 6 PM",
];

const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  },
});

const clean = (value) => String(value || "").trim();
const isIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || "");

const escapeHtml = (value) => clean(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

const bytesToBase64 = (bytes) => {
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
};

const isFileUpload = (value) => (
  value &&
  typeof value === "object" &&
  typeof value.name === "string" &&
  typeof value.size === "number" &&
  value.size > 0
);

const field = (formData, name) => clean(formData.get(name));

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

const hasUniqueSlotError = (error) => /unique|constraint/i.test(error?.message || "");

export async function onRequestPost({ request, env }) {
  if (!env.DB) {
    return json({ message: "Booking calendar is not configured yet. Please call or text 734-480-8190." }, 503);
  }

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
    user_agent: clean(request.headers.get("user-agent")),
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

  if (!WINDOWS.includes(booking.preferred_window)) {
    return json({ message: "Please choose a valid pickup window." }, 400);
  }

  try {
    const result = await env.DB.prepare(`
      INSERT INTO bookings (
        pickup_city,
        pickup_zip,
        preferred_day,
        preferred_window,
        location_type,
        customer_present,
        pickup_address,
        name,
        phone,
        email,
        estimated_load,
        job_notes,
        items_to_remove,
        photo_count,
        user_agent
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      booking.pickup_city,
      booking.pickup_zip,
      booking.preferred_day,
      booking.preferred_window,
      booking.location_type,
      booking.customer_present,
      booking.pickup_address,
      booking.name,
      booking.phone,
      booking.email,
      booking.estimated_load,
      booking.job_notes,
      booking.items_to_remove,
      booking.photo_count,
      booking.user_agent
    ).run();

    const email = await sendNotificationEmail(env, booking, files);

    return json({
      ok: true,
      bookingId: result.meta?.last_row_id || null,
      emailSent: email.sent,
    });
  } catch (error) {
    if (hasUniqueSlotError(error)) {
      return json({ message: "That pickup window is no longer available. Please choose another time." }, 409);
    }

    return json({ message: "Something went wrong sending the booking request. Please call or text 734-480-8190." }, 500);
  }
}
