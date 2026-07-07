const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  },
});

const placesKey = (env) => env.GOOGLE_PLACES_API_KEY || env.GOOGLE_MAPS_API_KEY;

const component = (components, type) => (
  components.find((item) => Array.isArray(item.types) && item.types.includes(type)) || null
);

const streetAddress = (components, fallback) => {
  const streetNumber = component(components, "street_number")?.longText || "";
  const route = component(components, "route")?.longText || "";
  const subpremise = component(components, "subpremise")?.longText || "";
  const line = [streetNumber, route].filter(Boolean).join(" ").trim();
  const unit = subpremise ? ` Unit ${subpremise}` : "";

  return (line ? `${line}${unit}` : fallback).trim();
};

export async function onRequestGet({ request, env }) {
  const apiKey = placesKey(env);

  if (!apiKey) {
    return json({ message: "Places autocomplete is not configured." }, 503);
  }

  const url = new URL(request.url);
  const placeId = (url.searchParams.get("placeId") || "").trim();
  const sessionToken = (url.searchParams.get("sessionToken") || "").trim();

  if (!placeId) {
    return json({ message: "Missing place ID." }, 400);
  }

  const params = new URLSearchParams({
    fields: "formattedAddress,addressComponents",
  });
  if (sessionToken) params.set("sessionToken", sessionToken);

  const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?${params.toString()}`, {
    headers: {
      "X-Goog-Api-Key": apiKey,
    },
  });

  if (!response.ok) {
    console.error(`Place details failed: ${await response.text()}`);
    return json({ message: "Address details are unavailable." }, 502);
  }

  const data = await response.json();
  const components = data.addressComponents || [];
  const city = (
    component(components, "locality") ||
    component(components, "postal_town") ||
    component(components, "administrative_area_level_3")
  )?.longText || "";
  const state = component(components, "administrative_area_level_1")?.shortText || "";
  const zip = component(components, "postal_code")?.longText || "";

  return json({
    formattedAddress: data.formattedAddress || "",
    address: streetAddress(components, data.formattedAddress || ""),
    city: [city, state].filter(Boolean).join(", "),
    zip,
  });
}
