import { useCallback, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useSearchParams } from "react-router-dom";
import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";
import {
  ArrowRightLeft,
  BadgeDollarSign,
  Clock3,
  PencilLine,
  ExternalLink,
  Landmark,
  Loader2,
  PiggyBank,
  ShieldCheck,
  Trash2,
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
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/components/ui/form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import paypalLogo from "@/assets/brands/paypal-logo.svg";
import { getStoredJson } from "@/shared/utils/storage";
import {
  createPayoutMethod,
  deletePayoutMethod,
  getPaymentMethods,
  getPayoutMethods,
  getPayoutRequests,
  getCashoutQuote,
  getWalletSnapshot,
  getWalletTransactions,
  requestCashout,
  resetPayPalCheckout,
  setDefaultPayoutMethod,
  updatePayoutMethod,
} from "./api";
import type {
  CashoutQuote,
  CreatePayoutMethodInput,
  CreatePayoutRequestInput,
  PaymentMethodView,
  PayoutMethodView,
  PayoutRequestView,
  WalletSnapshot,
  WalletTransaction,
} from "./types";
import {
  normalizeSupportedBillingRole,
  resolveContractsRoute,
  resolveProjectsRoute,
} from "./roleRoutes";

const payoutMethodSchema = z.object({
  type: z.enum(["PAYPAL_EMAIL", "BANK_ACCOUNT"]),
  displayName: z.string(),
  paypalEmail: z.string(),
  bankName: z.string(),
  bankCode: z.string(),
  accountNumber: z.string(),
  accountHolderName: z.string(),
  branchName: z.string(),
  isEditing: z.boolean(),
  isDefault: z.boolean(),
}).superRefine((values, ctx) => {
  if (values.displayName.trim().length > 80) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["displayName"],
      message: "Keep the label under 80 characters.",
    });
  }

  if (values.type === "PAYPAL_EMAIL") {
    const email = values.paypalEmail.trim();
    if (!email) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["paypalEmail"],
        message: "Enter the PayPal email.",
      });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["paypalEmail"],
        message: "Enter a valid email address.",
      });
    }

    return;
  }

  if (!values.bankName.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["bankName"],
      message: "Enter the bank name.",
    });
  }

  const accountNumber = values.accountNumber.trim();
  if (!accountNumber) {
    if (!values.isEditing) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["accountNumber"],
        message: "Enter the account number.",
      });
    }
  } else if (!/^[0-9A-Za-z]{6,34}$/.test(accountNumber)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["accountNumber"],
      message: "Use 6-34 letters or numbers.",
    });
  }

  if (!values.accountHolderName.trim() && !values.isEditing) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["accountHolderName"],
      message: "Enter the account holder name.",
    });
  }

  if (values.bankCode.trim().length > 20) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["bankCode"],
      message: "Keep the bank code under 20 characters.",
    });
  }

  if (values.branchName.trim().length > 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["branchName"],
      message: "Keep the branch name under 100 characters.",
    });
  }
});

type PayoutMethodFormValues = z.infer<typeof payoutMethodSchema>;

const initialPayoutMethodState: PayoutMethodFormValues = {
  type: "PAYPAL_EMAIL",
  displayName: "",
  paypalEmail: "",
  bankName: "",
  bankCode: "",
  accountNumber: "",
  accountHolderName: "",
  branchName: "",
  isEditing: false,
  isDefault: false,
};

const cashoutRequestSchema = z.object({
  amount: z.coerce.number().positive("Enter a cashout amount."),
  payoutMethodId: z.string().min(1, "Choose a PayPal payout email."),
  note: z.string().max(280, "Keep the note under 280 characters.").optional().or(z.literal("")),
});

type CashoutRequestFormValues = z.infer<typeof cashoutRequestSchema>;

const initialCashoutRequestState: CashoutRequestFormValues = {
  amount: 0,
  payoutMethodId: "",
  note: "",
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

const TRANSACTION_PAGE_LIMIT = 12;

const trimOptional = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const createEmptyPayoutMethodComposer = (
  isDefault = false,
): PayoutMethodFormValues => ({
  ...initialPayoutMethodState,
  type: "PAYPAL_EMAIL",
  isDefault,
});

const buildPayoutMethodFromMethod = (method: PayoutMethodView): PayoutMethodFormValues => ({
  type: method.type,
  displayName: method.displayName ?? "",
  paypalEmail: method.paypalEmail ?? "",
  bankName: method.bankName ?? "",
  bankCode: method.bankCode ?? "",
  accountNumber: "",
  accountHolderName: "",
  branchName: method.branchName ?? "",
  isEditing: true,
  isDefault: method.isDefault,
});

const extractMilestoneTitle = (transaction: WalletTransaction) => {
  const description = transaction.description ?? "";
  const quotedMatch = description.match(/milestone\s+"([^"]+)"/i);

  if (quotedMatch?.[1]) {
    return quotedMatch[1];
  }

  const metadataTitle =
    typeof transaction.metadata?.milestoneTitle === "string"
      ? transaction.metadata.milestoneTitle.trim()
      : null;

  return metadataTitle || null;
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

  return "Wallet update";
};

const isPayPalCaptureRefund = (transaction: WalletTransaction) =>
  transaction.type === "REFUND"
  && transaction.metadata?.refundMode === "PAYPAL_CAPTURE_REFUND";

const describeClientTransaction = (transaction: WalletTransaction) => {
  const milestoneTitle = extractMilestoneTitle(transaction);

  switch (transaction.type) {
    case "DEPOSIT":
      return milestoneTitle ? `Funded "${milestoneTitle}"` : "Milestone funded";
    case "ESCROW_HOLD":
      return milestoneTitle ? `Locked "${milestoneTitle}" in escrow` : "Locked in escrow";
    case "ESCROW_RELEASE":
      return milestoneTitle ? `Released "${milestoneTitle}"` : "Escrow released";
    case "REFUND":
      return isPayPalCaptureRefund(transaction)
        ? milestoneTitle
          ? `Refunded "${milestoneTitle}" to PayPal`
          : "Refunded to PayPal"
        : milestoneTitle
          ? `Refunded "${milestoneTitle}" to wallet`
          : "Escrow refunded";
    case "FEE_DEDUCTION":
      return "Platform fee recorded";
    default:
      return describeTransaction(transaction);
  }
};

const resolveTransactionAmountPrefix = (transaction: WalletTransaction) => {
  if (transaction.type === "DEPOSIT") {
    return "+";
  }

  if (transaction.type === "REFUND") {
    return isPayPalCaptureRefund(transaction) ? "-" : "+";
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

const roleCopy = {
  CLIENT: {
    heroBadge: "Client Billing",
    heroTitle: "Billing & Wallet",
    heroDescription:
      "Track what is funded, held in escrow, released, or refunded. Refundable dispute balance can also be withdrawn from here after it settles back into your wallet.",
    primaryCtaLabel: "Open projects",
    secondaryCtaLabel: "Contracts",
    summaryEyebrow: "PayPal funding",
    summaryEmptyTitle: "Ready for checkout",
    summaryModeBadge: "PayPal",
    summarySourceLabel: "Funding rail",
    roleCardTitle: "Refund payout",
    roleCardDescription:
      "Save the PayPal email that should receive refundable wallet balance after a verdict or release reversal.",
    roleCardEmptyTitle: "No PayPal payout email saved yet",
    roleCardEmptyDescription:
      "Add a PayPal email so refunded wallet balance has a withdrawal destination.",
    addMethodTitle: "Save refund payout",
    addMethodDescription:
      "Save the PayPal email that should receive refundable wallet balance once it becomes available.",
    transactionDescription:
      "Funding, escrow holds, releases, refunds, fees, and any client cashouts.",
    emptyTransactionsTitle: "No transactions yet",
    emptyTransactionsDescription:
      "Once you fund a milestone, the deposit and escrow hold entries will appear here.",
    returnBanner: (milestoneTitle: string | null) =>
      milestoneTitle
        ? `You opened billing from "${milestoneTitle}".`
        : "Return to a milestone workspace to continue funding.",
  },
  BROKER: {
    heroBadge: "Broker Wallet",
    heroTitle: "Commission Wallet",
    heroDescription:
      "Review released commission, keep a PayPal payout email ready, and cash out when funds are available.",
    primaryCtaLabel: "Open workspaces",
    secondaryCtaLabel: "Contracts",
    summaryEyebrow: "Latest release",
    summaryEmptyTitle: "No commission activity yet",
    summaryModeBadge: "Cashout ready",
    summarySourceLabel: "Commission source",
    roleCardTitle: "PayPal payout",
    roleCardDescription:
      "Save the PayPal email used for commission cashouts.",
    roleCardEmptyTitle: "No PayPal payout email saved yet",
    roleCardEmptyDescription:
      "Add a PayPal email so commission cashouts have a destination.",
    addMethodTitle: "Save PayPal payout",
    addMethodDescription:
      "Save the PayPal email that should receive commission cashouts.",
    transactionDescription:
      "Commission, payout requests, fees, and wallet activity.",
    emptyTransactionsTitle: "No commission rows yet",
    emptyTransactionsDescription:
      "When a milestone is approved and released, the broker commission entry will show up here automatically.",
    returnBanner: (milestoneTitle: string | null) =>
      milestoneTitle
        ? `You opened the commission wallet while reviewing "${milestoneTitle}". Check release history here, then return to the workspace.`
        : "Review the ledger here, then head back when you are ready.",
  },
  FREELANCER: {
    heroBadge: "Freelancer Wallet",
    heroTitle: "Earnings Wallet",
    heroDescription:
      "Review released earnings, keep a PayPal payout email ready, and cash out when funds are available.",
    primaryCtaLabel: "My projects",
    secondaryCtaLabel: "Contracts",
    summaryEyebrow: "Latest release",
    summaryEmptyTitle: "No earnings activity yet",
    summaryModeBadge: "Cashout ready",
    summarySourceLabel: "Earnings source",
    roleCardTitle: "PayPal payout",
    roleCardDescription:
      "Save the PayPal email used for earnings cashouts.",
    roleCardEmptyTitle: "No PayPal payout email saved yet",
    roleCardEmptyDescription:
      "Add a PayPal email so released earnings have a destination.",
    addMethodTitle: "Save PayPal payout",
    addMethodDescription:
      "Save the PayPal email that should receive released earnings cashouts.",
    transactionDescription:
      "Earnings, payout requests, fees, and wallet activity.",
    emptyTransactionsTitle: "No earnings rows yet",
    emptyTransactionsDescription:
      "When a milestone is approved and released, the freelancer payout entry will show up here automatically.",
    returnBanner: (milestoneTitle: string | null) =>
      milestoneTitle
        ? `You opened the earnings wallet while checking "${milestoneTitle}". Review what has already released here, then return to the workspace.`
        : "Review the ledger here, then head back when you are ready.",
  },
} as const;

const describeWalletStatus = (status: WalletSnapshot["status"]) => {
  switch (status) {
    case "ACTIVE":
      return "Ready";
    case "FROZEN":
      return "Frozen";
    case "SUSPENDED":
      return "Suspended";
    default:
      return status;
  }
};

const describeTransactionContext = (transaction: WalletTransaction) => {
  if (transaction.type === "DEPOSIT") {
    return "Funding added";
  }

  if (transaction.type === "ESCROW_HOLD") {
    return "Moved into escrow";
  }

  if (transaction.type === "ESCROW_RELEASE") {
    if (transaction.description?.toLowerCase().includes("commission")) {
      return "Broker commission";
    }

    if (transaction.description?.toLowerCase().includes("payout")) {
      return "Freelancer payout";
    }

    return "Milestone released";
  }

  if (transaction.type === "REFUND") {
    return isPayPalCaptureRefund(transaction)
      ? "Returned to the original PayPal funding source"
      : "Returned to wallet";
  }

  if (transaction.type === "FEE_DEDUCTION") {
    return "Platform fee";
  }

  if (transaction.type === "WITHDRAWAL") {
    return "Cashout";
  }

  return "Wallet movement";
};

const describeClientTransactionContext = (transaction: WalletTransaction) => {
  switch (transaction.type) {
    case "DEPOSIT":
      return "PayPal checkout completed";
    case "ESCROW_HOLD":
      return "Held until review and approval finish";
    case "ESCROW_RELEASE":
      return "Released after approval";
    case "REFUND":
      return isPayPalCaptureRefund(transaction)
        ? "Returned to the original PayPal funding source"
        : "Returned to the client wallet";
    default:
      return describeTransactionContext(transaction);
  }
};

const describeClientTransactionBadge = (transaction: WalletTransaction) => {
  switch (transaction.type) {
    case "DEPOSIT":
      return "Funded";
    case "ESCROW_HOLD":
      return "Held";
    case "ESCROW_RELEASE":
      return "Released";
    case "REFUND":
      return isPayPalCaptureRefund(transaction) ? "PayPal refund" : "Refunded";
    default:
      return transactionToneMap[transaction.type]?.label ?? "Update";
  }
};

const describeTransactionSource = (transaction: WalletTransaction) => {
  if (transaction.paymentMethod === "PAYPAL_ACCOUNT") {
    return "PayPal";
  }

  if (transaction.paymentMethod === "BANK_ACCOUNT") {
    return "Bank account";
  }

  if (transaction.paymentMethod === "CARD_ACCOUNT") {
    return "Card";
  }

  if (transaction.type === "ESCROW_HOLD" || transaction.type === "ESCROW_RELEASE") {
    return "Milestone escrow";
  }

  if (transaction.type === "REFUND") {
    return isPayPalCaptureRefund(transaction) ? "PayPal" : "Escrow refund";
  }

  return "Internal wallet";
};

const describeTransactionStatus = (status: WalletTransaction["status"]) => {
  switch (status) {
    case "COMPLETED":
      return "Posted";
    case "PROCESSING":
      return "Processing";
    case "PENDING":
      return "Pending";
    case "FAILED":
      return "Failed";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
};

const describePayoutMethod = (method: PayoutMethodView) => {
  if (method.type === "PAYPAL_EMAIL") {
    return method.displayName || "PayPal payout";
  }

  const parts = [
    method.displayName || method.bankName,
    method.bankCode ? `(${method.bankCode})` : null,
    method.branchName ? `· ${method.branchName}` : null,
  ].filter(Boolean);

  return parts.join(" ");
};

const describePayoutAccount = (method: PayoutMethodView) => {
  if (method.type === "PAYPAL_EMAIL") {
    return method.paypalEmail ?? "PayPal email not set";
  }

  return method.accountNumberMasked ?? "Bank account";
};

const payoutToneMap: Record<
  string,
  {
    badgeClassName: string;
    amountClassName: string;
    label: string;
  }
> = {
  PENDING: {
    badgeClassName: "border-amber-200 bg-amber-50 text-amber-700",
    amountClassName: "text-amber-700",
    label: "Pending",
  },
  APPROVED: {
    badgeClassName: "border-sky-200 bg-sky-50 text-sky-700",
    amountClassName: "text-sky-700",
    label: "Approved",
  },
  PROCESSING: {
    badgeClassName: "border-indigo-200 bg-indigo-50 text-indigo-700",
    amountClassName: "text-indigo-700",
    label: "Processing",
  },
  COMPLETED: {
    badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amountClassName: "text-emerald-700",
    label: "Completed",
  },
  FAILED: {
    badgeClassName: "border-rose-200 bg-rose-50 text-rose-700",
    amountClassName: "text-rose-700",
    label: "Failed",
  },
  REJECTED: {
    badgeClassName: "border-rose-200 bg-rose-50 text-rose-700",
    amountClassName: "text-rose-700",
    label: "Rejected",
  },
  CANCELLED: {
    badgeClassName: "border-slate-200 bg-slate-50 text-slate-700",
    amountClassName: "text-slate-700",
    label: "Cancelled",
  },
};

const describePayoutStatus = (status: PayoutRequestView["status"]) => {
  switch (status) {
    case "PENDING":
      return "Pending approval";
    case "APPROVED":
      return "Approved";
    case "PROCESSING":
      return "Processing";
    case "COMPLETED":
      return "Completed";
    case "FAILED":
      return "Failed";
    case "REJECTED":
      return "Rejected";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
};

const isSandboxFallbackCashout = (request: PayoutRequestView) =>
  Boolean(
    request.adminNote?.toLowerCase().includes("sandbox fallback") ||
      request.externalReference?.startsWith("sandbox:payout:"),
  );

const describeCashoutRailBadge = (
  quote?: CashoutQuote | null,
): {
  label: string;
  className: string;
} => {
  if (!quote) {
    return {
      label: "Pending quote",
      className: "border-slate-200 bg-white text-slate-700",
    };
  }

  if (quote.processingMode === "PAYPAL_PAYOUTS") {
    return {
      label: "PayPal Payouts",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  return {
    label: "Sandbox fallback",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  };
};

const formatAmountPreview = (amount: number, currency: string) =>
  formatCurrency(amount, currency);

function PayPalLogo({
  compact = false,
  className = "",
  decorative = false,
}: {
  compact?: boolean;
  className?: string;
  decorative?: boolean;
}) {
  return (
    <img
      src={paypalLogo}
      alt={decorative ? "" : "PayPal"}
      aria-hidden={decorative}
      className={`${compact ? "h-5" : "h-6"} w-auto object-contain ${className}`}
    />
  );
}

export default function BillingPage() {
  const [searchParams] = useSearchParams();
  const currentUser = useMemo(
    () => getStoredJson<{ role?: string }>(STORAGE_KEYS.USER),
    [],
  );
  const [wallet, setWallet] = useState<WalletSnapshot | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [transactionsPage, setTransactionsPage] = useState(1);
  const [transactionsTotal, setTransactionsTotal] = useState(0);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodView[]>([]);
  const [payoutMethods, setPayoutMethods] = useState<PayoutMethodView[]>([]);
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequestView[]>([]);
  const [payoutRequestsPage, setPayoutRequestsPage] = useState(1);
  const [payoutRequestsTotal, setPayoutRequestsTotal] = useState(0);
  const [cashoutQuote, setCashoutQuote] = useState<CashoutQuote | null>(null);
  const [cashoutQuoteLoading, setCashoutQuoteLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMoreTransactions, setLoadingMoreTransactions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resettingFundingMethodId, setResettingFundingMethodId] = useState<string | null>(null);
  const [fundingMethodPendingReset, setFundingMethodPendingReset] = useState<PaymentMethodView | null>(null);
  const [savingPayoutMethod, setSavingPayoutMethod] = useState(false);
  const [settingDefaultPayoutId, setSettingDefaultPayoutId] = useState<string | null>(null);
  const [deletingPayoutMethodId, setDeletingPayoutMethodId] = useState<string | null>(null);
  const [payoutMethodPendingDelete, setPayoutMethodPendingDelete] = useState<PayoutMethodView | null>(null);
  const [editingPayoutMethod, setEditingPayoutMethod] = useState<PayoutMethodView | null>(null);
  const [payoutMethodSubmitError, setPayoutMethodSubmitError] = useState<string | null>(null);
  const [requestingCashout, setRequestingCashout] = useState(false);
  const [cashoutSubmitError, setCashoutSubmitError] = useState<string | null>(null);
  const payoutMethodForm = useForm<PayoutMethodFormValues>({
    resolver: zodResolver(payoutMethodSchema),
    defaultValues: initialPayoutMethodState,
  });
  const cashoutRequestForm = useForm<CashoutRequestFormValues>({
    resolver: zodResolver(cashoutRequestSchema) as unknown as Resolver<CashoutRequestFormValues>,
    defaultValues: initialCashoutRequestState,
  });

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

      const [walletSnapshot, transactionResult] = await Promise.all([
        getWalletSnapshot(),
        getWalletTransactions(1, TRANSACTION_PAGE_LIMIT),
      ]);

      setWallet(walletSnapshot);
      setTransactions(transactionResult.items);
      setTransactionsPage(transactionResult.page);
      setTransactionsTotal(transactionResult.total);

      if (isClient) {
        const [methods, payoutMethodsResult, payoutRequestsResult] = await Promise.all([
          getPaymentMethods(),
          getPayoutMethods(),
          getPayoutRequests(1, 8),
        ]);
        setPaymentMethods(methods);
        setPayoutMethods(payoutMethodsResult);
        setWallet(payoutRequestsResult.wallet);
        setPayoutRequests(payoutRequestsResult.items);
        setPayoutRequestsPage(payoutRequestsResult.page);
        setPayoutRequestsTotal(payoutRequestsResult.total);
      } else {
        setPaymentMethods([]);

        const [payoutMethodsResult, payoutRequestsResult] = await Promise.all([
          getPayoutMethods(),
          getPayoutRequests(1, 8),
        ]);

        setPayoutMethods(payoutMethodsResult);
        setWallet(payoutRequestsResult.wallet);
        setPayoutRequests(payoutRequestsResult.items);
        setPayoutRequestsPage(payoutRequestsResult.page);
        setPayoutRequestsTotal(payoutRequestsResult.total);
      }
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

  const fundingMethods = useMemo(
    () => paymentMethods.filter((method) => method.type === "PAYPAL_ACCOUNT"),
    [paymentMethods],
  );
  const preferredFundingMethod = useMemo(
    () => fundingMethods.find((method) => method.isDefault)
      ?? fundingMethods[0]
      ?? null,
    [fundingMethods],
  );
  const savedFundingBuyerEmail = useMemo(() => {
    const email = preferredFundingMethod?.paypalEmail?.trim();
    return email ? email : null;
  }, [preferredFundingMethod]);
  const fundingVaultReady = Boolean(preferredFundingMethod?.fastCheckoutReady);
  const hasSavedFundingBuyer = Boolean(
    savedFundingBuyerEmail
    || fundingVaultReady
    || preferredFundingMethod?.vaultStatus,
  );
  const latestTransaction = transactions[0] ?? null;
  const hasMoreTransactions = transactions.length < transactionsTotal;
  const watchedCashoutAmount = cashoutRequestForm.watch("amount");
  const watchedCashoutMethodId = cashoutRequestForm.watch("payoutMethodId");
  const cashoutEligibleMethods = useMemo(
    () => payoutMethods.filter((method) => method.type === "PAYPAL_EMAIL"),
    [payoutMethods],
  );
  const hiddenPayoutMethods = useMemo(
    () => payoutMethods.filter((method) => method.type !== "PAYPAL_EMAIL"),
    [payoutMethods],
  );
  const selectedCashoutMethod = useMemo(
    () => cashoutEligibleMethods.find((method) => method.id === watchedCashoutMethodId) ?? null,
    [cashoutEligibleMethods, watchedCashoutMethodId],
  );
  const payoutMethodCount = cashoutEligibleMethods.length;
  const hasAvailableCashoutBalance = (wallet?.availableBalance ?? 0) > 0;

  useEffect(() => {
    if (editingPayoutMethod || cashoutEligibleMethods.length === 0) {
      return;
    }

    if (!payoutMethodForm.getValues("isDefault")) {
      payoutMethodForm.setValue("isDefault", true, { shouldDirty: false });
    }
  }, [cashoutEligibleMethods.length, editingPayoutMethod, payoutMethodForm]);

  useEffect(() => {
    if ((!watchedCashoutMethodId || !selectedCashoutMethod) && cashoutEligibleMethods.length > 0) {
      cashoutRequestForm.setValue("payoutMethodId", cashoutEligibleMethods.find((method) => method.isDefault)?.id ?? cashoutEligibleMethods[0]?.id ?? "", {
        shouldDirty: false,
      });
    }
  }, [cashoutEligibleMethods, cashoutRequestForm, selectedCashoutMethod, watchedCashoutMethodId]);

  useEffect(() => {
    const amount = Number(watchedCashoutAmount);
    if (!selectedCashoutMethod || !amount || Number.isNaN(amount)) {
      setCashoutQuote(null);
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        setCashoutQuoteLoading(true);
        const quote = await getCashoutQuote({
          payoutMethodId: selectedCashoutMethod.id,
          amount,
        });
        setCashoutQuote(quote);
      } catch {
        setCashoutQuote({
          amount,
          fee: 0,
          netAmount: amount,
          currency: wallet?.currency ?? "USD",
          availableBalance: wallet?.availableBalance ?? null,
          minimumAmount: null,
          maximumAmount: wallet?.availableBalance ?? null,
          processingMode: "SANDBOX_FALLBACK",
          processingDescription:
            "The quote could not confirm PayPal Payouts right now, so treat this preview as sandbox fallback until the next refresh succeeds.",
        });
      } finally {
        setCashoutQuoteLoading(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [selectedCashoutMethod, wallet?.availableBalance, wallet?.currency, watchedCashoutAmount]);

  const stats = useMemo(() => {
    if (!wallet) {
      return [];
    }

    if (isClient) {
      return [
        {
          id: "available",
          label: "Available to withdraw",
          value: formatCurrency(wallet.availableBalance, wallet.currency),
          icon: WalletCards,
        },
        {
          id: "held",
          label: "Held in escrow",
          value: formatCurrency(wallet.heldBalance, wallet.currency),
          icon: ShieldCheck,
        },
        {
          id: "funded",
          label: "Total funded",
          value: formatCurrency(wallet.totalDeposited, wallet.currency),
          icon: PiggyBank,
        },
        {
          id: "released",
          label: "Released so far",
          value: formatCurrency(wallet.totalSpent, wallet.currency),
          icon: BadgeDollarSign,
        },
      ];
    }

    const lifetimeValue = formatCurrency(wallet.totalEarned, wallet.currency);

    return [
      {
        id: "available",
        label: currentRole === "BROKER"
          ? "Available commission"
          : "Available earnings",
        value: formatCurrency(wallet.availableBalance, wallet.currency),
        icon: WalletCards,
      },
      {
        id: "awaiting-release",
        label: "In funded milestones",
        value: formatCurrency(wallet.awaitingReleaseAmount, wallet.currency),
        icon: Clock3,
      },
      {
        id: "withdrawn",
        label: "Total cashed out",
        value: formatCurrency(wallet.totalWithdrawn, wallet.currency),
        icon: ArrowRightLeft,
      },
      {
        id: "lifetime",
        label: currentRole === "BROKER" ? "Lifetime commission" : "Lifetime earned",
        value: lifetimeValue,
        icon: PiggyBank,
      },
    ];
  }, [currentRole, isClient, wallet]);

  const handleLoadMoreTransactions = useCallback(async () => {
    if (loadingMoreTransactions || !hasMoreTransactions) {
      return;
    }

    try {
      setLoadingMoreTransactions(true);
      const nextPage = transactionsPage + 1;
      const transactionResult = await getWalletTransactions(nextPage, TRANSACTION_PAGE_LIMIT);
      setTransactions((current) => [...current, ...transactionResult.items]);
      setTransactionsPage(transactionResult.page);
      setTransactionsTotal(transactionResult.total);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load more transactions";
      toast.error(message);
    } finally {
      setLoadingMoreTransactions(false);
    }
  }, [hasMoreTransactions, loadingMoreTransactions, transactionsPage]);

  const handleResetFundingMethod = async () => {
    if (!fundingMethodPendingReset) {
      return;
    }

    try {
      setResettingFundingMethodId(fundingMethodPendingReset.id);
      await resetPayPalCheckout(fundingMethodPendingReset.id);
      toast.success("Saved PayPal buyer cleared");
      setFundingMethodPendingReset(null);
      await loadBillingData(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to clear the saved PayPal buyer";
      toast.error(message);
    } finally {
      setResettingFundingMethodId(null);
    }
  };

  const resetPayoutMethodForm = () => {
    setEditingPayoutMethod(null);
    payoutMethodForm.reset({
      ...createEmptyPayoutMethodComposer(payoutMethodCount === 0),
    });
    setPayoutMethodSubmitError(null);
  };

  const handleEditPayoutMethod = (method: PayoutMethodView) => {
    setEditingPayoutMethod(method);
    payoutMethodForm.reset(buildPayoutMethodFromMethod(method));
    setPayoutMethodSubmitError(null);
  };

  const handleSubmitPayoutMethod = payoutMethodForm.handleSubmit(async (values) => {
    const payload: CreatePayoutMethodInput = {
      type: "PAYPAL_EMAIL",
      displayName: trimOptional(values.displayName),
      isDefault: values.isDefault,
    };
    payload.paypalEmail = trimOptional(values.paypalEmail);

    try {
      setSavingPayoutMethod(true);
      setPayoutMethodSubmitError(null);
      if (editingPayoutMethod) {
        await updatePayoutMethod(editingPayoutMethod.id, payload);
        toast.success("Payout method updated");
      } else {
        await createPayoutMethod(payload);
        toast.success("Payout method saved");
      }
      resetPayoutMethodForm();
      await loadBillingData(true);
    } catch (err: unknown) {
      const message = err instanceof Error
        ? err.message
        : editingPayoutMethod
          ? "Failed to update payout method"
          : "Failed to save payout method";
      setPayoutMethodSubmitError(message);
      toast.error(message);
    } finally {
      setSavingPayoutMethod(false);
    }
  });

  const handleSetDefaultPayoutMethod = async (methodId: string) => {
    try {
      setSettingDefaultPayoutId(methodId);
      await setDefaultPayoutMethod(methodId);
      toast.success("Default payout method updated");
      await loadBillingData(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update default payout method";
      toast.error(message);
    } finally {
      setSettingDefaultPayoutId(null);
    }
  };

  const handleDeletePayoutMethod = async () => {
    if (!payoutMethodPendingDelete) {
      return;
    }

    try {
      setDeletingPayoutMethodId(payoutMethodPendingDelete.id);
      const result = await deletePayoutMethod(payoutMethodPendingDelete.id);
      toast.success(
        result.nextDefaultMethodId
          ? "Payout method removed. Another method is now the default."
          : "Payout method removed",
      );
      if (editingPayoutMethod?.id === payoutMethodPendingDelete.id) {
        resetPayoutMethodForm();
      }
      setPayoutMethodPendingDelete(null);
      await loadBillingData(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete payout method";
      toast.error(message);
    } finally {
      setDeletingPayoutMethodId(null);
    }
  };

  const handleSubmitCashout = cashoutRequestForm.handleSubmit(async (values) => {
    const selectedMethod = cashoutEligibleMethods.find((method) => method.id === values.payoutMethodId) ?? null;
    const amount = Number(values.amount);

    if (!selectedMethod) {
      setCashoutSubmitError("Choose a PayPal payout email.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setCashoutSubmitError("Enter a valid cashout amount.");
      return;
    }

    if (wallet && amount > wallet.availableBalance) {
      setCashoutSubmitError("Cashout amount cannot exceed the available balance.");
      return;
    }

    try {
      setRequestingCashout(true);
      setCashoutSubmitError(null);
      const payload: CreatePayoutRequestInput = {
        payoutMethodId: values.payoutMethodId,
        amount,
        note: trimOptional(values.note ?? ""),
      };
      const result = await requestCashout(payload);
      setWallet(result.wallet);
      toast.success("Cashout request submitted");
      cashoutRequestForm.reset({
        ...initialCashoutRequestState,
        payoutMethodId: cashoutEligibleMethods.find((method) => method.isDefault)?.id ?? cashoutEligibleMethods[0]?.id ?? "",
      });
      await loadBillingData(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to submit cashout request";
      setCashoutSubmitError(message);
      toast.error(message);
    } finally {
      setRequestingCashout(false);
    }
  });

  const handleLoadMorePayoutRequests = useCallback(async () => {
    if (payoutRequests.length >= payoutRequestsTotal) {
      return;
    }

    try {
      const nextPage = payoutRequestsPage + 1;
      const result = await getPayoutRequests(nextPage, 8);
      setPayoutRequests((current) => [...current, ...result.items]);
      setPayoutRequestsPage(result.page);
      setPayoutRequestsTotal(result.total);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load more cashout requests";
      toast.error(message);
    }
  }, [payoutRequests.length, payoutRequestsPage, payoutRequestsTotal]);

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
    <div className="mx-auto max-w-7xl space-y-8 pb-6">
      <section className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,420px)]">
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="space-y-6 p-6 md:p-7">
            <div className="space-y-3">
              <Badge className="w-fit border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-100">
                {billingExperience.heroBadge}
              </Badge>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
                  {billingExperience.heroTitle}
                </h1>
                <p className="max-w-xl text-sm leading-6 text-slate-600 md:text-base">
                  {billingExperience.heroDescription}
                </p>
                {safeReturnTo ? (
                  <p className="max-w-xl text-sm leading-6 text-slate-500">
                    {billingExperience.returnBanner(contextMilestoneTitle)}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-1">
              {safeReturnTo ? (
                <Button asChild variant="outline" className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
                  <Link to={safeReturnTo}>Back to workflow</Link>
                </Button>
              ) : null}
              <Button asChild className="bg-slate-900 hover:bg-slate-800">
                <Link to={projectsRoute}>
                  {billingExperience.primaryCtaLabel}
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
                <Link to={contractsRoute}>
                  {billingExperience.secondaryCtaLabel}
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => loadBillingData(true)}
                className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              >
                {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="space-y-4 p-6 md:p-7">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                  {billingExperience.summaryEyebrow}
                </p>
                <p className="mt-3 max-w-[12ch] break-words text-2xl font-semibold leading-tight text-slate-950">
                  {isClient
                    ? fundingVaultReady
                      ? "Vault ready"
                      : savedFundingBuyerEmail
                        ? "Saved checkout buyer"
                        : billingExperience.summaryEmptyTitle
                    : latestTransaction
                      ? describeTransaction(latestTransaction)
                      : billingExperience.summaryEmptyTitle}
                </p>
              </div>
              {isClient && preferredFundingMethod ? (
                <div className="flex w-fit shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700">
                  <PayPalLogo compact decorative />
                  PayPal
                </div>
              ) : (
                <Badge className="w-fit shrink-0 border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-100">
                  {isClient
                    ? preferredFundingMethod
                      ? "PayPal"
                      : billingExperience.summaryModeBadge
                    : billingExperience.summaryModeBadge}
                </Badge>
              )}
            </div>

            {isClient ? (
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="min-w-0 break-words text-sm font-medium text-slate-900">
                    {fundingVaultReady
                      ? "Faster checkout is ready"
                    : savedFundingBuyerEmail
                        ? `Saved buyer: ${savedFundingBuyerEmail}`
                        : "Start funding from a milestone"}
                  </p>
                  <Badge className="w-fit shrink-0 border-slate-200 bg-white text-slate-700 hover:bg-white">
                    {describeWalletStatus(wallet.status)}
                  </Badge>
                </div>
                <p className="max-w-[34ch] break-words text-sm leading-6 text-slate-600">
                  {fundingVaultReady
                    ? savedFundingBuyerEmail
                      ? `${savedFundingBuyerEmail} can be reused for faster approval from the milestone workspace.`
                      : "PayPal Vault is ready for the next milestone checkout."
                    : savedFundingBuyerEmail
                      ? `${savedFundingBuyerEmail} was captured from the latest approved checkout.`
                      : "Open a milestone and start PayPal checkout there."}
                </p>
              </div>
            ) : (
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="min-w-0 break-words text-sm font-medium text-slate-900">
                    {latestTransaction
                      ? describeTransactionContext(latestTransaction)
                      : "Waiting for the next release"}
                  </p>
                  <Badge className="w-fit shrink-0 border-slate-200 bg-white text-slate-700 hover:bg-white">
                    {describeWalletStatus(wallet.status)}
                  </Badge>
                </div>
                <p className="max-w-[34ch] break-words text-sm leading-6 text-slate-600">
                  {latestTransaction
                    ? `${describeTransactionSource(latestTransaction)} · posted ${formatRelativeTime(latestTransaction.createdAt)}`
                    : "This wallet updates automatically when a funded milestone is released."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {error && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      )}

      {isClient && safeReturnTo ? (
        <section>
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-950">
                  Return to the milestone to fund it
                </p>
                <p className="text-sm text-slate-600">
                  {preferredFundingMethod?.fastCheckoutReady
                    ? "PayPal Vault is ready for this buyer. Funding still happens from the milestone workspace."
                    : "PayPal checkout starts from the milestone workspace. The first approved checkout can be reused faster next time."}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild className="bg-slate-900 hover:bg-slate-800">
                  <Link to={safeReturnTo || projectsRoute}>
                    {safeReturnTo ? "Back to milestone" : "Open projects"}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <Card key={stat.id} className="border-slate-200 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                      {stat.label}
                    </p>
                    <p className="break-words text-[1.75rem] font-semibold leading-tight tracking-tight text-slate-950 sm:text-2xl">
                      {stat.value}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <Icon className="h-5 w-5 text-slate-700" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      {isClient ? (
        <section>
          <Card className="overflow-hidden border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 bg-slate-50/70">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-xl font-semibold text-slate-950">
                    PayPal checkout
                  </CardTitle>
                  <CardDescription className="mt-1 text-sm text-slate-600">
                    Funding starts inside each milestone. Billing stays focused on escrow history and wallet activity.
                  </CardDescription>
                </div>
                <Badge className="border-slate-200 bg-white text-slate-700 hover:bg-white">
                  {fundingVaultReady
                    ? "Vault ready"
                    : savedFundingBuyerEmail
                      ? "Saved buyer"
                      : "PayPal only"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                    Funding rail
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <PayPalLogo className="h-6" />
                    </div>
                    <p className="text-sm font-semibold text-slate-950">PayPal checkout</p>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    Card can still appear inside PayPal when the sandbox buyer is eligible.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                    Saved buyer
                  </p>
                  <p className="mt-3 break-all text-sm font-semibold text-slate-950">
                    {savedFundingBuyerEmail ?? "No saved buyer yet"}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {savedFundingBuyerEmail
                      ? "Captured after a successful approved checkout."
                      : "The first approved PayPal checkout will populate this automatically."}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                    Checkout status
                  </p>
                  <p className="mt-3 text-sm font-semibold text-slate-950">
                    {fundingVaultReady
                      ? "Vault ready"
                      : savedFundingBuyerEmail
                        ? "Buyer captured"
                        : "First checkout pending"}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {fundingVaultReady
                      ? savedFundingBuyerEmail
                        ? `${savedFundingBuyerEmail} can be reused for faster PayPal approval on the next milestone.`
                        : "PayPal can reuse the last approved buyer for faster approval on the next milestone."
                      : "Funding still begins from the milestone workspace, not from this billing page."}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">
                    Funding now lives in the milestone workspace
                  </p>
                  <p className="text-sm leading-6 text-slate-600">
                    Use Pay with PayPal on the milestone card, then come back here to review held balance, releases, and refunds.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {hasSavedFundingBuyer && preferredFundingMethod ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setFundingMethodPendingReset(preferredFundingMethod)}
                      className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    >
                      Forget saved buyer
                    </Button>
                  ) : null}
                  {safeReturnTo ? (
                    <Button asChild variant="outline" className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
                      <Link to={safeReturnTo}>Back to milestone</Link>
                    </Button>
                  ) : null}
                  <Button asChild className="bg-slate-900 hover:bg-slate-800">
                    <Link to={projectsRoute}>Open projects</Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      ) : null}

      <div className="space-y-6">
        {isClient ? (
          <section>
            <Card className="border-amber-200 bg-amber-50/70 shadow-sm">
              <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-amber-950">Refund payout after verdict</p>
                  <p className="text-sm leading-6 text-amber-900/80">
                    Refunds from a dispute do not go straight back to PayPal. They settle into your wallet first, then become withdrawable after the appeal window closes or both parties explicitly accept the verdict.
                  </p>
                </div>
                <Badge className="w-fit border-amber-200 bg-white text-amber-800 hover:bg-white">
                  {formatCurrency(wallet.availableBalance, wallet.currency)} withdrawable
                </Badge>
              </CardContent>
            </Card>
          </section>
        ) : null}

          <section className="grid gap-6 xl:grid-cols-[1.15fr_0.95fr]">
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
                    {payoutMethodCount} PayPal {payoutMethodCount === 1 ? "email" : "emails"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                {cashoutEligibleMethods.length === 0 ? (
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
                    {cashoutEligibleMethods.map((method) => (
                      <PayoutMethodCard
                        key={method.id}
                        method={method}
                        settingDefaultId={settingDefaultPayoutId}
                        deletingMethodId={deletingPayoutMethodId}
                        onSetDefault={handleSetDefaultPayoutMethod}
                        onEdit={handleEditPayoutMethod}
                        onDelete={setPayoutMethodPendingDelete}
                      />
                    ))}
                  </div>
                )}
                {hiddenPayoutMethods.length > 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    Bank payout stays out of the live flow for now. InterDev is sending cashouts through PayPal only in this phase.
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-100 bg-slate-50/70">
                <CardTitle className="text-xl font-semibold text-slate-950">
                  {editingPayoutMethod ? "Edit PayPal payout" : billingExperience.addMethodTitle}
                </CardTitle>
                <CardDescription className="text-sm text-slate-600">
                  {editingPayoutMethod
                    ? "Update the saved payout destination below."
                    : billingExperience.addMethodDescription}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {editingPayoutMethod ? (
                  <Badge className="mb-4 border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-100">
                    Editing {describePayoutMethod(editingPayoutMethod)}
                  </Badge>
                ) : null}

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                      <PayPalLogo compact decorative className="h-5" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-900">Saved PayPal payout email</p>
                      <p className="text-sm leading-6 text-slate-600">
                        {billingExperience.roleCardDescription}
                      </p>
                    </div>
                  </div>
                </div>

                <Form {...payoutMethodForm}>
                  <form className="mt-5 space-y-5" onSubmit={handleSubmitPayoutMethod} noValidate>
                    {payoutMethodSubmitError ? (
                      <div
                        className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
                        role="alert"
                      >
                        {payoutMethodSubmitError}
                      </div>
                    ) : null}

                    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField
                          control={payoutMethodForm.control}
                          name="displayName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-slate-800">Label</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  autoComplete="off"
                                  placeholder="Primary cashout PayPal"
                                  onChange={(event) => {
                                    setPayoutMethodSubmitError(null);
                                    field.onChange(event.target.value);
                                  }}
                                />
                              </FormControl>
                              <FormDescription>Optional. This label only appears inside the app.</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-900">PayPal destination</p>
                        <p className="text-sm text-slate-500">
                          Save the PayPal email that should receive available cashouts from your wallet.
                        </p>
                      </div>

                      <FormField
                        control={payoutMethodForm.control}
                        name="paypalEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-800">PayPal email</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                autoComplete="email"
                                inputMode="email"
                                placeholder="cashout@example.com"
                                onChange={(event) => {
                                  setPayoutMethodSubmitError(null);
                                  field.onChange(event.target.value);
                                }}
                              />
                            </FormControl>
                            <FormDescription>
                              This is the PayPal account InterDev sends cashouts to.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={payoutMethodForm.control}
                        name="isDefault"
                        render={({ field }) => (
                          <FormItem className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <div className="flex items-start gap-3">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={(checked) => {
                                    setPayoutMethodSubmitError(null);
                                    field.onChange(Boolean(checked));
                                  }}
                                  disabled={Boolean(editingPayoutMethod?.isDefault)}
                                  className="mt-0.5"
                                />
                              </FormControl>
                              <div className="space-y-1">
                                <FormLabel className="text-sm font-medium text-slate-700">
                                  Use this as the primary PayPal payout email
                                </FormLabel>
                                <FormDescription className="text-xs leading-5 text-slate-500">
                                  This PayPal email will be preselected for cashout requests.
                                  {editingPayoutMethod?.isDefault
                                    ? " Choose another method as default first if you want to change it."
                                    : ""}
                                </FormDescription>
                              </div>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        type="submit"
                        disabled={savingPayoutMethod}
                        className="bg-slate-900 px-5 hover:bg-slate-800"
                      >
                        {savingPayoutMethod ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        {editingPayoutMethod ? "Save changes" : "Save PayPal email"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={resetPayoutMethodForm}
                        className="border-slate-200"
                      >
                        {editingPayoutMethod ? "Cancel edit" : "Clear form"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-100 bg-slate-50/70">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl font-semibold text-slate-950">
                      Request cashout
                    </CardTitle>
                    <CardDescription className="mt-1 text-sm text-slate-600">
                      Move available wallet funds to a saved PayPal payout email.
                    </CardDescription>
                  </div>
                  <Badge className="border-slate-200 bg-white text-slate-700 hover:bg-white">
                    {formatCurrency(wallet.availableBalance, wallet.currency)} available
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 pt-6">
                {cashoutEligibleMethods.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
                    <p className="text-base font-medium text-slate-900">Add a PayPal payout email first</p>
                    <p className="mt-2 text-sm text-slate-500">
                      Save a PayPal email above, then submit your first cashout request here.
                    </p>
                  </div>
                ) : null}

                <Form {...cashoutRequestForm}>
                  <form className="space-y-5" onSubmit={handleSubmitCashout} noValidate>
                    {cashoutSubmitError ? (
                      <div
                        className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
                        role="alert"
                      >
                        {cashoutSubmitError}
                      </div>
                    ) : null}

                    {cashoutEligibleMethods.length > 1 ? (
                      <FormField
                        control={cashoutRequestForm.control}
                        name="payoutMethodId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-800">PayPal payout email</FormLabel>
                            <Select
                              value={field.value}
                              onValueChange={(value) => {
                                setCashoutSubmitError(null);
                                field.onChange(value);
                              }}
                              disabled={cashoutEligibleMethods.length === 0}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Choose a PayPal payout email" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {cashoutEligibleMethods.map((method) => (
                                  <SelectItem key={method.id} value={method.id}>
                                    {describePayoutMethod(method)} · {describePayoutAccount(method)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : selectedCashoutMethod ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                          PayPal payout email
                        </p>
                        <p className="mt-2 text-sm font-semibold text-slate-950">
                          {describePayoutMethod(selectedCashoutMethod)}
                        </p>
                        <p className="mt-1 break-words text-sm text-slate-600">
                          {describePayoutAccount(selectedCashoutMethod)}
                        </p>
                      </div>
                    ) : null}

                    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
                      <FormField
                        control={cashoutRequestForm.control}
                        name="amount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-800">Amount</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="number"
                                min="0"
                                step="0.01"
                                inputMode="decimal"
                                placeholder="1000"
                                onChange={(event) => {
                                  setCashoutSubmitError(null);
                                  field.onChange(event.target.value);
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={cashoutRequestForm.control}
                        name="note"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-800">Note</FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                rows={4}
                                placeholder="Payroll run, milestone release, or month-end cashout"
                                onChange={(event) => {
                                  setCashoutSubmitError(null);
                                  field.onChange(event.target.value);
                                }}
                              />
                            </FormControl>
                            <FormDescription>Optional. Keep it short and clear.</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-slate-900">Fee preview</p>
                          <p className="text-sm text-slate-600">
                            {cashoutQuoteLoading
                              ? "Calculating quote..."
                              : selectedCashoutMethod
                                ? `Preview for ${describePayoutMethod(selectedCashoutMethod)}`
                                : "Select a PayPal payout email to see a quote."}
                          </p>
                        </div>
                        <Badge
                          className={`${describeCashoutRailBadge(cashoutQuote).className} hover:bg-inherit`}
                        >
                          {cashoutQuote
                            ? describeCashoutRailBadge(cashoutQuote).label
                            : "Pending quote"}
                        </Badge>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-xl border border-white bg-white p-4 shadow-sm">
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Amount</p>
                          <p className="mt-2 text-lg font-semibold text-slate-950">
                            {formatAmountPreview(Number(watchedCashoutAmount) || 0, wallet.currency)}
                          </p>
                        </div>
                        <div className="rounded-xl border border-white bg-white p-4 shadow-sm">
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Fee</p>
                          <p className="mt-2 text-lg font-semibold text-slate-950">
                            {formatAmountPreview(cashoutQuote?.fee ?? 0, cashoutQuote?.currency ?? wallet.currency)}
                          </p>
                        </div>
                        <div className="rounded-xl border border-white bg-white p-4 shadow-sm">
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">You receive</p>
                          <p className="mt-2 text-lg font-semibold text-slate-950">
                            {formatAmountPreview(cashoutQuote?.netAmount ?? 0, cashoutQuote?.currency ?? wallet.currency)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Available balance</p>
                          <p className="mt-2 text-sm font-medium text-slate-900">
                            {formatAmountPreview(wallet.availableBalance, wallet.currency)}
                          </p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Net after fee</p>
                          <p className="mt-2 text-sm font-medium text-slate-900">
                            {cashoutQuote
                              ? formatAmountPreview(cashoutQuote.netAmount, cashoutQuote.currency)
                              : "Enter an amount to preview"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                        {cashoutQuote
                          ? cashoutQuote.processingDescription
                          : "Quotes will also tell you whether this runtime is sending cashouts through PayPal Payouts or sandbox fallback."}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        type="submit"
                        disabled={requestingCashout || cashoutEligibleMethods.length === 0 || !hasAvailableCashoutBalance}
                        className="bg-slate-900 px-5 hover:bg-slate-800"
                      >
                        {requestingCashout ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Request cashout
                      </Button>
                      <p className="text-sm text-slate-500">
                        {hasAvailableCashoutBalance
                          ? "Cashouts are checked against wallet balance first. The quote and history below will show whether this runtime used PayPal Payouts or sandbox fallback."
                          : "Cashout stays disabled until the wallet has a positive available balance."}
                      </p>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-100 bg-slate-50/70">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl font-semibold text-slate-950">
                      Cashout history
                    </CardTitle>
                    <CardDescription className="mt-1 text-sm text-slate-600">
                      Track payout requests, fees, and processing status.
                    </CardDescription>
                  </div>
                  <Badge className="border-slate-200 bg-white text-slate-700 hover:bg-white">
                    {payoutRequests.length} of {payoutRequestsTotal}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {payoutRequests.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
                      <WalletCards className="h-5 w-5 text-slate-700" />
                    </div>
                    <p className="mt-4 text-base font-medium text-slate-900">
                      No cashout requests yet
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      Your approved withdrawals will appear here with fee and net amount details.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      {payoutRequests.map((request) => {
                        const tone = payoutToneMap[request.status] ?? payoutToneMap.PENDING;
                        const method = request.payoutMethod;
                        const usedSandboxFallback = isSandboxFallbackCashout(request);

                        return (
                          <div
                            key={request.id}
                            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge className={tone.badgeClassName}>{tone.label}</Badge>
                                  {request.status === "COMPLETED" ? (
                                    <Badge
                                      className={
                                        usedSandboxFallback
                                          ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50"
                                          : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
                                      }
                                    >
                                      {usedSandboxFallback ? "Sandbox fallback" : "PayPal Payouts"}
                                    </Badge>
                                  ) : null}
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-slate-950">
                                    {formatAmountPreview(request.amount, request.currency)}
                                  </p>
                                  <p className="text-sm text-slate-500">
                                    {method ? describePayoutMethod(method) : "PayPal payout"} · {describePayoutStatus(request.status)}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className={`text-sm font-semibold ${tone.amountClassName}`}>
                                  Net {formatAmountPreview(request.netAmount, request.currency)}
                                </p>
                                <p className="text-xs text-slate-400">
                                  Fee {formatAmountPreview(request.fee, request.currency)}
                                </p>
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                              <span>Requested {formatRelativeTime(request.requestedAt)}</span>
                              {request.externalReference ? <span>Ref {request.externalReference}</span> : null}
                              {request.note ? <span>{request.note}</span> : null}
                            </div>
                            {request.adminNote || request.failureReason ? (
                              <div
                                className={`mt-3 rounded-xl border px-3 py-2 text-sm ${
                                  request.failureReason
                                    ? "border-rose-200 bg-rose-50 text-rose-700"
                                    : usedSandboxFallback
                                      ? "border-amber-200 bg-amber-50 text-amber-700"
                                      : "border-slate-200 bg-slate-50 text-slate-600"
                                }`}
                              >
                                {request.failureReason ?? request.adminNote}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                    {payoutRequests.length < payoutRequestsTotal ? (
                      <div className="mt-4 flex justify-center">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleLoadMorePayoutRequests}
                          className="border-slate-200"
                        >
                          Load more cashouts
                        </Button>
                      </div>
                    ) : null}
                  </>
                )}
              </CardContent>
            </Card>
          </section>
      </div>

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
              {transactions.length} of {transactionsTotal} transactions
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
            <>
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Movement
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Source
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
                        const movementTitle = isClient
                          ? describeClientTransaction(transaction)
                          : describeTransaction(transaction);
                        const movementContext = isClient
                          ? describeClientTransactionContext(transaction)
                          : describeTransactionContext(transaction);
                        const movementBadgeLabel = isClient
                          ? describeClientTransactionBadge(transaction)
                          : tone.label;

                        return (
                          <tr key={transaction.id} className="hover:bg-slate-50/70">
                            <td className="px-4 py-4 align-top">
                              <div className="space-y-2">
                                <Badge className={tone.badgeClassName}>
                                  {movementBadgeLabel}
                                </Badge>
                                <div className="min-w-0">
                                  <p className="break-words text-sm font-medium text-slate-900">
                                    {movementTitle}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {describeTransactionStatus(transaction.status)} · {formatRelativeTime(transaction.createdAt)}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 align-top">
                              <div className="space-y-1 text-sm text-slate-600">
                                <p className="break-words">{describeTransactionSource(transaction)}</p>
                                <p className="break-words text-xs text-slate-400">
                                  {movementContext}
                                </p>
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
              {hasMoreTransactions ? (
                <div className="mt-4 flex justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleLoadMoreTransactions}
                    disabled={loadingMoreTransactions}
                    className="border-slate-200"
                  >
                    {loadingMoreTransactions ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Load more
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={Boolean(fundingMethodPendingReset)}
        onOpenChange={(open) => {
          if (!open && !resettingFundingMethodId) {
            setFundingMethodPendingReset(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Forget saved PayPal buyer?</AlertDialogTitle>
            <AlertDialogDescription>
              {fundingMethodPendingReset?.paypalEmail
                ? `This clears "${fundingMethodPendingReset.paypalEmail}" from faster checkout and resets Vault for the next funding flow.`
                : "This clears the saved buyer from faster checkout and resets Vault for the next funding flow."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(resettingFundingMethodId)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetFundingMethod}
              disabled={Boolean(resettingFundingMethodId)}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {resettingFundingMethodId ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Forget buyer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(payoutMethodPendingDelete)}
        onOpenChange={(open) => {
          if (!open && !deletingPayoutMethodId) {
            setPayoutMethodPendingDelete(null);
          }
        }}
      >
      <AlertDialogContent>
        <AlertDialogHeader>
            <AlertDialogTitle>Delete PayPal payout email?</AlertDialogTitle>
            <AlertDialogDescription>
              {payoutMethodPendingDelete
                ? `Remove "${describePayoutMethod(payoutMethodPendingDelete)}" from your saved PayPal payout emails.`
                : "Remove this saved PayPal payout email."}
            </AlertDialogDescription>
        </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingPayoutMethodId)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePayoutMethod}
              disabled={Boolean(deletingPayoutMethodId)}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {deletingPayoutMethodId ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PayoutMethodCard({
  method,
  settingDefaultId,
  deletingMethodId,
  onSetDefault,
  onEdit,
  onDelete,
}: {
  method: PayoutMethodView;
  settingDefaultId: string | null;
  deletingMethodId: string | null;
  onSetDefault: (methodId: string) => void;
  onEdit: (method: PayoutMethodView) => void;
  onDelete: (method: PayoutMethodView) => void;
}) {
  const isUpdating = settingDefaultId === method.id;
  const isDeleting = deletingMethodId === method.id;
  const isPayPal = method.type === "PAYPAL_EMAIL";

  return (
    <div
      className={`rounded-xl border p-4 transition ${
        method.isDefault
          ? "border-slate-300 bg-slate-50"
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            {isPayPal ? (
              <PayPalLogo compact decorative />
            ) : (
              <Landmark className="h-5 w-5 text-slate-700" />
            )}
          </div>
          <div className="min-w-0 space-y-1">
            <p className="break-words font-semibold text-slate-950">
              {describePayoutMethod(method)}
            </p>
            <p className="break-words text-sm text-slate-500">
              {describePayoutAccount(method)}
            </p>
            <p className="text-xs text-slate-400">
              {isPayPal
                ? method.isVerified
                  ? "Verified PayPal cashout destination"
                  : "Saved PayPal cashout destination"
                : method.isVerified
                  ? "Verified bank payout destination"
                  : "Saved bank payout destination"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {method.isDefault ? (
            <Badge className="w-fit shrink-0 border-slate-300 bg-white text-slate-700 hover:bg-white">
              {isPayPal ? "Primary cashout" : "Primary payout"}
            </Badge>
          ) : null}
          {!isPayPal ? (
            <Badge className="w-fit shrink-0 border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-100">
              Saved for later
            </Badge>
          ) : null}
          {method.isVerified ? (
            <Badge className="w-fit shrink-0 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
              Verified
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
          Added {formatRelativeTime(method.createdAt)}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(method)}
            disabled={isUpdating || isDeleting}
            className="text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            <PencilLine className="h-4 w-4" />
            Edit
          </Button>
          {!method.isDefault ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSetDefault(method.id)}
              disabled={isUpdating || isDeleting}
              className="border-slate-200"
            >
              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Set primary
            </Button>
          ) : null}
          {method.canDelete ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(method)}
              disabled={isUpdating || isDeleting}
              className="text-slate-500 hover:bg-rose-50 hover:text-rose-600"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Remove
            </Button>
          ) : (
            <span className="max-w-full break-words text-xs text-slate-500 sm:max-w-[220px]">
              Removal disabled because this PayPal payout email already has linked requests.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
