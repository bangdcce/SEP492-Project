import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Loader2,
  LockKeyhole,
  ShieldEllipsis,
  WalletCards,
} from "lucide-react";
import { ROUTES } from "@/constants";
import { formatCurrency, formatDate } from "@/shared/utils/formatters";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { getPaymentMethods } from "@/features/payments/api";
import type { MilestoneFundingResult, PaymentMethodView } from "@/features/payments/types";
import type { Milestone } from "../../types";
import { PayPalMilestoneCheckout } from "./PayPalMilestoneCheckout";

interface MilestoneFundingCardProps {
  milestone: Milestone;
  progress: number;
  currentUserRole?: string;
  projectStatus?: string | null;
  currency?: string;
  billingSetupHref?: string;
  onFunded?: (result: MilestoneFundingResult) => void;
}

const escrowBadgeStyles: Record<string, string> = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50",
  FUNDED: "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-50",
  RELEASED: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50",
  REFUNDED: "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-100",
  DISPUTED: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-50",
};

const needsAttention = (status: string) =>
  status === "PENDING" || status === "DISPUTED" || status === "REFUNDED";

const getFundingHeadline = (escrowStatus: string | undefined, progress: number) => {
  if (escrowStatus === "FUNDED" && progress === 100) {
    return "Escrow is funded. The broker can review this milestone and the client can approve it after that.";
  }

  if (escrowStatus === "FUNDED") {
    return "Funds are already locked in escrow while delivery continues.";
  }

  if (escrowStatus === "RELEASED") {
    return "Escrow has been released and this milestone is financially settled.";
  }

  if (escrowStatus === "REFUNDED") {
    return "Escrow was refunded and no further automatic release is allowed.";
  }

  if (escrowStatus === "DISPUTED") {
    return "Escrow is frozen by a dispute and release is blocked until resolution.";
  }

  if (progress === 100) {
    return "Work is complete, but broker review stays locked until this milestone is funded.";
  }

  return "Fund this milestone first so the money is locked before the review flow begins.";
};

const getFundingMethodLabel = (method: PaymentMethodView) => {
  if (method.type === "PAYPAL_ACCOUNT") {
    if (method.paypalEmail && method.displayName !== method.paypalEmail) {
      return `${method.displayName} (${method.paypalEmail})`;
    }

    return method.paypalEmail ?? method.displayName;
  }

  const cardLabel = `${method.cardBrand ?? "Card"} •••• ${method.cardLast4 ?? "0000"}`;
  if (method.displayName && method.displayName !== cardLabel) {
    return `${cardLabel} (${method.displayName})`;
  }

  return cardLabel;
};

export function MilestoneFundingCard({
  milestone,
  progress,
  currentUserRole,
  projectStatus,
  currency,
  billingSetupHref,
  onFunded,
}: MilestoneFundingCardProps) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodView[]>([]);
  const [loadingMethods, setLoadingMethods] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const escrow = milestone.escrow ?? null;
  const normalizedRole = currentUserRole?.toUpperCase();
  const isClient = normalizedRole === "CLIENT";
  const normalizedProjectStatus = String(projectStatus || "").toUpperCase();
  const normalizedMilestoneStatus = String(milestone.status || "").toUpperCase();
  const isProjectFundingLocked = [
    "CANCELED",
    "CANCELLED",
    "PAID",
    "COMPLETED",
    "DISPUTED",
  ].includes(normalizedProjectStatus);
  const isMilestoneFundingLocked = ["LOCKED", "PAID", "COMPLETED"].includes(
    normalizedMilestoneStatus,
  );
  const isFundingInteractionLocked = isProjectFundingLocked || isMilestoneFundingLocked;

  const fundingLockReason = isProjectFundingLocked
    ? normalizedProjectStatus === "CANCELED" || normalizedProjectStatus === "CANCELLED"
      ? "project is cancelled"
      : `project status is ${normalizedProjectStatus}`
    : isMilestoneFundingLocked
      ? `milestone status is ${normalizedMilestoneStatus}`
      : null;

  const fundingMethods = useMemo(
    () => paymentMethods.filter((method) => method.type === "PAYPAL_ACCOUNT"),
    [paymentMethods],
  );
  const preferredPayPalMethod = useMemo(
    () => fundingMethods.find((method) => method.isDefault) ?? fundingMethods[0] ?? null,
    [fundingMethods],
  );

  useEffect(() => {
    let active = true;

    const loadMethods = async () => {
      setLocalError(null);

      if (
        !isClient ||
        escrow?.status !== "PENDING" ||
        isFundingInteractionLocked
      ) {
        return;
      }

      try {
        setLoadingMethods(true);
        const methods = await getPaymentMethods();
        if (!active) return;

        setPaymentMethods(methods);
      } catch (err: unknown) {
        if (!active) return;
        const message = err instanceof Error ? err.message : "Failed to load payment methods";
        setLocalError(message);
      } finally {
        if (active) {
          setLoadingMethods(false);
        }
      }
    };

    loadMethods();

    return () => {
      active = false;
    };
  }, [escrow?.status, isClient, isFundingInteractionLocked, milestone.id]);

  const fundingHeadline = isFundingInteractionLocked
    ? `Funding is locked because ${fundingLockReason}.`
    : getFundingHeadline(escrow?.status, progress);
  const displayCurrency = escrow?.currency || currency || "USD";

  if (!escrow) {
    return (
      <div className="rounded-[1.75rem] border border-rose-200 bg-rose-50/80 px-5 py-4 text-sm text-rose-700">
        No escrow record is attached to this milestone yet, so funding and release actions are unavailable.
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-[1.9rem] border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-6 px-5 py-5 lg:grid-cols-[1.2fr_0.8fr] lg:px-6">
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={escrowBadgeStyles[escrow.status] || escrowBadgeStyles.PENDING}>
                  Escrow {escrow.status}
                </Badge>
                {progress === 100 ? (
                  <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                    Delivery complete
                  </Badge>
                ) : null}
              </div>
              <div>
                <h3 className="text-xl font-semibold tracking-tight text-slate-950">
                  Milestone funding
                </h3>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                  {fundingHeadline}
                </p>
              </div>
            </div>

            <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50 px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Exact amount</p>
              <p className="mt-1 text-2xl font-semibold text-slate-950">
                {formatCurrency(escrow.totalAmount, displayCurrency)}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Freelancer</p>
              <p className="mt-2 text-lg font-semibold text-slate-950">
                {formatCurrency(escrow.developerShare, displayCurrency)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Broker</p>
              <p className="mt-2 text-lg font-semibold text-slate-950">
                {formatCurrency(escrow.brokerShare, displayCurrency)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Platform fee</p>
              <p className="mt-2 text-lg font-semibold text-slate-950">
                {formatCurrency(escrow.platformFee, displayCurrency)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 text-sm text-slate-500">
            {escrow.fundedAt ? <span>Funded {formatDate(escrow.fundedAt)}</span> : null}
            {escrow.releasedAt ? <span>Released {formatDate(escrow.releasedAt)}</span> : null}
            {escrow.refundedAt ? <span>Refunded {formatDate(escrow.refundedAt)}</span> : null}
          </div>
        </div>

        <div className="rounded-[1.7rem] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 p-5 text-white">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-3">
              {escrow.status === "FUNDED" ? (
                <LockKeyhole className="h-5 w-5 text-sky-200" />
              ) : escrow.status === "DISPUTED" ? (
                <ShieldEllipsis className="h-5 w-5 text-rose-200" />
              ) : (
                <WalletCards className="h-5 w-5 text-teal-200" />
              )}
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-300">
                Funding rail
              </p>
              <p className="mt-2 text-lg font-semibold">
                {escrow.status === "PENDING"
                  ? isFundingInteractionLocked
                    ? "Funding locked"
                    : "Ready to lock escrow"
                  : escrow.status === "FUNDED"
                    ? "Funds secured"
                    : escrow.status === "RELEASED"
                      ? "Released successfully"
                      : escrow.status === "REFUNDED"
                        ? "Refund completed"
                        : "Dispute freeze"}
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {escrow.status === "PENDING" && isClient && !isFundingInteractionLocked ? (
              <>
                {loadingMethods ? (
                  <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading funding methods...
                  </div>
                ) : fundingMethods.length === 0 ? (
                    <div className="space-y-4 rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-4">
                      <div className="flex items-start gap-2 text-sm text-amber-50">
                        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                        <span>
                        No PayPal buyer account is on file yet. Add one in billing before broker review can start.
                        </span>
                      </div>
                    <Link
                      to={billingSetupHref || ROUTES.CLIENT_BILLING}
                      className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-100"
                    >
                      Open billing
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                ) : (
                  <>
                    {preferredPayPalMethod ? (
                      <div className="space-y-3">
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                          PayPal · {getFundingMethodLabel(preferredPayPalMethod)}
                        </div>
                        <div className="rounded-2xl border border-sky-300/20 bg-sky-400/10 px-4 py-3 text-sm text-sky-100">
                          PayPal will open the funding window for this exact milestone amount.
                        </div>
                        <PayPalMilestoneCheckout
                          milestoneId={milestone.id}
                          milestoneTitle={milestone.title}
                          paymentMethodId={preferredPayPalMethod.id}
                          amount={Number(escrow.totalAmount)}
                          currency={displayCurrency}
                          onFunded={onFunded}
                          onError={setLocalError}
                        />
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs leading-5 text-slate-300">
                          PayPal may also show a debit or credit card option inside checkout, depending on buyer eligibility.
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                        Add a PayPal buyer account in billing to continue.
                      </div>
                    )}
                  </>
                )}
              </>
            ) : escrow.status === "PENDING" && isFundingInteractionLocked ? (
              <div className="space-y-3 rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-4 text-sm text-amber-100">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>
                    Funding is locked because {fundingLockReason}. This milestone can no longer accept a new escrow deposit.
                  </span>
                </div>
              </div>
            ) : (
                  <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-200">
                    <div className="flex items-start gap-2">
                      {escrow.status === "RELEASED" ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-200" />
                  ) : needsAttention(escrow.status) ? (
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-200" />
                  ) : (
                    <LockKeyhole className="mt-0.5 h-4 w-4 flex-shrink-0 text-sky-200" />
                  )}
                  <span>
                    {isClient
                      ? "No funding action is needed right now."
                      : "This panel is read-only for non-client roles, but it shows exactly how the escrow is sitting right now."}
                  </span>
                </div>
              </div>
            )}

            {localError ? (
              <div
                id={`milestone-funding-error-${milestone.id}`}
                className="rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100"
                role="alert"
              >
                {localError}
              </div>
            ) : null}

            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <div className="flex items-start gap-2 text-sm text-slate-200">
                <CreditCard className="mt-0.5 h-4 w-4 flex-shrink-0 text-teal-200" />
                <span>
                  Full-fund only: this milestone must be funded in one exact deposit before broker review and final approval can release money.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
