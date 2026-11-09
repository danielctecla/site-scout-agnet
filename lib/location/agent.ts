import type { Industry } from "@/lib/industries";
import {
  type EvaluationInput,
  type EvaluationResult,
  type Explanation,
  type FactorKey,
  LocationError,
} from "./types";
import { type Candidate, distanceM } from "./zones";

// The agent's proposal: prompt, output schema and validation (architecture.md
// §15, SPEC-LOC-05). Pure: the Claude call is passed in as `ask`.

const MIN_ZONE_SEPARATION_M = 400;

export type Ratios = Record<FactorKey, number | null>;

type ProposalContext = {
  candidates: Candidate[];
  ratios: Record<string, Ratios>;
  radiusM: number;
};

export type AcceptedZone = { candidate: Candidate; explanation: Explanation };

export const PROPOSAL_SYSTEM = `You are a commercial location analyst for small businesses in Mexico. You receive candidate zones built from INEGI DENUE establishment records around a reference location. Choose up to three candidates that are the best alternatives for the user's industry and explain each one.

Rules:
- Use only the data provided. Never invent establishments, figures or indicators.
- Every number you write must appear in that candidate's data, written the same way. Do not use thousands separators and do not compute new numbers.
- DENUE does not provide foot traffic, safety, public transport, demographics, purchasing power, rents or available properties. Mention them only as missing information, never as observations.
- Ratios compare the zone's density with the average of the whole exploration area (1 = average). For competition, lower is better. A null ratio means the data is not available.
- Do not rate or rank zones with numbers; the system computes the scores.
- Prefer candidates at least 400 m apart. If fewer than three candidates are reasonable, return fewer, or none.
- summary: one sentence. opportunities and considerations: 1 to 4 short items each, backed by the data. conclusion: 1 or 2 sentences on why the zone can work for this industry.`;

const text = { type: "string", minLength: 1, maxLength: 600 };
const list = { type: "array", items: text, minItems: 1, maxItems: 4 };

export const PROPOSAL_SCHEMA = {
  type: "object",
  properties: {
    zones: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          candidateId: { type: "string" },
          summary: text,
          opportunities: list,
          considerations: list,
          conclusion: text,
        },
        required: [
          "candidateId",
          "summary",
          "opportunities",
          "considerations",
          "conclusion",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["zones"],
  additionalProperties: false,
} as const;

const LANGUAGES = { es: "Spanish", en: "English" } as const;

export function proposalPrompt(
  industry: Industry,
  { candidates, ratios, radiusM }: ProposalContext,
  locale: keyof typeof LANGUAGES,
) {
  const data = {
    industry,
    explorationRadiusM: radiusM,
    zoneRadiusM: 300,
    candidates: candidates.map((c) => ({
      id: c.id,
      name: c.name,
      distanceFromReferenceM: c.distanceM,
      establishments: c.counts,
      minimumStaff: c.staffMin,
      ratioToAreaAverage: ratios[c.id],
      topActivities: c.topActivities,
    })),
  };
  return `Write in ${LANGUAGES[locale]}.\n\n${JSON.stringify(data, null, 2)}`;
}

const NUMBER = /\d+(?:[.,]\d+)?/g;
const numbersIn = (s: string) =>
  (s.match(NUMBER) ?? []).map((n) => Number(n.replace(",", ".")));

// Every number given to the agent for this candidate, as it was given.
export function allowedNumbers(
  c: Candidate,
  ratios: Ratios,
  radiusM: number,
): Set<number> {
  return new Set([
    ...Object.values(c.counts),
    c.staffMin,
    c.distanceM,
    ...c.topActivities.map((a) => a.count),
    ...Object.values(ratios).filter((r): r is number => r !== null),
    300,
    radiusM,
    radiusM / 1000,
    ...numbersIn(c.name),
    ...c.topActivities.flatMap((a) => numbersIn(a.activity)),
  ]);
}

type RawZone = { candidateId: string } & Explanation;

const isText = (v: unknown) =>
  typeof v === "string" && v.trim().length > 0 && v.length <= 600;
const isList = (v: unknown) =>
  Array.isArray(v) && v.length >= 1 && v.length <= 4 && v.every(isText);

function isProposal(raw: unknown): raw is { zones: RawZone[] } {
  if (!raw || typeof raw !== "object") return false;
  const zones = (raw as { zones?: unknown }).zones;
  return (
    Array.isArray(zones) &&
    zones.length <= 3 &&
    zones.every(
      (z) =>
        z &&
        typeof z === "object" &&
        typeof z.candidateId === "string" &&
        isText(z.summary) &&
        isList(z.opportunities) &&
        isList(z.considerations) &&
        isText(z.conclusion),
    )
  );
}

// Null when the response breaks the schema; otherwise the zones that pass
// every rule, in the agent's order.
export function validateProposal(
  raw: unknown,
  { candidates, ratios, radiusM }: ProposalContext,
): AcceptedZone[] | null {
  if (!isProposal(raw)) return null;
  const accepted: AcceptedZone[] = [];
  for (const z of raw.zones) {
    const candidate = candidates.find((c) => c.id === z.candidateId);
    if (!candidate || candidate.distanceM > radiusM) continue;
    if (
      accepted.some(
        (a) => distanceM(a.candidate, candidate) < MIN_ZONE_SEPARATION_M,
      )
    )
      continue;
    const explanation: Explanation = {
      summary: z.summary.trim(),
      opportunities: z.opportunities.map((s) => s.trim()),
      considerations: z.considerations.map((s) => s.trim()),
      conclusion: z.conclusion.trim(),
    };
    const allowed = allowedNumbers(candidate, ratios[candidate.id], radiusM);
    const written = [
      explanation.summary,
      ...explanation.opportunities,
      ...explanation.considerations,
      explanation.conclusion,
    ].flatMap(numbersIn);
    if (!written.every((n) => allowed.has(n))) continue;
    accepted.push({ candidate, explanation });
  }
  return accepted;
}

export async function proposeZones(
  input: ProposalContext & {
    industry: Industry;
    locale?: keyof typeof LANGUAGES;
  },
  ask: (prompt: string) => Promise<unknown>,
): Promise<AcceptedZone[]> {
  const prompt = proposalPrompt(input.industry, input, input.locale ?? "es");
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const accepted = validateProposal(await ask(prompt), input);
    if (accepted) return accepted;
  }
  throw new LocationError("analysis_failed");
}

// Chat (SPEC-LOC-10): the stored evaluation is the only context.
export function chatSystemPrompt(
  input: EvaluationInput,
  result: EvaluationResult,
  locale: keyof typeof LANGUAGES,
) {
  const evaluation = {
    reference: input.reference.label,
    explorationRadiusM: input.radiusM,
    zoneRadiusM: 300,
    industry: input.industry,
    rentMxn: input.rentMxn,
    source: result.source,
    queriedAt: result.queriedAt,
    area: result.area,
    scoring:
      "Score 0-100 computed by the system: activity 30, competition 30, related businesses 25, staff 15. Each factor compares the zone's density with the area average; ratio 2 or more gives the full weight (inverted for competition). Unavailable factors are left out.",
    zones: result.zones.map((z) => ({
      rank: z.rank,
      name: z.name,
      distanceFromReferenceM: z.distanceM,
      score: z.score,
      factors: z.factors.map(({ key, available, ratio, points, weight }) => ({
        key,
        available,
        ratio,
        points,
        weight,
      })),
      establishments: z.counts,
      minimumStaff: z.staffMin,
      explanation: z.explanation,
    })),
  };
  return `You answer a small-business owner's questions about one location evaluation built from INEGI DENUE data.

Rules:
- Answer only from the evaluation below. If something is not in it, say it is not available.
- Never invent establishments, figures or indicators, and never change or recompute scores.
- DENUE has no foot traffic, safety, transport, demographics, purchasing power, rents or available properties, and a record does not guarantee that a business still operates.
- Write in ${LANGUAGES[locale]}, plain text, at most about 120 words.

Evaluation:
${JSON.stringify(evaluation)}`;
}
