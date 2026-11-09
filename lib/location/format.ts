import type { FactorKey, Zone } from "./types";

// Display helpers shared by the Location Evaluation screens.

export const formatDistance = (m: number) =>
  m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`;

export const formatRadius = (m: number) =>
  m < 1000 ? `${m} m` : `${m / 1000} km`;

// What each factor counts in the zone: establishments, or people for staff.
export const factorAmount = (zone: Zone, key: FactorKey) =>
  key === "activity"
    ? zone.counts.total
    : key === "competition"
      ? zone.counts.same
      : key === "related"
        ? zone.counts.related
        : zone.staffMin;

// The most points a factor can add once unavailable factors are left out.
export const maxPoints = (zone: Zone, weight: number) =>
  (100 * weight) /
  zone.factors.reduce((sum, f) => sum + (f.available ? f.weight : 0), 0);
