const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  },
});

const placesKey = (env) => env.GOOGLE_PLACES_API_KEY || env.GOOGLE_MAPS_API_KEY;

export async function onRequestGet({ request, env }) {
  const apiKey = placesKey(env);

  if (!apiKey) {
    return json({ suggestions: [], configured: false }, 200);
  }

  const url = new URL(request.url);
  const input = (url.searchParams.get("input") || "").trim();
  const sessionToken = (url.searchParams.get("sessionToken") || "").trim();

  if (input.length < 3) {
    return json({ suggestions: [], configured: true });
  }

  const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
    },
    body: JSON.stringify({
      input,
      includedRegionCodes: ["us"],
      languageCode: "en",
      regionCode: "us",
      sessionToken,
      locationBias: {
        circle: {
          center: {
            latitude: 42.2411,
            longitude: -83.6130,
          },
          radius: 85000,
        },
      },
    }),
  });

  if (!response.ok) {
    console.error(`Places autocomplete failed: ${await response.text()}`);
    return json({ suggestions: [], configured: true }, 200);
  }

  const data = await response.json();
  const suggestions = (data.suggestions || [])
    .map((item) => item.placePrediction)
    .filter(Boolean)
    .map((place) => ({
      placeId: place.placeId,
      text: place.text?.text || "",
      mainText: place.structuredFormat?.mainText?.text || place.text?.text || "",
      secondaryText: place.structuredFormat?.secondaryText?.text || "",
    }))
    .filter((place) => place.placeId && place.text);

  return json({ suggestions, configured: true });
}
