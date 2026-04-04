import { ROUTES } from "@/constants";

export type SupportedSubscriptionRole = "CLIENT" | "BROKER" | "FREELANCER";

export const normalizeSupportedSubscriptionRole = (
  role?: string | null,
): SupportedSubscriptionRole => {
  const normalizedRole = role?.toUpperCase();

  if (normalizedRole === "BROKER" || normalizedRole === "FREELANCER") {
    return normalizedRole;
  }

  return "CLIENT";
};

export const resolveSubscriptionRoute = (role?: string | null) => {
  switch (normalizeSupportedSubscriptionRole(role)) {
    case "BROKER":
      return ROUTES.BROKER_SUBSCRIPTION;
    case "FREELANCER":
      return ROUTES.FREELANCER_SUBSCRIPTION;
    default:
      return ROUTES.CLIENT_SUBSCRIPTION;
  }
};

export const resolveSubscriptionCheckoutRoute = (role?: string | null) => {
  switch (normalizeSupportedSubscriptionRole(role)) {
    case "BROKER":
      return ROUTES.BROKER_SUBSCRIPTION_CHECKOUT;
    case "FREELANCER":
      return ROUTES.FREELANCER_SUBSCRIPTION_CHECKOUT;
    default:
      return ROUTES.CLIENT_SUBSCRIPTION_CHECKOUT;
  }
};
