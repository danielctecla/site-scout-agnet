// Industry codes in display order: the only application copy of the list.
// The database constraint businesses_industry_check is authoritative
// (database.md §4); TASK-015's integration test checks they match. Display
// names come from messages (`industries.<code>`).
export const INDUSTRIES = [
  "food_beverage",
  "clothing_accessories",
  "technology_electronics",
  "beauty_personal_care",
  "health",
  "education",
  "professional_services",
  "construction_maintenance",
  "retail",
  "other",
] as const;

export type Industry = (typeof INDUSTRIES)[number];
