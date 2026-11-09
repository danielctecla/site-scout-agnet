import { type DenueEstablishment, LocationError } from "./types";

// INEGI DENUE `Buscar` client (architecture.md §15). Server only: it reads the
// DENUE token.

// DENUE_API_URL exists only so the end-to-end test can use a local fake.
const BASE_URL =
  process.env.DENUE_API_URL ??
  "https://www.inegi.org.mx/app/api/denue/v1/consulta";
// A 3.3 km query in a dense city returns about 40 MB in about 40 s.
const TIMEOUT_MS = 90_000;

type Point = { lat: number; lon: number; radiusM: number };
type Deps = { token?: string; fetch?: typeof fetch };

export async function fetchEstablishments(
  { lat, lon, radiusM }: Point,
  { token = process.env.DENUE_TOKEN, fetch: get = fetch }: Deps = {},
): Promise<DenueEstablishment[]> {
  if (!token) {
    console.error("DENUE_TOKEN is not set");
    throw new LocationError("denue_unavailable");
  }
  const url = `${BASE_URL}/Buscar/todos/${lat},${lon}/${radiusM}/${token}`;
  let body: unknown;
  try {
    const response = await get(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    // An invalid token answers 200 with plain text, so JSON parsing fails.
    body = JSON.parse(await response.text());
  } catch (error) {
    console.error("DENUE request failed:", (error as Error).message);
    throw new LocationError("denue_unavailable");
  }
  if (!Array.isArray(body)) throw new LocationError("denue_unavailable");
  return parseEstablishments(body);
}

const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

// Mexico's bounding box: rejects empty, zero and swapped coordinates.
const inMexico = (lat: number, lon: number) =>
  lat >= 14 && lat <= 33 && lon >= -119 && lon <= -86;

// Contact fields (phone, email, website) are never read.
export function parseEstablishments(records: unknown[]): DenueEstablishment[] {
  const result: DenueEstablishment[] = [];
  for (const raw of records) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const lat = Number(text(r.Latitud) || NaN);
    const lon = Number(text(r.Longitud) || NaN);
    const id = text(r.Id);
    if (!id || !inMexico(lat, lon)) continue;

    // The SCIAN class is characters 6–11 of the CLEE.
    const scian = text(r.CLEE).slice(5, 11);
    const estrato = text(r.Estrato);
    const lowerBound = /^(\d+)\s/.exec(estrato)?.[1];
    // DENUE sometimes repeats the road type in the name ("AVENIDA" +
    // "AVENIDA DE LAS NACIONES").
    const type = text(r.Tipo_vialidad);
    const name = text(r.Calle);
    const street =
      !type || name.startsWith(`${type} `) ? name : `${type} ${name}`.trim();
    const number = text(r.Num_Exterior);
    const colonia = text(r.Colonia);
    const address = [
      [street, number === "0" ? "" : number].filter(Boolean).join(" "),
      colonia,
      text(r.CP),
    ]
      .filter(Boolean)
      .join(", ");

    result.push({
      id,
      name: text(r.Nombre),
      activity: text(r.Clase_actividad),
      scian: /^\d{6}$/.test(scian) ? scian : null,
      address,
      colonia,
      street,
      lat,
      lon,
      staffMin: lowerBound === undefined ? null : Number(lowerBound),
      staffLabel: estrato || null,
    });
  }
  return result;
}
