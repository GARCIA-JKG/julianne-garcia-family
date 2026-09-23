import { query } from "@/lib/db";
import { cleanText } from "@/lib/security";

export const months = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" }
] as const;

export function parseMonthYear(value: unknown) {
  const raw = cleanText(value, 7);
  const match = /^(\d{4})-(\d{2})$/.exec(raw);

  if (!match) {
    return { month: null, year: null };
  }

  const year = Number(match[1]);
  const month = Number(match[2]);

  return {
    month:
      Number.isInteger(month) && month >= 1 && month <= 12
        ? month
        : null,
    year:
      Number.isInteger(year) && year >= 1000 && year <= 2200
        ? year
        : null
  };
}

export function formatMonthYear(
  month: number | null,
  year: number | null
) {
  if (!month && !year) return null;
  const monthName = months.find((item) => item.value === month)?.label;
  if (monthName && year) return `${monthName} ${year}`;
  return monthName ?? String(year);
}

export type StructuredPlace = {
  locality: string | null;
  region: string | null;
  country: string | null;
  label: string | null;
};

export function parsePlace(
  localityValue: unknown,
  regionValue: unknown,
  countryValue: unknown
): StructuredPlace {
  const locality = cleanText(localityValue, 120) || null;
  const region = cleanText(regionValue, 120) || null;
  const country = cleanText(countryValue, 120) || null;
  const label = [locality, region, country].filter(Boolean).join(", ") || null;

  return { locality, region, country, label };
}

function normalizePlaceQuery(place: StructuredPlace) {
  return [place.locality, place.region, place.country]
    .filter(Boolean)
    .join(", ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

let lastExternalGeocodeAt = 0;

async function waitForGeocoderSlot() {
  const elapsed = Date.now() - lastExternalGeocodeAt;
  const wait = Math.max(0, 1100 - elapsed);

  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }

  lastExternalGeocodeAt = Date.now();
}

export async function geocodePlace(place: StructuredPlace) {
  const normalizedQuery = normalizePlaceQuery(place);
  if (!normalizedQuery) return null;

  const cached = await query<{
    display_name: string;
    latitude: number;
    longitude: number;
  }>(
    `SELECT display_name, latitude, longitude
     FROM geocoded_places
     WHERE normalized_query = $1
     LIMIT 1`,
    [normalizedQuery]
  );

  if (cached.rows[0]) {
    return {
      displayName: cached.rows[0].display_name,
      latitude: Number(cached.rows[0].latitude),
      longitude: Number(cached.rows[0].longitude)
    };
  }

  const base =
    process.env.GEOCODER_BASE_URL ??
    "https://nominatim.openstreetmap.org/search";

  const url = new URL(base);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", place.label ?? normalizedQuery);

  try {
    await waitForGeocoderSlot();

    const response = await fetch(url, {
      headers: {
        "User-Agent": "JulianneGarciaFamily/0.2"
      },
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) return null;

    const results = (await response.json()) as Array<{
      display_name: string;
      lat: string;
      lon: string;
    }>;

    const first = results[0];
    if (!first) return null;

    const latitude = Number(first.lat);
    const longitude = Number(first.lon);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }

    await query(
      `INSERT INTO geocoded_places
        (normalized_query, display_name, latitude, longitude)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (normalized_query) DO NOTHING`,
      [normalizedQuery, first.display_name, latitude, longitude]
    );

    return {
      displayName: first.display_name,
      latitude,
      longitude
    };
  } catch {
    return null;
  }
}
