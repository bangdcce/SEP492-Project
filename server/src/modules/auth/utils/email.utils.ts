export const normalizeAuthEmail = (email: string): string => `${email || ''}`.trim().toLowerCase();
