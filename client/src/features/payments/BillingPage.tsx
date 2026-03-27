import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRightLeft,
  BadgeDollarSign,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Landmark,
  Loader2,
  PiggyBank,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { STORAGE_KEYS } from "@/constants";
import { formatCurrency, formatRelativeTime } from "@/shared/utils/formatters";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import Spinner from "@/shared/components/ui/spinner";
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
import { getStoredJson } from "@/shared/utils/storage";
import {
  createPaymentMethod,
  getPaymentMethods,
  getWalletSnapshot,
  getWalletTransactions,
  setDefaultPaymentMethod,
} from "./api";
import type {
  CreatePaymentMethodInput,
  PaymentMethodType,
  PaymentMethodView,
  WalletSnapshot,
  WalletTransaction,
} from "./types";
import {
  normalizeSupportedBillingRole,
  resolveContractsRoute,
  resolveProjectsRoute,
  type SupportedBillingRole,
} from "./roleRoutes";

type ComposerState = {
  displayName: string;
  paypalEmail: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountHolderName: string;
  branchName: string;
  isDefault: boolean;
};

type ComposerErrors = Partial<Record<keyof ComposerState, string>>;

const initialComposerState: ComposerState = {
  displayName: "",
  paypalEmail: "",
  bankName: "",
  bankCode: "",
  accountNumber: "",
  accountHolderName: "",
  branchName: "",
  isDefault: false,
};

const transactionToneMap: Record<
  string,
  {
    badgeClassName: string;
    amountClassName: string;
    label: string;
  }
> = {
  DEPOSIT: {
    badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amountClassName: "text-emerald-700",
    label: "Deposit",
  },
  ESCROW_HOLD: {
    badgeClassName: "border-amber-200 bg-amber-50 text-amber-700",
    amountClassName: "text-amber-700",
    label: "Escrow hold",
  },
  ESCROW_RELEASE: {
    badgeClassName: "border-sky-200 bg-sky-50 text-sky-700",
    amountClassName: "text-sky-700",
    label: "Escrow release",
  },
  REFUND: {
    badgeClassName: "border-cyan-200 bg-cyan-50 text-cyan-700",
    amountClassName: "text-cyan-700",
    label: "Refund",
  },
  FEE_DEDUCTION: {
    badgeClassName: "border-violet-200 bg-violet-50 text-violet-700",
    amountClassName: "text-violet-700",
    label: "Platform fee",
  },
  WITHDRAWAL: {
    badgeClassName: "border-rose-200 bg-rose-50 text-rose-700",
    amountClassName: "text-rose-700",
    label: "Withdrawal",
  },
};

const getPaymentMethodIcon = (type: PaymentMethodType) =>
  type === "PAYPAL_ACCOUNT" ? CreditCard : Landmark;

const trimOptional = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const describeTransaction = (transaction: WalletTransaction) => {
  if (transaction.description) {
    return transaction.description;
  }

  const milestoneId = typeof transaction.metadata?.milestoneId === "string"
    ? transaction.metadata.milestoneId
    : null;

  if (milestoneId) {
    return `Milestone ${milestoneId.slice(0, 8)}`;
  }

  return "Ledger movement";
};

const resolveTransactionAmountPrefix = (transaction: WalletTransaction) => {
  if (transaction.type === "DEPOSIT" || transaction.type === "REFUND") {
    return "+";
  }

  if (
    transaction.type === "ESCROW_RELEASE" &&
    transaction.description?.toLowerCase().includes("payout")
  ) {
    return "+";
  }

  if (
    transaction.type === "ESCROW_RELEASE" &&
    transaction.description?.toLowerCase().includes("commission")
  ) {
    return "+";
  }

  if (transaction.type === "FEE_DEDUCTION") {
    return "+";
  }

  return "-";
};

const roleBillingRules: Record<SupportedBillingRole, string[]> = {
  CLIENT: [
    "Each milestone uses one escrow and must be funded in full.",
    "Funding locks money in held balance until the milestone is approved.",
    "Approval releases escrow; disputes freeze automatic release.",
  ],
  BROKER: [
    "Broker commission posts here automatically when a funded milestone is approved.",
    "Disputes or unreleased escrow can keep commission sitting in held balance.",
    "Cashout setup comes next; this page focuses on transparent ledger visibility first.",
  ],
  FREELANCER: [
    "Released milestone earnings land here automatically after approval.",
    "Held balance shows money that is frozen by dispute or not yet released.",
    "Cashout setup comes next; this page focuses on earnings visibility and audit trail first.",
  ],
};

const roleCopy = {
  CLIENT: {
    heroBadge: "Wallet and escrow control room",
    heroTitle: "Billing that mirrors how milestones actually move money",
    heroDescription:
      "Save your funding methods here, keep an eye on held escrow, then fund each milestone from its workspace when you are ready to lock money in.",
    primaryCtaLabel: "Open projects",
    secondaryCtaLabel: "Contracts",
    summaryEyebrow: "Default funding rail",
    summaryEmptyTitle: "No default method yet",
    summaryModeBadge: "Setup needed",
    summarySourceLabel: "Funding method",
    roleCardTitle: "Funding methods",
    roleCardDescription:
      "Save PayPal first for milestone funding. Bank accounts are stored now and reserved for future cashout flows.",
    roleCardEmptyTitle: "No funding methods yet",
    roleCardEmptyDescription:
      "Add a PayPal account so you can fund milestone escrow from the workspace.",
    addMethodTitle: "Add a method",
    addMethodDescription:
      "Start with PayPal for funding. Bank methods are stored for future withdrawal work.",
    transactionDescription:
      "Wallet is the snapshot. Transactions are the audit trail for deposits, holds, releases, and refunds.",
    emptyTransactionsTitle: "No transactions yet",
    emptyTransactionsDescription:
      "Once you fund a milestone, the deposit and escrow hold entries will appear here.",
    returnBanner: (milestoneTitle: string | null) =>
      milestoneTitle
        ? `You opened billing while funding "${milestoneTitle}". Save a PayPal method here, then jump straight back to finish escrow funding.`
        : "You opened billing from another workflow. Save a funding method here, then jump straight back when you are ready.",
  },
  BROKER: {
    heroBadge: "Commission wallet and release visibility",
    heroTitle: "See broker commission the same way the ledger sees it",
    heroDescription:
      "Track what is available, what is still locked by escrow or dispute, and how approved milestones are translating into broker commission.",
    primaryCtaLabel: "Open workspaces",
    secondaryCtaLabel: "Contracts",
    summaryEyebrow: "Commission release lane",
    summaryEmptyTitle: "Automatic commission posting",
    summaryModeBadge: "Read only",
    summarySourceLabel: "Commission source",
    roleCardTitle: "How commission reaches this wallet",
    roleCardDescription:
      "This view is intentionally read-only for brokers today. Commission arrives from approved milestone releases; funding itself remains a client-only action.",
    roleCardEmptyTitle: "No commission entries yet",
    roleCardEmptyDescription:
      "As milestones are approved, commission release rows will appear here automatically.",
    addMethodTitle: "What happens next",
    addMethodDescription:
      "Cashout and payout setup come in a later phase. For now, this page makes commission movement transparent enough to review with the rest of the project flow.",
    transactionDescription:
      "Transactions are the audit trail for commission releases, fee movements, and future payout work.",
    emptyTransactionsTitle: "No commission rows yet",
    emptyTransactionsDescription:
      "When a milestone is approved and released, the broker commission entry will show up here automatically.",
    returnBanner: (milestoneTitle: string | null) =>
      milestoneTitle
        ? `You opened the commission wallet while reviewing "${milestoneTitle}". Check release history here, then jump back to the workspace to continue coordination.`
        : "You opened the commission wallet from another workflow. Use it to verify what has already released, then jump back when you are ready.",
  },
  FREELANCER: {
    heroBadge: "Earnings wallet and release visibility",
    heroTitle: "Watch released milestone earnings land in one place",
    heroDescription:
      "See what is already available, what is still held by escrow, and how approved milestones are converting into freelancer earnings.",
    primaryCtaLabel: "My projects",
    secondaryCtaLabel: "Contracts",
    summaryEyebrow: "Earnings release lane",
    summaryEmptyTitle: "Automatic earnings posting",
    summaryModeBadge: "Read only",
    summarySourceLabel: "Earnings source",
    roleCardTitle: "How earnings reach this wallet",
    roleCardDescription:
      "This view is intentionally read-only for freelancers today. Earnings land here from approved milestone releases; funding and payout setup stay in separate phases.",
    roleCardEmptyTitle: "No earnings entries yet",
    roleCardEmptyDescription:
      "As milestones are approved, released earnings will appear here automatically.",
    addMethodTitle: "What happens next",
    addMethodDescription:
      "Cashout setup comes in a later phase. Right now the goal is to make earnings, holds, and release history easy to verify end-to-end.",
    transactionDescription:
      "Transactions are the audit trail for released earnings, fee movements, and future payout work.",
    emptyTransactionsTitle: "No earnings rows yet",
    emptyTransactionsDescription:
      "When a milestone is approved and released, the freelancer payout entry will show up here automatically.",
    returnBanner: (milestoneTitle: string | null) =>
      milestoneTitle
        ? `You opened the earnings wallet while checking "${milestoneTitle}". Review what has already released here, then jump back to the workspace to continue delivery.`
        : "You opened the earnings wallet from another workflow. Use it to verify released money, then jump back when you are ready.",
  },
} as const;

export default function BillingPage() {
  const [searchParams] = useSearchParams();
  const currentUser = useMemo(
    () => getStoredJson<{ role?: string }>(STORAGE_KEYS.USER),
    [],
  );
  const [wallet, setWallet] = useState<WalletSnapshot | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodView[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [composerType, setComposerType] = useState<PaymentMethodType>("PAYPAL_ACCOUNT");
  const [composer, setComposer] = useState<ComposerState>(initialComposerState);
  const [savingMethod, setSavingMethod] = useState(false);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);
  const [composerErrors, setComposerErrors] = useState<ComposerErrors>({});
  const [composerSubmitError, setComposerSubmitError] = useState<string | null>(null);

  const currentRole = normalizeSupportedBillingRole(currentUser?.role);
  const isClient = currentRole === "CLIENT";
  const billingExperience = roleCopy[currentRole];
  const returnTo = searchParams.get("returnTo");
  const safeReturnTo = returnTo && returnTo.startsWith("/") ? returnTo : null;
  const contextMilestoneTitle = searchParams.get("milestoneTitle")?.trim() || null;
  const projectsRoute = resolveProjectsRoute(currentRole);
  const contractsRoute = resolveContractsRoute(currentRole);

  const loadBillingData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const [walletSnapshot, transactionResult, methods] = await Promise.all([
        getWalletSnapshot(),
        getWalletTransactions(1, 12),
        isClient ? getPaymentMethods() : Promise.resolve([]),
      ]);

      setWallet(walletSnapshot);
      setTransactions(transactionResult.items);
      setPaymentMethods(methods);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load billing data";
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isClient]);

  useEffect(() => {
    loadBillingData();
  }, [loadBillingData]);

  const defaultMethod = useMemo(
    () => paymentMethods.find((method) => method.isDefault) ?? null,
    [paymentMethods],
  );
  const paypalMethods = useMemo(
    () => paymentMethods.filter((method) => method.type === "PAYPAL_ACCOUNT"),
    [paymentMethods],
  );
  const bankMethods = useMemo(
    () => paymentMethods.filter((method) => method.type === "BANK_ACCOUNT"),
    [paymentMethods],
  );
  const latestTransaction = transactions[0] ?? null;

  const stats = useMemo(() => {
    if (!wallet) {
      return [];
    }

    const lifetimeValue = isClient
      ? formatCurrency(wallet.totalDeposited, wallet.currency)
      : formatCurrency(wallet.totalEarned, wallet.currency);
    const lifetimeHint = isClient
      ? `Spent ${formatCurrency(wallet.totalSpent, wallet.currency)} so far`
      : `Withdrawn ${formatCurrency(wallet.totalWithdrawn, wallet.currency)} so far`;

    return [
      {
        id: "available",
        label: isClient
          ? "Available balance"
          : currentRole === "BROKER"
            ? "Available commission"
            : "Available earnings",
        value: formatCurrency(wallet.availableBalance, wallet.currency),
        hint: isClient
          ? "Ready for future funding or refunds"
          : "Released and ready for future cashout",
        icon: WalletCards,
        className: "from-slate-900 via-slate-800 to-teal-900 text-white",
      },
      {
        id: "held",
        label: isClient ? "Held in escrow" : "Held under review",
        value: formatCurrency(wallet.heldBalance, wallet.currency),
        hint: isClient
          ? "Locked until milestone release or dispute verdict"
          : "Frozen by unreleased escrow or dispute handling",
        icon: ShieldCheck,
        className: "from-amber-50 via-orange-50 to-white text-slate-900",
      },
      {
        id: "pending",
        label: "Pending balance",
        value: formatCurrency(wallet.pendingBalance, wallet.currency),
        hint: isClient
          ? "Reserved for async settlement in future flows"
          : "Reserved for future async payout settlement",
        icon: ArrowRightLeft,
        className: "from-sky-50 via-cyan-50 to-white text-slate-900",
      },
      {
        id: "lifetime",
        label: isClient ? "Lifetime deposited" : "Lifetime earned",
        value: lifetimeValue,
        hint: lifetimeHint,
        icon: PiggyBank,
        className: "from-emerald-50 via-teal-50 to-white text-slate-900",
      },
    ];
  }, [currentRole, isClient, wallet]);

  const updateComposer = <K extends keyof ComposerState>(key: K, value: ComposerState[K]) => {
    setComposer((previous) => ({
      ...previous,
      [key]: value,
    }));
    setComposerSubmitError(null);
    setComposerErrors((previous) => {
      if (!previous[key]) {
        return previous;
      }

      return {
        ...previous,
        [key]: undefined,
      };
    });
  };

  const resetComposer = () => {
    setComposer({
      ...initialComposerState,
      isDefault: paymentMethods.length === 0,
    });
    setComposerType("PAYPAL_ACCOUNT");
    setComposerErrors({});
    setComposerSubmitError(null);
  };

  const handleComposerTypeChange = (nextType: PaymentMethodType) => {
    setComposerType(nextType);
    setComposerErrors({});
    setComposerSubmitError(null);
  };

  const handleCreatePaymentMethod = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const payload: CreatePaymentMethodInput = {
      type: composerType,
      displayName: trimOptional(composer.displayName),
      isDefault: composer.isDefault,
    };

    const nextErrors = validateComposer(composerType, composer);
    if (Object.keys(nextErrors).length > 0) {
      setComposerErrors(nextErrors);
      const firstField = Object.keys(nextErrors)[0];
      const target = document.querySelector<HTMLElement>(`[name="${firstField}"]`);
      target?.focus();
      return;
    }

    if (composerType === "PAYPAL_ACCOUNT") {
      payload.paypalEmail = trimOptional(composer.paypalEmail);
    } else {
      payload.bankName = trimOptional(composer.bankName);
      payload.bankCode = trimOptional(composer.bankCode);
      payload.accountNumber = trimOptional(composer.accountNumber);
      payload.accountHolderName = trimOptional(composer.accountHolderName);
      payload.branchName = trimOptional(composer.branchName);
    }

    try {
      setSavingMethod(true);
      setComposerSubmitError(null);
      await createPaymentMethod(payload);
      toast.success("Payment method saved");
      setComposerErrors({});
      setComposer({
        ...initialComposerState,
        isDefault: false,
      });
      setComposerType("PAYPAL_ACCOUNT");
      await loadBillingData(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save payment method";
      setComposerSubmitError(message);
      toast.error(message);
    } finally {
      setSavingMethod(false);
    }
  };

  const handleSetDefault = async (methodId: string) => {
    try {
      setSettingDefaultId(methodId);
      await setDefaultPaymentMethod(methodId);
      toast.success("Default funding method updated");
      await loadBillingData(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update default method";
      toast.error(message);
    } finally {
      setSettingDefaultId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!wallet) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-8 text-rose-700">
        {error || "Unable to load wallet right now."}
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(20,184,166,0.18),_transparent_42%),radial-gradient(circle_at_bottom_left,_rgba(251,191,36,0.16),_transparent_34%)]" />
        <div className="relative grid gap-6 px-6 py-7 lg:grid-cols-[1.4fr_0.9fr] lg:px-8">
          <div className="space-y-4">
            <Badge className="border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-50">
              {billingExperience.heroBadge}
            </Badge>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                {billingExperience.heroTitle}
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-600">
                {billingExperience.heroDescription}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                to={projectsRoute}
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                {billingExperience.primaryCtaLabel}
                <ExternalLink className="h-4 w-4" />
              </Link>
              <Link
                to={contractsRoute}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                {billingExperience.secondaryCtaLabel}
                <ExternalLink className="h-4 w-4" />
              </Link>
              <button
                type="button"
                onClick={() => loadBillingData(true)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
                Refresh
              </button>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-slate-200/70 bg-slate-950 p-5 text-slate-50 shadow-inner">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-teal-200/80">
                  {billingExperience.summaryEyebrow}
                </p>
                <p className="mt-2 text-lg font-semibold">
                  {isClient
                    ? defaultMethod
                      ? defaultMethod.displayName
                      : billingExperience.summaryEmptyTitle
                    : latestTransaction
                      ? describeTransaction(latestTransaction)
                      : billingExperience.summaryEmptyTitle}
                </p>
              </div>
              <Badge className="border-white/10 bg-white/10 text-white hover:bg-white/10">
                {isClient
                  ? defaultMethod?.type === "PAYPAL_ACCOUNT"
                    ? "PayPal"
                    : defaultMethod
                      ? "Bank"
                      : billingExperience.summaryModeBadge
                  : billingExperience.summaryModeBadge}
              </Badge>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-300">
                  Wallet status
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {wallet.status}
                </p>
                <p className="mt-1 text-sm text-slate-300">
                  Updated {formatRelativeTime(wallet.updatedAt)}
                </p>
              </div>

              {!isClient ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-300">
                    {billingExperience.summarySourceLabel}
                  </p>
                  <p className="mt-2 text-sm font-medium text-white">
                    {currentRole === "BROKER"
                      ? "Approved milestone commissions"
                      : "Approved milestone payouts"}
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    {latestTransaction
                      ? `${transactionToneMap[latestTransaction.type]?.label ?? "Ledger movement"} posted ${formatRelativeTime(latestTransaction.createdAt)}`
                      : "No release has posted yet for this wallet."}
                  </p>
                </div>
              ) : null}

              <div className="space-y-2">
                {roleBillingRules[currentRole].map((rule) => (
                  <div key={rule} className="flex items-start gap-2 text-sm text-slate-200">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-teal-300" />
                    <span>{rule}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      )}

      {safeReturnTo && (
        <div className="rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p>{billingExperience.returnBanner(contextMilestoneTitle)}</p>
            <Button asChild variant="outline" className="rounded-full border-teal-200 bg-white text-teal-700 hover:bg-teal-100">
              <Link to={safeReturnTo}>Return To Workflow</Link>
            </Button>
          </div>
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <div
              key={stat.id}
              className={`overflow-hidden rounded-[1.75rem] bg-gradient-to-br p-[1px] shadow-sm ${stat.className}`}
            >
              <div className="h-full rounded-[1.7rem] bg-white/80 p-5 backdrop-blur-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      {stat.label}
                    </p>
                    <p className="text-2xl font-semibold tracking-tight text-slate-950">
                      {stat.value}
                    </p>
                    <p className="text-sm leading-6 text-slate-500">{stat.hint}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                    <Icon className="h-5 w-5 text-slate-700" />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {isClient ? (
        <section className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
          <Card className="overflow-hidden border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 bg-slate-50/70">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-xl font-semibold text-slate-950">
                    {billingExperience.roleCardTitle}
                  </CardTitle>
                  <CardDescription className="mt-1 text-sm text-slate-600">
                    {billingExperience.roleCardDescription}
                  </CardDescription>
                </div>
                <Badge className="border-slate-200 bg-white text-slate-700 hover:bg-white">
                  {paypalMethods.length} PayPal · {bankMethods.length} bank
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              {paymentMethods.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
                  <p className="text-base font-medium text-slate-900">
                    {billingExperience.roleCardEmptyTitle}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    {billingExperience.roleCardEmptyDescription}
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {paymentMethods.map((method) => {
                    const Icon = getPaymentMethodIcon(method.type);
                    const isUpdating = settingDefaultId === method.id;

                    return (
                      <div
                        key={method.id}
                        className={`rounded-[1.5rem] border p-4 transition ${
                          method.isDefault
                            ? "border-teal-200 bg-teal-50/60 shadow-sm"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="rounded-2xl border border-slate-200 bg-white p-3">
                              <Icon className="h-5 w-5 text-slate-700" />
                            </div>
                            <div className="space-y-1">
                              <p className="font-semibold text-slate-950">{method.displayName}</p>
                              <p className="text-sm text-slate-500">
                                {method.type === "PAYPAL_ACCOUNT"
                                  ? method.paypalEmail
                                  : `${method.bankName || "Bank account"} · ${method.accountNumberMasked || "Hidden"}`}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {method.isDefault && (
                              <Badge className="border-teal-200 bg-white text-teal-700 hover:bg-white">
                                Default
                              </Badge>
                            )}
                            <Badge
                              className={
                                method.isVerified
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
                                  : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50"
                              }
                            >
                              {method.isVerified ? "Verified" : "Saved"}
                            </Badge>
                          </div>
                        </div>

                        <div className="mt-5 flex items-center justify-between gap-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                            Added {formatRelativeTime(method.createdAt)}
                          </p>
                          {!method.isDefault && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSetDefault(method.id)}
                              disabled={isUpdating}
                              className="rounded-full border-slate-200"
                            >
                              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                              Set default
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 bg-gradient-to-br from-white via-teal-50/40 to-amber-50/50">
              <CardTitle className="text-xl font-semibold text-slate-950">
                {billingExperience.addMethodTitle}
              </CardTitle>
              <CardDescription className="text-sm text-slate-600">
                {billingExperience.addMethodDescription}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => handleComposerTypeChange("PAYPAL_ACCOUNT")}
                  className={`rounded-[1rem] px-3 py-2 text-sm font-medium transition ${
                    composerType === "PAYPAL_ACCOUNT"
                      ? "bg-white text-teal-700 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  PayPal
                </button>
                <button
                  type="button"
                  onClick={() => handleComposerTypeChange("BANK_ACCOUNT")}
                  className={`rounded-[1rem] px-3 py-2 text-sm font-medium transition ${
                    composerType === "BANK_ACCOUNT"
                      ? "bg-white text-teal-700 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Bank account
                </button>
              </div>

              <form className="mt-5 space-y-4" onSubmit={handleCreatePaymentMethod} noValidate>
                {composerSubmitError ? (
                  <div
                    className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
                    role="alert"
                  >
                    {composerSubmitError}
                  </div>
                ) : null}

                <div className="space-y-2">
                  <label htmlFor="payment-method-display-name" className="text-sm font-medium text-slate-800">
                    Display name
                  </label>
                  <Input
                    id="payment-method-display-name"
                    name="displayName"
                    value={composer.displayName}
                    onChange={(event) => updateComposer("displayName", event.target.value)}
                    autoComplete="off"
                    aria-describedby="payment-method-display-name-help"
                    placeholder={composerType === "PAYPAL_ACCOUNT" ? "Primary PayPal…" : "Main bank account…"}
                  />
                  <p id="payment-method-display-name-help" className="text-xs text-slate-500">
                    Optional label that helps you recognize this method later.
                  </p>
                  {composerErrors.displayName ? (
                    <p id="payment-method-display-name-error" className="text-sm text-rose-600" role="alert">
                      {composerErrors.displayName}
                    </p>
                  ) : null}
                </div>

                {composerType === "PAYPAL_ACCOUNT" ? (
                  <div className="space-y-2">
                    <label htmlFor="payment-method-paypal-email" className="text-sm font-medium text-slate-800">
                      PayPal email
                    </label>
                    <Input
                      id="payment-method-paypal-email"
                      name="paypalEmail"
                      type="email"
                      value={composer.paypalEmail}
                      onChange={(event) => updateComposer("paypalEmail", event.target.value)}
                      autoComplete="email"
                      spellCheck={false}
                      aria-invalid={Boolean(composerErrors.paypalEmail)}
                      aria-describedby={composerErrors.paypalEmail
                        ? "payment-method-paypal-email-error"
                        : "payment-method-paypal-email-help"}
                      placeholder="client@paypal.test…"
                      required
                    />
                    <p id="payment-method-paypal-email-help" className="text-xs text-slate-500">
                      This is the PayPal account that will appear in milestone funding.
                    </p>
                    {composerErrors.paypalEmail ? (
                      <p id="payment-method-paypal-email-error" className="text-sm text-rose-600" role="alert">
                        {composerErrors.paypalEmail}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label htmlFor="payment-method-bank-name" className="text-sm font-medium text-slate-800">
                          Bank name
                        </label>
                        <Input
                          id="payment-method-bank-name"
                          name="bankName"
                          value={composer.bankName}
                          onChange={(event) => updateComposer("bankName", event.target.value)}
                          autoComplete="organization"
                          aria-invalid={Boolean(composerErrors.bankName)}
                          aria-describedby={composerErrors.bankName
                            ? "payment-method-bank-name-error"
                            : undefined}
                          placeholder="Vietcombank…"
                          required
                        />
                        {composerErrors.bankName ? (
                          <p id="payment-method-bank-name-error" className="text-sm text-rose-600" role="alert">
                            {composerErrors.bankName}
                          </p>
                        ) : null}
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="payment-method-bank-code" className="text-sm font-medium text-slate-800">
                          Bank code
                        </label>
                        <Input
                          id="payment-method-bank-code"
                          name="bankCode"
                          value={composer.bankCode}
                          onChange={(event) => updateComposer("bankCode", event.target.value)}
                          autoComplete="off"
                          spellCheck={false}
                          placeholder="VCB…"
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label htmlFor="payment-method-account-number" className="text-sm font-medium text-slate-800">
                          Account number
                        </label>
                        <Input
                          id="payment-method-account-number"
                          name="accountNumber"
                          value={composer.accountNumber}
                          onChange={(event) => updateComposer("accountNumber", event.target.value)}
                          autoComplete="off"
                          inputMode="numeric"
                          spellCheck={false}
                          aria-invalid={Boolean(composerErrors.accountNumber)}
                          aria-describedby={composerErrors.accountNumber
                            ? "payment-method-account-number-error"
                            : undefined}
                          placeholder="0123456789…"
                          required
                        />
                        {composerErrors.accountNumber ? (
                          <p id="payment-method-account-number-error" className="text-sm text-rose-600" role="alert">
                            {composerErrors.accountNumber}
                          </p>
                        ) : null}
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="payment-method-account-holder" className="text-sm font-medium text-slate-800">
                          Account holder
                        </label>
                        <Input
                          id="payment-method-account-holder"
                          name="accountHolderName"
                          value={composer.accountHolderName}
                          onChange={(event) => updateComposer("accountHolderName", event.target.value)}
                          autoComplete="name"
                          aria-invalid={Boolean(composerErrors.accountHolderName)}
                          aria-describedby={composerErrors.accountHolderName
                            ? "payment-method-account-holder-error"
                            : undefined}
                          placeholder="Nguyen Van A…"
                          required
                        />
                        {composerErrors.accountHolderName ? (
                          <p id="payment-method-account-holder-error" className="text-sm text-rose-600" role="alert">
                            {composerErrors.accountHolderName}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="payment-method-branch-name" className="text-sm font-medium text-slate-800">
                        Branch name
                      </label>
                      <Input
                        id="payment-method-branch-name"
                        name="branchName"
                        value={composer.branchName}
                        onChange={(event) => updateComposer("branchName", event.target.value)}
                        autoComplete="off"
                        placeholder="Ho Chi Minh Main Branch…"
                      />
                    </div>
                  </>
                )}

                <label
                  htmlFor="payment-method-default"
                  className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                >
                  <input
                    id="payment-method-default"
                    name="isDefault"
                    type="checkbox"
                    checked={composer.isDefault}
                    onChange={(event) => updateComposer("isDefault", event.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-600"
                  />
                  <span>
                    Set as default funding method
                    <span className="mt-1 block text-xs text-slate-500">
                      The default method is preselected when you fund a milestone escrow.
                    </span>
                  </span>
                </label>

                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {composerType === "PAYPAL_ACCOUNT"
                    ? "Milestone funding currently accepts PayPal methods only."
                    : "Bank methods are stored now so the future cashout flow already has a home."}
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    type="submit"
                    disabled={savingMethod}
                    className="rounded-full bg-slate-900 px-5 hover:bg-slate-800"
                  >
                    {savingMethod ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Save method
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetComposer}
                    className="rounded-full border-slate-200"
                  >
                    Reset
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </section>
      ) : (
        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.9fr]">
          <Card className="overflow-hidden border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 bg-slate-50/70">
              <CardTitle className="text-xl font-semibold text-slate-950">
                {billingExperience.roleCardTitle}
              </CardTitle>
              <CardDescription className="mt-1 text-sm text-slate-600">
                {billingExperience.roleCardDescription}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="grid gap-4 md:grid-cols-2">
                {roleBillingRules[currentRole].map((rule) => (
                  <div
                    key={rule}
                    className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <div className="rounded-2xl border border-teal-100 bg-teal-50 p-3">
                        <CheckCircle2 className="h-5 w-5 text-teal-700" />
                      </div>
                      <p className="text-sm leading-6 text-slate-600">{rule}</p>
                    </div>
                  </div>
                ))}
              </div>

              {transactions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
                  <p className="text-base font-medium text-slate-900">
                    {billingExperience.roleCardEmptyTitle}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    {billingExperience.roleCardEmptyDescription}
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 bg-gradient-to-br from-white via-teal-50/40 to-amber-50/50">
              <CardTitle className="text-xl font-semibold text-slate-950">
                {billingExperience.addMethodTitle}
              </CardTitle>
              <CardDescription className="text-sm text-slate-600">
                {billingExperience.addMethodDescription}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  Today
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-950">
                  Read-only wallet visibility
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  This page lets you verify balance changes as milestones move from funded to released. It does not change funding ownership or payout rules.
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  Next phase
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-950">
                  Cashout and payout setup
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Your money can already be observed end-to-end here. Dedicated payout setup comes after the team locks the core payment and release flow.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button asChild className="rounded-full bg-slate-900 hover:bg-slate-800">
                  <Link to={projectsRoute}>
                    {billingExperience.primaryCtaLabel}
                  </Link>
                </Button>
                <Button asChild variant="outline" className="rounded-full border-slate-200">
                  <Link to={contractsRoute}>{billingExperience.secondaryCtaLabel}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 bg-slate-50/70">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-xl font-semibold text-slate-950">
                Recent ledger activity
              </CardTitle>
              <CardDescription className="mt-1 text-sm text-slate-600">
                {billingExperience.transactionDescription}
              </CardDescription>
            </div>
            <Badge className="border-slate-200 bg-white text-slate-700 hover:bg-white">
              {transactions.length} latest rows
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {transactions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
                <BadgeDollarSign className="h-5 w-5 text-slate-700" />
              </div>
              <p className="mt-4 text-base font-medium text-slate-900">
                {billingExperience.emptyTransactionsTitle}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                {billingExperience.emptyTransactionsDescription}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-[1.5rem] border border-slate-200">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Movement
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Context
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Amount
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Balance after
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {transactions.map((transaction) => {
                      const tone = transactionToneMap[transaction.type] ?? transactionToneMap.DEPOSIT;
                      const prefix = resolveTransactionAmountPrefix(transaction);

                      return (
                        <tr key={transaction.id} className="hover:bg-slate-50/70">
                          <td className="px-4 py-4 align-top">
                            <div className="space-y-2">
                              <Badge className={tone.badgeClassName}>
                                {tone.label}
                              </Badge>
                              <div>
                                <p className="text-sm font-medium text-slate-900">
                                  {describeTransaction(transaction)}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {transaction.status} · {formatRelativeTime(transaction.createdAt)}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 align-top">
                            <div className="space-y-1 text-sm text-slate-600">
                              <p>{transaction.paymentMethod || transaction.referenceType || "Internal ledger"}</p>
                              {transaction.referenceId ? (
                                <p className="font-mono text-xs text-slate-400">
                                  {transaction.referenceId.slice(0, 12)}
                                </p>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-right align-top">
                            <p className={`text-sm font-semibold ${tone.amountClassName}`}>
                              {prefix}
                              {formatCurrency(transaction.amount, transaction.currency)}
                            </p>
                            {transaction.fee > 0 ? (
                              <p className="mt-1 text-xs text-slate-500">
                                Fee {formatCurrency(transaction.fee, transaction.currency)}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-4 py-4 text-right align-top text-sm text-slate-600">
                            {transaction.balanceAfter === null
                              ? "N/A"
                              : formatCurrency(transaction.balanceAfter, transaction.currency)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function validateComposer(
  composerType: PaymentMethodType,
  composer: ComposerState,
): ComposerErrors {
  const errors: ComposerErrors = {};

  if (composerType === "PAYPAL_ACCOUNT") {
    if (!trimOptional(composer.paypalEmail)) {
      errors.paypalEmail = "Enter the PayPal email that should fund milestone escrow.";
    }
  } else {
    if (!trimOptional(composer.bankName)) {
      errors.bankName = "Enter the bank name.";
    }
    if (!trimOptional(composer.accountNumber)) {
      errors.accountNumber = "Enter the account number.";
    }
    if (!trimOptional(composer.accountHolderName)) {
      errors.accountHolderName = "Enter the account holder name.";
    }
  }

  return errors;
}
