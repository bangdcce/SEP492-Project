const TRUTHY_VALUES = new Set(["1", "true", "yes", "on"]);

const isTruthy = (value?: string) =>
  TRUTHY_VALUES.has((value || "").trim().toLowerCase());

export const INTERNAL_DEV_TOOLS_ENABLED = isTruthy(
  import.meta.env.VITE_ENABLE_INTERNAL_DEV_TOOLS,
);
