import { useEffect, useState } from "react";
import { Loader2, TrendingUp, Wallet } from "lucide-react";
import { getAdminDashboardOverview } from "@/features/dashboard/admin.api";
import type { AdminDashboardOverview, DashboardRange } from "@/features/dashboard/admin.types";
import {
  getPlatformWalletSnapshot,
  getPlatformWalletTransactions,
} from "@/features/payments/api";
import type {
  PlatformWalletSnapshotResult,
  PlatformWalletTransactionsResult,
  TransactionStatus,
  WalletTransaction,
} from "@/features/payments/types";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui";
import { formatCurrency, formatRelativeTime } from "@/shared/utils/formatters";

const rangeOptions: Array<{ value: DashboardRange; label: string }> = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
];

const statusTone: Record<TransactionStatus, string> = {
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  PROCESSING: "bg-sky-50 text-sky-700 border-sky-200",
  FAILED: "bg-rose-50 text-rose-700 border-rose-200",
  CANCELLED: "bg-slate-100 text-slate-700 border-slate-200",
};

function describeTransactionType(transaction: WalletTransaction): string {
  const type = transaction.type;
  if (isGatewayFeeTransaction(transaction)) {
    return "PayPal processing fee";
  }
  if (isFundingInflow(transaction)) {
    return "Escrow funding in";
  }

  switch (type) {
    case "FEE_DEDUCTION":
      return "Platform fee";
    case "WITHDRAWAL":
      return "PayPal payout mirror";
    case "REFUND":
      return "Refund";
    case "ESCROW_RELEASE":
      return "Escrow release";
    case "ESCROW_HOLD":
      return "Escrow hold";
    case "DEPOSIT":
      return "Funding in";
    default:
      return type;
  }
}

function isGatewayFeeTransaction(transaction: WalletTransaction): boolean {
  return transaction.metadata?.stage === "gateway_fee";
}

function isProviderOutflow(transaction: WalletTransaction): boolean {
  return transaction.metadata?.mirroredProviderOutflow === true;
}

function isFundingInflow(transaction: WalletTransaction): boolean {
  return transaction.metadata?.mirroredFundingInflow === true;
}

function describeTransactionNote(transaction: WalletTransaction): string {
  if (isGatewayFeeTransaction(transaction)) {
    return transaction.description || "PayPal processing fee absorbed by the platform";
  }

  if (isFundingInflow(transaction)) {
    const payer =
      typeof transaction.metadata?.payerEmail === "string" ? transaction.metadata.payerEmail : null;
    return payer
      ? `Client funding captured from ${payer} and locked into escrow`
      : transaction.description || "Client funding captured and locked into escrow";
  }

  if (transaction.metadata?.mirroredProviderOutflow) {
    const recipient =
      typeof transaction.metadata.recipientPaypalEmail === "string"
        ? transaction.metadata.recipientPaypalEmail
        : null;
    return recipient
      ? `Cashout sent to ${recipient}`
      : "Cashout sent from the PayPal merchant account";
  }

  if (transaction.description) {
    return transaction.description;
  }

  if (transaction.referenceType === "Escrow") {
    return "Milestone escrow movement";
  }

  if (transaction.referenceType === "PayoutRequest") {
    return "Cashout routed from the treasury wallet";
  }

  return "Treasury wallet movement";
}

function describeActivitySource(transaction: WalletTransaction): string {
  if (isGatewayFeeTransaction(transaction)) {
    return "PayPal";
  }

  if (isFundingInflow(transaction)) {
    return "Escrow funding";
  }

  if (transaction.metadata?.mirroredProviderOutflow) {
    return transaction.metadata.sandboxFallback === true ? "Sandbox mirror" : "PayPal mirror";
  }

  if (transaction.referenceType === "Escrow") {
    return "Escrow";
  }

  if (transaction.referenceType === "PayoutRequest") {
    return "Cashout";
  }

  return "Internal ledger";
}

function describeActivityAmount(transaction: WalletTransaction): string {
  const formatted = formatCurrency(transaction.amount, transaction.currency);
  if (isGatewayFeeTransaction(transaction) || isProviderOutflow(transaction)) {
    return `-${formatted}`;
  }
  return formatted;
}

function MetricCard({
  title,
  value,
  helper,
  icon: Icon,
}: {
  title: string;
  value: string;
  helper: string;
  icon: typeof Wallet;
}) {
  return (
    <Card className="border-slate-200">
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0 space-y-1">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">{title}</p>
          <p className="break-words text-2xl font-semibold text-slate-950">{value}</p>
          <p className="text-sm leading-6 text-slate-600">{helper}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <Icon className="h-5 w-5 text-slate-700" />
        </div>
      </CardContent>
    </Card>
  );
}

function describeFinanceMetricTitle(range: DashboardRange): string {
  if (range === "7d") return "7D Gross Fees";
  if (range === "90d") return "90D Gross Fees";
  return "30D Gross Fees";
}

export default function AdminFinancePage() {
  const [range, setRange] = useState<DashboardRange>("30d");
  const [overview, setOverview] = useState<AdminDashboardOverview | null>(null);
  const [platformWallet, setPlatformWallet] = useState<PlatformWalletSnapshotResult | null>(null);
  const [transactions, setTransactions] =
    useState<PlatformWalletTransactionsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const [nextOverview, nextWallet, nextTransactions] = await Promise.all([
          getAdminDashboardOverview(range),
          getPlatformWalletSnapshot(),
          getPlatformWalletTransactions(1, 12, range),
        ]);

        if (cancelled) {
          return;
        }

        setOverview(nextOverview);
        setPlatformWallet(nextWallet);
        setTransactions(nextTransactions);
      } catch (err) {
        if (cancelled) {
          return;
        }

        setError(err instanceof Error ? err.message : "Unable to load platform finance.");
        setOverview(null);
        setPlatformWallet(null);
        setTransactions(null);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [range]);

  const handleLoadMore = async () => {
    if (!transactions || loadingMore) {
      return;
    }

    try {
      setLoadingMore(true);
      const nextPage = transactions.page + 1;
      const next = await getPlatformWalletTransactions(nextPage, transactions.limit, range);
      setTransactions((current) =>
        current
          ? {
              ...next,
              items: [...current.items, ...next.items],
            }
          : next,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load more treasury activity.");
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center rounded-[2rem] border border-slate-200 bg-white">
        <Loader2 className="mr-3 h-6 w-6 animate-spin text-slate-700" />
        <span className="text-sm text-slate-600">Loading platform finance...</span>
      </div>
    );
  }

  if (error || !overview || !platformWallet || !transactions) {
    return (
      <Card className="border-rose-200 bg-rose-50">
        <CardHeader>
          <CardTitle className="text-rose-900">Finance unavailable</CardTitle>
          <CardDescription className="text-rose-700">
            {error || "Platform finance could not be loaded."}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const treasuryWallet = platformWallet.wallet;
  const treasuryOwner = platformWallet.owner;
  const hasMore = transactions.items.length < transactions.total;

  return (
    <div className="space-y-6 pb-8">
      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(191,219,254,0.45),_transparent_35%),linear-gradient(135deg,_#ffffff,_#f8fafc_55%,_#eef2ff)]">
        <div className="space-y-5 p-6 xl:p-8">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-2xl space-y-3">
              <Badge className="border-0 bg-slate-900 text-white">Platform finance</Badge>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Platform Finance</h1>
                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
                  Internal fee ledger and payout mirrors across the platform.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {rangeOptions.map((option) => (
                <Button
                  key={option.value}
                  variant={range === option.value ? "default" : "outline"}
                  onClick={() => setRange(option.value)}
                  className={range === option.value ? "bg-slate-900 text-white" : "bg-white"}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              title={describeFinanceMetricTitle(range)}
              value={formatCurrency(overview.summary.revenue.value, "USD")}
              helper={`Released platform fees before provider costs. ${overview.summary.revenue.delta >= 0 ? "+" : ""}${overview.summary.revenue.delta.toFixed(2)}% vs previous window`}
              icon={TrendingUp}
            />
            <MetricCard
              title="Internal Fee Balance"
              value={formatCurrency(treasuryWallet.availableBalance, treasuryWallet.currency)}
              helper="Net platform balance after recorded provider fees."
              icon={Wallet}
            />
            <MetricCard
              title="Lifetime Platform Fees"
              value={formatCurrency(treasuryWallet.totalEarned, treasuryWallet.currency)}
              helper="Gross platform fee credits earned by the platform."
              icon={Wallet}
            />
          </div>
        </div>
      </section>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-slate-950">Internal ledger</CardTitle>
          <CardDescription>Gross platform fees minus recorded provider costs.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Owner</p>
              <p className="mt-2 text-base font-semibold text-slate-950">{treasuryOwner.fullName}</p>
              <p className="break-all text-sm text-slate-600">{treasuryOwner.email}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Wallet status</p>
              <p className="mt-2 text-base font-semibold text-slate-950">{treasuryWallet.status}</p>
              <p className="text-sm text-slate-600">Updated {formatRelativeTime(treasuryWallet.updatedAt)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Held</p>
              <p className="mt-2 text-base font-semibold text-slate-950">
                {formatCurrency(treasuryWallet.heldBalance, treasuryWallet.currency)}
              </p>
              <p className="text-sm text-slate-600">Usually zero right now.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-slate-950">Recent activity</CardTitle>
          <CardDescription>Escrow funding in, provider fee, platform fee, and payout activity in the selected window.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {transactions.items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
              No finance activity in this window.
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.items.map((transaction) => (
                <div
                  key={transaction.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-950">
                          {describeTransactionType(transaction)}
                        </p>
                        <Badge
                          className={`border ${statusTone[transaction.status] ?? "border-slate-200 bg-slate-100 text-slate-700"}`}
                        >
                          {transaction.status}
                        </Badge>
                        <Badge className="border border-slate-200 bg-slate-50 text-slate-700">
                          {describeActivitySource(transaction)}
                        </Badge>
                      </div>
                      <p className="max-w-3xl break-words text-sm leading-6 text-slate-600">
                        {describeTransactionNote(transaction)}
                      </p>
                    </div>
                    <div className="shrink-0 text-left sm:text-right">
                      <p className="text-lg font-semibold text-slate-950">
                        {describeActivityAmount(transaction)}
                      </p>
                      <p className="text-sm text-slate-500">
                        {formatRelativeTime(transaction.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
                    <p>
                      After{" "}
                      {transaction.metadata?.informationalOnly
                        ? "internal ledger unchanged"
                        : transaction.balanceAfter === null
                          ? "—"
                          : formatCurrency(transaction.balanceAfter, transaction.currency)}
                    </p>
                    {transaction.externalTransactionId ? (
                      <p className="break-all">Ref {transaction.externalTransactionId}</p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}

          {hasMore ? (
            <div className="flex justify-end">
              <Button variant="outline" onClick={handleLoadMore} disabled={loadingMore}>
                {loadingMore ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading more
                  </>
                ) : (
                  "Load more activity"
                )}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
