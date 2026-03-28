type StructuredReasoningItem = {
  id?: unknown;
  candidateId?: unknown;
  userId?: unknown;
  reasoning?: unknown;
};

const STRUCTURED_COLLECTION_KEYS = [
  "results",
  "rankings",
  "candidates",
  "matches",
  "items",
  "data",
] as const;

const normalizeId = (value: unknown) => String(value ?? "").trim();

const extractItems = (payload: unknown): StructuredReasoningItem[] => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  for (const key of STRUCTURED_COLLECTION_KEYS) {
    const items = (payload as Record<string, unknown>)[key];
    if (Array.isArray(items)) {
      return items;
    }
  }

  return [payload as StructuredReasoningItem];
};

export const extractCandidateReasoning = (
  reasoning: string | null | undefined,
  targetIds: Array<string | null | undefined>,
): string | null => {
  const raw = String(reasoning ?? "").trim();
  if (!raw) {
    return null;
  }

  const normalizedTargetIds = targetIds
    .map((value) => normalizeId(value))
    .filter((value) => value.length > 0);

  try {
    const parsed = JSON.parse(raw);
    const items = extractItems(parsed);

    if (items.length > 0) {
      const matchedItem =
        items.find((item) => {
          const itemIds = [item.id, item.candidateId, item.userId]
            .map((value) => normalizeId(value))
            .filter((value) => value.length > 0);

          return itemIds.some((itemId) => normalizedTargetIds.includes(itemId));
        }) ?? items[0];

      const extractedReasoning = String(matchedItem?.reasoning ?? "").trim();
      return extractedReasoning || null;
    }

    return null;
  } catch {
    if (/^[\[{]/.test(raw)) {
      return null;
    }

    return raw;
  }
};
