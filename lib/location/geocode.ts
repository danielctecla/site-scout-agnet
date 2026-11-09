import { LocationError } from "./types";

// Nominatim (OpenStreetMap) search, server only (architecture.md §15). Called
// only when the user presses Search, never while typing (usage policy).

// NOMINATIM_URL exists only so the end-to-end test can use a local fake.
const URL_BASE =
  process.env.NOMINATIM_URL ?? "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "business-management-local/0.1 (local development)";

export type Place = { label: string; name: string; lat: number; lon: number };

export async function searchPlaces(
  text: string,
  locale: "es" | "en",
  get: typeof fetch = fetch,
): Promise<Place[]> {
  const query = text.trim().slice(0, 200);
  if (!query) throw new LocationError("place_not_found");
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    countrycodes: "mx",
    limit: "5",
    "accept-language": locale,
  });
  let body: unknown;
  try {
    const response = await get(`${URL_BASE}?${params}`, {
      headers: { "User-Agent": USER_AGENT },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    body = await response.json();
  } catch (error) {
    console.error("Geocoding failed:", (error as Error).message);
    throw new LocationError("geocoding_unavailable");
  }
  const places = (Array.isArray(body) ? body : [])
    .map((r: Record<string, unknown>) => {
      const label = typeof r.display_name === "string" ? r.display_name : "";
      return {
        label,
        name:
          typeof r.name === "string" && r.name ? r.name : label.split(",")[0],
        lat: Number(r.lat),
        lon: Number(r.lon),
      };
    })
    .filter((p) => p.label && Number.isFinite(p.lat) && Number.isFinite(p.lon));
  if (places.length === 0) throw new LocationError("place_not_found");
  return places;
}
