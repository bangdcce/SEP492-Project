export type CanonicalProductType =
  | "LANDING_PAGE"
  | "CORP_WEBSITE"
  | "ECOMMERCE"
  | "MOBILE_APP"
  | "WEB_APP"
  | "SYSTEM";

const PRODUCT_TYPE_ALIASES: Record<string, CanonicalProductType> = {
  LANDING_PAGE: "LANDING_PAGE",
  LANDINGPAGE: "LANDING_PAGE",
  LANDING: "LANDING_PAGE",
  CORP_WEBSITE: "CORP_WEBSITE",
  CORPWEBSITE: "CORP_WEBSITE",
  CORPORATE_WEBSITE: "CORP_WEBSITE",
  CORPORATEWEBSITE: "CORP_WEBSITE",
  BUSINESS_WEBSITE: "CORP_WEBSITE",
  WEBSITE: "CORP_WEBSITE",
  ECOMMERCE: "ECOMMERCE",
  E_COMMERCE: "ECOMMERCE",
  ECOMMERCE_WEBSITE: "ECOMMERCE",
  E_COMMERCE_WEBSITE: "ECOMMERCE",
  SHOP: "ECOMMERCE",
  MOBILE_APP: "MOBILE_APP",
  MOBILEAPP: "MOBILE_APP",
  APP: "MOBILE_APP",
  WEB_APP: "WEB_APP",
  WEBAPP: "WEB_APP",
  SAAS: "WEB_APP",
  PORTAL: "WEB_APP",
  MARKETPLACE: "WEB_APP",
  SERVICE_MARKETPLACE: "WEB_APP",
  SYSTEM: "SYSTEM",
  INTERNAL_SYSTEM: "SYSTEM",
  MANAGEMENT_SYSTEM: "SYSTEM",
  INTERNAL_MANAGEMENT_SYSTEM: "SYSTEM",
};

export const PRODUCT_TYPE_LABELS: Record<CanonicalProductType, string> = {
  LANDING_PAGE: "Landing Page",
  CORP_WEBSITE: "Corporate Website",
  ECOMMERCE: "E-commerce Website",
  MOBILE_APP: "Mobile App",
  WEB_APP: "Web App / SaaS Platform",
  SYSTEM: "Internal Management System",
};

const normalizeToken = (value?: string | null) =>
  String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();

export const normalizeProductTypeCode = (
  value?: string | null,
): CanonicalProductType | null => {
  const normalized = normalizeToken(value);
  return normalized ? PRODUCT_TYPE_ALIASES[normalized] || null : null;
};

export const getProductTypeLabel = (value?: string | null): string => {
  const canonical = normalizeProductTypeCode(value);
  if (canonical) {
    return PRODUCT_TYPE_LABELS[canonical];
  }

  const fallback = String(value || "")
    .trim()
    .replace(/[_/]+/g, " ")
    .replace(/\s+/g, " ");

  return fallback
    ? fallback.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase())
    : "Not set";
};
