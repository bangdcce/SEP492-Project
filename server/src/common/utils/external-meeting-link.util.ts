const GOOGLE_MEET_CODE_PATTERN = /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/i;
const GOOGLE_MEET_URL_PATTERN =
  /^(?:https?:\/\/)?meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})(?:[/?#].*)?$/i;

const normalizeGoogleMeetCode = (value: string) => value.trim().toLowerCase();

export const normalizeExternalMeetingLink = (
  value?: string | null,
): string | undefined => {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) {
    return undefined;
  }

  if (GOOGLE_MEET_CODE_PATTERN.test(trimmed)) {
    return `https://meet.google.com/${normalizeGoogleMeetCode(trimmed)}`;
  }

  const schemeLessGoogleMeetMatch = trimmed.match(GOOGLE_MEET_URL_PATTERN);
  if (schemeLessGoogleMeetMatch) {
    return `https://meet.google.com/${normalizeGoogleMeetCode(
      schemeLessGoogleMeetMatch[1],
    )}`;
  }

  try {
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return undefined;
    }

    if (parsed.hostname.toLowerCase() === 'meet.google.com') {
      const code = parsed.pathname.replace(/^\/+/, '').split('/')[0] || '';
      if (!GOOGLE_MEET_CODE_PATTERN.test(code)) {
        return undefined;
      }

      return `https://meet.google.com/${normalizeGoogleMeetCode(code)}`;
    }

    return parsed.toString();
  } catch {
    return undefined;
  }
};

export const coerceExternalMeetingLinkForValidation = (
  value: unknown,
): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }

  return normalizeExternalMeetingLink(trimmed) ?? trimmed;
};
