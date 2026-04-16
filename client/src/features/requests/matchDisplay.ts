import type {
  RequestCandidateSkillSummary,
  RequestMatchCandidate,
} from "./types";

export const MATCH_PAGE_SIZE = 5;

export const toNumeric = (
  value: number | string | null | undefined,
): number | null => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const roundScore = (
  value: number | string | null | undefined,
  fallback = 0,
) => {
  const parsed = toNumeric(value);
  return parsed === null ? fallback : Math.round(parsed);
};

export const toTrustNormalized100 = (
  normalizedValue: number | string | null | undefined,
  rawValue?: number | string | null,
): number | null => {
  const normalized = toNumeric(normalizedValue);
  if (normalized !== null) {
    return roundScore(clamp(normalized, 0, 100));
  }

  const raw = toNumeric(rawValue);
  if (raw !== null) {
    return roundScore(clamp(raw * 20, 0, 100));
  }

  return null;
};

export const toTrustRaw5 = (
  rawTrust: number | string | null | undefined,
  normalizedTrust?: number | string | null,
): number | null => {
  const raw = toNumeric(rawTrust);
  if (raw !== null) {
    return Math.round(clamp(raw, 0, 5) * 10) / 10;
  }

  const normalized = toNumeric(normalizedTrust);
  if (normalized === null) {
    return null;
  }

  return Math.round((clamp(normalized, 0, 100) / 20) * 10) / 10;
};

export const getCandidateTargetId = (candidate: RequestMatchCandidate) =>
  candidate.userId || candidate.candidateId || candidate.id || null;

export const mergeMatchCandidates = (
  existing: RequestMatchCandidate[],
  incoming: RequestMatchCandidate[],
) => {
  const seen = new Set<string>();
  const merged: RequestMatchCandidate[] = [];

  for (const candidate of [...existing, ...incoming]) {
    const key =
      getCandidateTargetId(candidate) ||
      `${candidate.fullName || "candidate"}-${merged.length}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    merged.push(candidate);
  }

  return merged;
};

const dedupeStrings = (values: Array<string | null | undefined>) => {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const value of values) {
    const normalized = String(value || "").trim();
    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(normalized);
  }

  return unique;
};

export const getCandidateCurrentSkills = (
  candidate: RequestMatchCandidate | null,
) => {
  if (!candidate?.skills?.length) {
    return [] as RequestCandidateSkillSummary[];
  }

  return [...candidate.skills]
    .filter((skill) => String(skill?.name || "").trim().length > 0)
    .sort((left, right) => {
      if (Boolean(left.isPrimary) !== Boolean(right.isPrimary)) {
        return left.isPrimary ? -1 : 1;
      }

      const projectDelta =
        Number(right.completedProjectsCount || 0) -
        Number(left.completedProjectsCount || 0);
      if (projectDelta !== 0) {
        return projectDelta;
      }

      return Number(right.yearsExp || 0) - Number(left.yearsExp || 0);
    });
};

export const getCandidateProfileTags = (
  candidate: RequestMatchCandidate | null,
) =>
  dedupeStrings([
    ...(candidate?.rawProfileSkills || []),
    ...((candidate?.candidateProfile?.profileSkills as string[] | null) || []),
  ]);

export const getCandidateDomains = (candidate: RequestMatchCandidate | null) =>
  dedupeStrings([
    ...(candidate?.domains || []).map((domain) => domain?.name),
    ...((candidate?.candidateProfile?.domains as string[] | null) || []),
  ]);

export const getVerifiedSkillCount = (
  candidate: RequestMatchCandidate | null,
) =>
  getCandidateCurrentSkills(candidate).filter(
    (skill) =>
      String(skill.verificationStatus || "").toUpperCase() === "VERIFIED",
  ).length;

export const getPrimarySkillCount = (candidate: RequestMatchCandidate | null) =>
  getCandidateCurrentSkills(candidate).filter((skill) =>
    Boolean(skill.isPrimary),
  ).length;

export const formatSkillChip = (skill: RequestCandidateSkillSummary) => {
  const detailParts: string[] = [];
  const years = toNumeric(skill.yearsExp);
  const completedProjects = toNumeric(skill.completedProjectsCount);

  if (years !== null && years > 0) {
    detailParts.push(`${Math.round(years)}y`);
  }
  if (completedProjects !== null && completedProjects > 0) {
    detailParts.push(`${Math.round(completedProjects)} projects`);
  }
  if (skill.isPrimary) {
    detailParts.push("Primary");
  }

  return detailParts.length > 0
    ? `${skill.name} · ${detailParts.join(" · ")}`
    : skill.name;
};
