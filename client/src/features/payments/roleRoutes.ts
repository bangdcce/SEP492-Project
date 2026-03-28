import { ROUTES } from "@/constants";

export type SupportedBillingRole = "CLIENT" | "BROKER" | "FREELANCER";

export const normalizeSupportedBillingRole = (
  role?: string | null,
): SupportedBillingRole => {
  const normalizedRole = role?.toUpperCase();

  if (normalizedRole === "BROKER" || normalizedRole === "FREELANCER") {
    return normalizedRole;
  }

  return "CLIENT";
};

export const resolveBillingRoute = (role?: string | null) => {
  switch (normalizeSupportedBillingRole(role)) {
    case "BROKER":
      return ROUTES.BROKER_BILLING;
    case "FREELANCER":
      return ROUTES.FREELANCER_BILLING;
    default:
      return ROUTES.CLIENT_BILLING;
  }
};

export const resolveProjectsRoute = (role?: string | null) => {
  switch (normalizeSupportedBillingRole(role)) {
    case "BROKER":
      return ROUTES.BROKER_PROJECTS;
    case "FREELANCER":
      return ROUTES.FREELANCER_PROJECTS;
    default:
      return ROUTES.CLIENT_PROJECTS;
  }
};

export const resolveContractsRoute = (role?: string | null) => {
  switch (normalizeSupportedBillingRole(role)) {
    case "BROKER":
      return "/broker/contracts";
    case "FREELANCER":
      return "/freelancer/contracts";
    default:
      return "/client/contracts";
  }
};

export const resolveBillingLabel = (role?: string | null) => {
  switch (normalizeSupportedBillingRole(role)) {
    case "BROKER":
      return "Commission Wallet";
    case "FREELANCER":
      return "Earnings Wallet";
    default:
      return "Billing & Wallet";
  }
};
