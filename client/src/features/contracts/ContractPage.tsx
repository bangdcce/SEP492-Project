import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArchiveX,
  ArrowRight,
  Briefcase,
  CheckCircle,
  Clock3,
  Download,
  Eye,
  FileSignature,
  Lock,
  Receipt,
  ScrollText,
  ShieldCheck,
  Users,
  WalletCards,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/shared/components/ui/alert";
import { Badge } from "@/shared/components/ui/badge";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Label } from "@/shared/components/ui/label";
import Spinner from "@/shared/components/ui/spinner";
import { STORAGE_KEYS } from "@/constants";
import { useToast } from "@/shared/hooks/use-toast";
import { connectSocket } from "@/shared/realtime/socket";
import { getStoredJson } from "@/shared/utils/storage";
import { contractsApi } from "./api";
import type { Contract, ContractMilestoneSnapshotItem } from "./types";
import {
  normalizeSupportedBillingRole,
  resolveBillingLabel,
  resolveBillingRoute,
} from "@/features/payments/roleRoutes";
import {
  SpecNarrativeRenderer,
  narrativeHasContent,
} from "@/shared/components/rich-text/SpecNarrative";

type AgreementBlock = {
  kind:
    | "h1"
    | "h2"
    | "h3"
    | "label"
    | "bullet"
    | "ordered"
    | "task"
    | "quote"
    | "divider"
    | "paragraph";
  text?: string;
  indent?: number;
  order?: number;
  checked?: boolean;
};

const stripTermsPresentationMarkers = (line: string) =>
  line.replace(/\*\*(.*?)\*\*/g, "$1").trim();

const parseAgreementTerms = (termsContent: string): AgreementBlock[] => {
  if (!termsContent.trim()) {
    return [{ kind: "paragraph", text: "No agreement text available." }];
  }

  const blocks: AgreementBlock[] = [];
  const paragraphBuffer: string[] = [];
  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) {
      return;
    }

    blocks.push({
      kind: "paragraph",
      text: paragraphBuffer.join(" "),
    });
    paragraphBuffer.length = 0;
  };

  for (const rawLine of termsContent.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      const markerLength = headingMatch[1].length;
      blocks.push({
        kind: markerLength === 1 ? "h1" : markerLength === 2 ? "h2" : "h3",
        text: stripTermsPresentationMarkers(headingMatch[2]),
      });
      continue;
    }

    const taskMatch = line.match(/^(\s*)-\s+\[(x|X| )\]\s+(.+)$/);
    if (taskMatch) {
      flushParagraph();
      blocks.push({
        kind: "task",
        text: stripTermsPresentationMarkers(taskMatch[3]),
        checked: taskMatch[2].toLowerCase() === "x",
        indent: taskMatch[1].length >= 2 ? 1 : 0,
      });
      continue;
    }

    const orderedMatch = line.match(/^(\s*)(\d+)\.\s+(.+)$/);
    if (orderedMatch) {
      flushParagraph();
      blocks.push({
        kind: "ordered",
        text: stripTermsPresentationMarkers(orderedMatch[3]),
        order: Number(orderedMatch[2]),
        indent: orderedMatch[1].length >= 2 ? 1 : 0,
      });
      continue;
    }

    const bulletMatch = line.match(/^(\s*)-\s+(.+)$/);
    if (bulletMatch) {
      flushParagraph();
      blocks.push({
        kind: "bullet",
        text: stripTermsPresentationMarkers(bulletMatch[2]),
        indent: bulletMatch[1].length >= 2 ? 1 : 0,
      });
      continue;
    }

    const quoteMatch = trimmed.match(/^>\s+(.+)$/);
    if (quoteMatch) {
      flushParagraph();
      blocks.push({
        kind: "quote",
        text: stripTermsPresentationMarkers(quoteMatch[1]),
      });
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      flushParagraph();
      blocks.push({
        kind: "divider",
      });
      continue;
    }

    const labelMatch = trimmed.match(/^\*\*(.+?)\*\*:?\s*$/);
    if (labelMatch) {
      flushParagraph();
      blocks.push({
        kind: "label",
        text: stripTermsPresentationMarkers(labelMatch[1]),
      });
      continue;
    }

    paragraphBuffer.push(stripTermsPresentationMarkers(trimmed));
  }

  flushParagraph();
  return blocks;
};

const formatMoney = (amount: number | null | undefined, currency?: string | null) =>
  `${Number(amount || 0).toFixed(2)} ${(currency || "USD").toUpperCase()}`;

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString() : "Not set";

const formatDateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : "Not set";

const getRoleBasePath = (role?: string | null) => {
  const normalizedRole = String(role || "").toUpperCase();
  if (normalizedRole === "CLIENT") return "/client";
  if (normalizedRole === "FREELANCER") return "/freelancer";
  return "/broker";
};

const AgreementText = ({ termsContent }: { termsContent: string }) => {
  const blocks = parseAgreementTerms(termsContent);

  return (
    <div className="space-y-3 text-sm leading-7 text-slate-700">
      {blocks.map((block, index) => {
        const key = `${block.kind}-${index}`;

        if (block.kind === "h1") {
          return (
            <h3 key={key} className="text-xl font-semibold tracking-tight text-slate-950">
              {block.text}
            </h3>
          );
        }

        if (block.kind === "h2") {
          return (
            <h4 key={key} className="pt-2 text-lg font-semibold text-slate-900">
              {block.text}
            </h4>
          );
        }

        if (block.kind === "h3") {
          return (
            <h5 key={key} className="pt-1 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              {block.text}
            </h5>
          );
        }

        if (block.kind === "label") {
          return (
            <p key={key} className="text-sm font-semibold text-slate-900">
              {block.text}
            </p>
          );
        }

        if (block.kind === "bullet") {
          return (
            <div
              key={key}
              className={`flex gap-3 ${block.indent ? "pl-6" : ""}`}
            >
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-teal-600" />
              <p className="flex-1 text-sm leading-7 text-slate-700">{block.text}</p>
            </div>
          );
        }

        if (block.kind === "ordered") {
          return (
            <div
              key={key}
              className={`flex gap-3 ${block.indent ? "pl-6" : ""}`}
            >
              <span className="min-w-5 text-sm font-semibold text-teal-700">
                {block.order}.
              </span>
              <p className="flex-1 text-sm leading-7 text-slate-700">
                {block.text}
              </p>
            </div>
          );
        }

        if (block.kind === "task") {
          return (
            <div
              key={key}
              className={`flex gap-3 ${block.indent ? "pl-6" : ""}`}
            >
              <span className="mt-1 text-sm text-teal-700">
                {block.checked ? "☑" : "☐"}
              </span>
              <p className="flex-1 text-sm leading-7 text-slate-700">
                {block.text}
              </p>
            </div>
          );
        }

        if (block.kind === "quote") {
          return (
            <blockquote
              key={key}
              className="rounded-2xl border-l-4 border-teal-200 bg-teal-50/40 px-4 py-3 text-sm leading-7 text-slate-700"
            >
              {block.text}
            </blockquote>
          );
        }

        if (block.kind === "divider") {
          return <div key={key} className="my-4 border-t border-slate-200" />;
        }

        return (
          <p key={key} className="max-w-none text-sm leading-7 text-slate-700">
            {block.text}
          </p>
        );
      })}
    </div>
  );
};

export default function ContractPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [contract, setContract] = useState<Contract | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAgreementChecked, setIsAgreementChecked] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isCreatingSignatureSession, setIsCreatingSignatureSession] =
    useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isPreparingPdfPreview, setIsPreparingPdfPreview] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [showFullAgreement, setShowFullAgreement] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfPreviewContractId, setPdfPreviewContractId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState("");
  const currentUser = getStoredJson<{ id?: string; role?: string }>(
    STORAGE_KEYS.USER,
  );
  const roleBasePath = getRoleBasePath(currentUser?.role);

  const resetPdfPreview = () => {
    setShowPdfPreview(false);
    setPdfPreviewContractId(null);
    setPdfPreviewUrl((current) => {
      if (current) {
        window.URL.revokeObjectURL(current);
      }
      return null;
    });
  };

  const reloadContract = async (contractId: string) => {
    const updated = await contractsApi.getContract(contractId);
    resetPdfPreview();
    setContract(updated);
    return updated;
  };

  const createPdfObjectUrl = async (contractId: string) => {
    const pdfBuffer = await contractsApi.downloadPdf(contractId);
    const blob = new Blob([pdfBuffer], { type: "application/pdf" });
    return window.URL.createObjectURL(blob);
  };

  const ensurePdfPreviewUrl = async () => {
    if (!contract) {
      throw new Error("Contract not loaded");
    }

    if (pdfPreviewUrl && pdfPreviewContractId === contract.id) {
      return pdfPreviewUrl;
    }

    const nextUrl = await createPdfObjectUrl(contract.id);
    setPdfPreviewContractId(contract.id);
    setPdfPreviewUrl((current) => {
      if (current) {
        window.URL.revokeObjectURL(current);
      }
      return nextUrl;
    });
    return nextUrl;
  };

  useEffect(() => {
    if (!id) {
      return;
    }

    setIsLoading(true);
    resetPdfPreview();
    contractsApi
      .getContract(id)
      .then((loadedContract) => {
        setContract(loadedContract);
        setError("");
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to load contract.");
      })
      .finally(() => setIsLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) {
      return;
    }

    const socket = connectSocket();
    if (!socket) {
      return;
    }

    const handleContractUpdated = (payload?: {
      contractId?: string;
      projectId?: string;
    }) => {
      if (
        payload?.contractId === id ||
        (contract?.projectId && payload?.projectId === contract.projectId)
      ) {
        void reloadContract(id);
      }
    };

    socket.on("CONTRACT_UPDATED", handleContractUpdated);
    socket.on("NOTIFICATION_CREATED", handleContractUpdated);

    return () => {
      socket.off("CONTRACT_UPDATED", handleContractUpdated);
      socket.off("NOTIFICATION_CREATED", handleContractUpdated);
    };
  }, [contract?.projectId, id]);

  useEffect(() => {
    return () => {
      if (pdfPreviewUrl) {
        window.URL.revokeObjectURL(pdfPreviewUrl);
      }
    };
  }, [pdfPreviewUrl]);

  const sortedSignatures = useMemo(
    () =>
      [...(contract?.signatures || [])].sort(
        (a, b) =>
          new Date(a.signedAt).getTime() - new Date(b.signedAt).getTime(),
      ),
    [contract?.signatures],
  );

  const sortedSnapshot = useMemo(
    () =>
      [...(contract?.milestoneSnapshot || [])].sort(
        (a, b) =>
          (a.sortOrder ?? Number.MAX_SAFE_INTEGER) -
          (b.sortOrder ?? Number.MAX_SAFE_INTEGER),
      ),
    [contract?.milestoneSnapshot],
  );

  const requiredSignerIds = useMemo(
    () =>
      [
        contract?.project?.clientId,
        contract?.project?.brokerId,
        contract?.project?.freelancerId,
      ].filter((value): value is string => Boolean(value)),
    [contract],
  );

  const signedUserIds = useMemo(
    () => new Set((contract?.signatures || []).map((item) => item.userId)),
    [contract?.signatures],
  );

  const missingSignerIds = useMemo(
    () => requiredSignerIds.filter((userId) => !signedUserIds.has(userId)),
    [requiredSignerIds, signedUserIds],
  );

  const resolveSignerName = useCallback((userId: string) => {
    const signature = sortedSignatures.find((item) => item.userId === userId);
    if (signature?.user?.fullName) return signature.user.fullName;
    if (userId === contract?.project?.clientId) {
      return contract.project?.client?.fullName || "Client";
    }
    if (userId === contract?.project?.brokerId) {
      return contract.project?.broker?.fullName || "Broker";
    }
    if (userId === contract?.project?.freelancerId) {
      return contract.project?.freelancer?.fullName || "Freelancer";
    }
    return userId;
  }, [contract, sortedSignatures]);

  const snapshotTotal = sortedSnapshot.reduce(
    (sum, milestone) => sum + Number(milestone.amount || 0),
    0,
  );

  const isDraft = contract?.status === "DRAFT";
  const isSent = contract?.status === "SENT";
  const isSigned = contract?.status === "SIGNED";
  const isActivated =
    contract?.status === "ACTIVATED" ||
    contract?.status === "ACTIVE" ||
    Boolean(contract?.activatedAt);
  const isBrokerOwner =
    Boolean(currentUser?.id) && currentUser?.id === contract?.project?.brokerId;
  const currentUserIsParty = Boolean(
    currentUser?.id && requiredSignerIds.includes(currentUser.id),
  );
  const hasCurrentUserSigned = Boolean(
    currentUser?.id &&
      contract?.signatures?.some((signature) => signature.userId === currentUser.id),
  );
  const canDiscardBeforeSign = Boolean(
    contract &&
      isBrokerOwner &&
      sortedSignatures.length === 0 &&
      !isActivated &&
      (isDraft || isSent),
  );
  const canActivateContract = Boolean(
    contract &&
      currentUserIsParty &&
      isSigned &&
      !isActivated &&
      contract.legalSignatureStatus === "VERIFIED",
  );
  const canCreateSignatureSession = Boolean(
    contract && currentUserIsParty && isSigned && !isActivated,
  );
  const canOpenWorkspace = Boolean(isActivated && contract?.projectId);
  const currentContractHref =
    contract?.id && roleBasePath ? `${roleBasePath}/contracts/${contract.id}` : null;
  const workspaceHref =
    canOpenWorkspace && contract?.projectId ? `${roleBasePath}/workspace/${contract.projectId}` : null;
  const billingRole = normalizeSupportedBillingRole(currentUser?.role);
  const billingHref =
    currentContractHref
      ? `${resolveBillingRoute(currentUser?.role)}?${new URLSearchParams({
          returnTo: currentContractHref,
        }).toString()}`
      : null;

  const primaryCurrency =
    contract?.commercialContext?.currency || contract?.project?.currency || "USD";
  const scopeNarrativeRichContent =
    contract?.commercialContext?.scopeNarrativeRichContent || null;
  const scopeNarrativePlainText =
    contract?.commercialContext?.scopeNarrativePlainText?.trim() || "";
  const hasFrozenScopeNarrative = narrativeHasContent(scopeNarrativeRichContent);

  const signatureStatusCopy = useMemo(() => {
    if (isActivated) {
      return "Activated. Runtime milestones and escrows now follow this frozen agreement.";
    }
    if (isSigned && contract?.legalSignatureStatus === "VERIFIED") {
      return "All required parties signed and the legal signature provider verified this contract. One contract party can now activate it.";
    }
    if (isSigned) {
      return "All required parties have signed. Legal provider verification must complete before activation.";
    }
    if (isSent) {
      return missingSignerIds.length > 0
        ? `Waiting for ${missingSignerIds.map(resolveSignerName).join(", ")}.`
        : "All required parties have signed.";
    }
    if (isDraft) {
      return "Legacy draft contract. New contracts now begin directly in SENT status.";
    }
    return "Review the frozen agreement, its audit hashes, and the signature trail.";
  }, [isActivated, isDraft, isSent, isSigned, missingSignerIds, resolveSignerName]);

  const legalSignatureStatusCopy = useMemo(() => {
    switch (contract?.legalSignatureStatus) {
      case "VERIFIED":
        return "Provider verification complete. This contract now has provider evidence and can be activated.";
      case "SESSION_CREATED":
        return "A provider session exists. Wait for provider verification webhook before activation.";
      case "PENDING_PROVIDER":
        return "Provider verification is pending.";
      case "FAILED":
        return "Provider verification failed. Start a new session or inspect provider evidence.";
      default:
        return "Internal audit signatures are recorded, but legal provider verification has not started yet.";
    }
  }, [contract?.legalSignatureStatus]);

  const lifecycleSteps = useMemo(
    () => [
      {
        label: "Review",
        description: "Frozen agreement is ready for parties to inspect.",
        state:
          isActivated || isSigned || isSent
            ? "done"
            : isDraft
              ? "active"
              : "idle",
      },
      {
        label: "Sign",
        description: "Client, broker, and freelancer sign the same frozen version.",
        state:
          isActivated || isSigned ? "done" : isSent ? "active" : "idle",
      },
      {
        label: "Activate",
        description: "Clone runtime milestones and create escrows from the signed contract.",
        state: isActivated ? "done" : isSigned ? "active" : "idle",
      },
    ],
    [isActivated, isDraft, isSent, isSigned],
  );

  const requiredPartyProgress = useMemo(
    () => [
      {
        label: "Client",
        id: contract?.project?.clientId || "",
        name: contract?.project?.client?.fullName || "Client",
      },
      {
        label: "Broker",
        id: contract?.project?.brokerId || "",
        name: contract?.project?.broker?.fullName || "Broker",
      },
      {
        label: "Freelancer",
        id: contract?.project?.freelancerId || "",
        name: contract?.project?.freelancer?.fullName || "Freelancer",
      },
    ].filter((party) => Boolean(party.id)),
    [contract],
  );

  const handleTogglePdfPreview = async () => {
    if (!contract) return;

    if (showPdfPreview) {
      setShowPdfPreview(false);
      return;
    }

    try {
      setIsPreparingPdfPreview(true);
      setError("");
      await ensurePdfPreviewUrl();
      setShowPdfPreview(true);
    } catch (err: any) {
      console.error(err);
      setError(
        err?.response?.data?.message ||
          "Failed to prepare the contract PDF preview. Please try again.",
      );
    } finally {
      setIsPreparingPdfPreview(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!contract) return;

    let temporaryUrl: string | null = null;
    try {
      setIsDownloadingPdf(true);
      setError("");
      const objectUrl =
        pdfPreviewUrl && pdfPreviewContractId === contract.id
          ? pdfPreviewUrl
          : ((temporaryUrl = await createPdfObjectUrl(contract.id)), temporaryUrl);

      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `contract-${contract.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: any) {
      console.error(err);
      setError(
        err?.response?.data?.message ||
          "Failed to download contract PDF. Please try again.",
      );
    } finally {
      if (temporaryUrl) {
        window.setTimeout(() => window.URL.revokeObjectURL(temporaryUrl!), 0);
      }
      setIsDownloadingPdf(false);
    }
  };

  const handleDiscardContract = async () => {
    if (!contract) return;

    try {
      setIsDiscarding(true);
      setError("");
      await contractsApi.discardDraft(contract.id);
      const archived = await reloadContract(contract.id);
      setContract(archived);
      setShowDiscardDialog(false);
      toast({
        title: "Contract discarded",
        description: "The frozen contract was archived and the source spec was unlocked.",
      });
    } catch (err: any) {
      console.error(err);
      setError(
        err?.response?.data?.message ||
          "Failed to discard the contract. Please refresh and try again.",
      );
    } finally {
      setIsDiscarding(false);
    }
  };

  const handleSign = async () => {
    if (!contract || !isAgreementChecked || !contract.contentHash) return;

    try {
      setIsSigning(true);
      setError("");
      await contractsApi.signContract(contract.id, contract.contentHash);
      await reloadContract(contract.id);
      setIsAgreementChecked(false);
      toast({
        title: "Contract signed",
        description: "Your audit signature has been recorded for this frozen contract.",
      });
    } catch (err: any) {
      console.error(err);
      setError(
        err?.response?.data?.message ||
          "Failed to sign contract. Please refresh and try again.",
      );
    } finally {
      setIsSigning(false);
    }
  };

  const handleActivateContract = async () => {
    if (!contract) return;

    try {
      setIsActivating(true);
      setError("");
      const result = await contractsApi.activateContract(contract.id);
      await reloadContract(contract.id);
      toast({
        title: result.alreadyActivated
          ? "Contract already activated"
          : "Contract activated",
        description: result.alreadyActivated
          ? "This contract was already active."
          : "Project milestones and escrows were initialized from the frozen contract.",
      });
    } catch (err: any) {
      console.error(err);
      setError(
        err?.response?.data?.message ||
          "Failed to activate contract. Please refresh and try again.",
      );
    } finally {
      setIsActivating(false);
    }
  };

  const handleCreateSignatureSession = async () => {
    if (!contract) return;

    try {
      setIsCreatingSignatureSession(true);
      setError("");
      const session = await contractsApi.createSignatureSession(contract.id);
      await reloadContract(contract.id);
      toast({
        title: "Legal signature session created",
        description: session?.sessionId
          ? `Provider session ${session.sessionId} is now waiting for verification.`
          : "Provider verification session is now waiting for verification.",
      });
    } catch (err: any) {
      console.error(err);
      setError(
        err?.response?.data?.message ||
          "Failed to create legal signature session. Please try again.",
      );
    } finally {
      setIsCreatingSignatureSession(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="p-8 text-center text-red-500">
        {error || "Contract not found"}
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl space-y-6 py-8">
      <Card className="overflow-hidden border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.16),_transparent_48%),linear-gradient(135deg,_#f8fffe_0%,_#f8fafc_55%,_#ecfeff_100%)] shadow-sm">
        <CardContent className="space-y-6 p-6 md:p-8">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Badge
                  variant={isActivated ? "default" : "outline"}
                  className="px-3 py-1 text-xs uppercase tracking-[0.24em]"
                >
                  {contract.status}
                </Badge>
                <span className="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                  Contract {contract.id}
                </span>
              </div>
              <div>
                <h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
                  {contract.title}
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  Review the frozen commercial agreement that now governs project
                  activation, milestone cloning, and escrow creation.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={handleTogglePdfPreview}
                disabled={isPreparingPdfPreview}
              >
                <Eye className="mr-2 h-4 w-4" />
                {showPdfPreview
                  ? "Hide PDF"
                  : isPreparingPdfPreview
                    ? "Preparing PDF..."
                    : "Preview PDF"}
              </Button>
              <Button
                variant="outline"
                onClick={handleDownloadPdf}
                disabled={isDownloadingPdf}
              >
                <Download className="mr-2 h-4 w-4" />
                {isDownloadingPdf ? "Downloading..." : "Download PDF"}
              </Button>
              {isActivated && billingHref && (
                <Button
                  asChild
                  variant="outline"
                  className="border-teal-200 text-teal-700 hover:bg-teal-50"
                >
                  <Link to={billingHref}>
                    <WalletCards className="mr-2 h-4 w-4" />
                    {resolveBillingLabel(billingRole)}
                  </Link>
                </Button>
              )}
              {!isActivated && (
                <div className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                  <WalletCards className="h-4 w-4 text-slate-400" />
                  Contract-linked wallet view unlocks after activation
                </div>
              )}
              {canDiscardBeforeSign && (
                <Button
                  variant="outline"
                  onClick={() => setShowDiscardDialog(true)}
                  disabled={isDiscarding}
                  className="border-amber-200 text-amber-700 hover:bg-amber-50"
                >
                  <ArchiveX className="mr-2 h-4 w-4" />
                  {isDiscarding ? "Discarding..." : "Discard Before Sign"}
                </Button>
              )}
              {workspaceHref && (
                <Button asChild>
                  <Link to={workspaceHref}>
                    <Briefcase className="mr-2 h-4 w-4" />
                    Open Workspace
                  </Link>
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Signature progress
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {sortedSignatures.length}/{requiredSignerIds.length}
              </p>
              <p className="mt-1 text-sm text-slate-600">{signatureStatusCopy}</p>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Frozen budget
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {formatMoney(
                  contract.commercialContext?.totalBudget ?? contract.project.totalBudget,
                  primaryCurrency,
                )}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {sortedSnapshot.length} milestone
                {sortedSnapshot.length === 1 ? "" : "s"} in the locked payment
                schedule
              </p>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Project reference
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-950">
                {contract.project.title}
              </p>
              <p className="mt-1 text-sm text-slate-600">Project ID: {contract.projectId}</p>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Lifecycle
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-950">
                Created {formatDateTime(contract.createdAt)}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Activated {formatDateTime(contract.activatedAt)}
              </p>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            {lifecycleSteps.map((step) => (
              <div
                key={step.label}
                className={`rounded-2xl border p-4 shadow-sm ${
                  step.state === "done"
                    ? "border-emerald-200 bg-emerald-50/80"
                    : step.state === "active"
                      ? "border-teal-200 bg-white/90"
                      : "border-white/70 bg-white/70"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-950">
                    {step.label}
                  </p>
                  <Badge
                    variant="outline"
                    className={
                      step.state === "done"
                        ? "border-emerald-200 text-emerald-700"
                        : step.state === "active"
                          ? "border-teal-200 text-teal-700"
                          : "border-slate-200 text-slate-500"
                    }
                  >
                    {step.state === "done"
                      ? "Done"
                      : step.state === "active"
                        ? "Current"
                        : "Upcoming"}
                  </Badge>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Contract Flow Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {showPdfPreview && pdfPreviewUrl && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScrollText className="h-5 w-5 text-teal-600" />
              Canonical PDF Preview
            </CardTitle>
            <CardDescription>
              This preview is the exact backend-generated PDF artifact used by
              the download action.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950/5">
              <iframe
                title="Contract PDF Preview"
                src={pdfPreviewUrl}
                className="h-[760px] w-full bg-white"
              />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.65fr_0.95fr]">
        <div className="space-y-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-teal-600" />
                Agreement Snapshot
              </CardTitle>
              <CardDescription>
                Parties, frozen commercial context, and the scope that this
                contract version governs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  {
                    label: "Client",
                    name: contract.project.client?.fullName || "N/A",
                    meta: contract.project.client?.email || "No email",
                  },
                  {
                    label: "Broker",
                    name: contract.project.broker?.fullName || "N/A",
                    meta: contract.project.broker?.email || "No email",
                  },
                  {
                    label: "Freelancer",
                    name: contract.project.freelancer?.fullName || "N/A",
                    meta: contract.project.freelancer?.email || "No email",
                  },
                ].map((party) => (
                  <div
                    key={party.label}
                    className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4"
                  >
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      {party.label}
                    </p>
                    <p className="mt-2 text-base font-semibold text-slate-950">
                      {party.name}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">{party.meta}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Total budget
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">
                    {formatMoney(
                      contract.commercialContext?.totalBudget ?? contract.project.totalBudget,
                      primaryCurrency,
                    )}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Currency
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">
                    {primaryCurrency}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Source spec
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">
                    {contract.commercialContext?.sourceSpecId || contract.sourceSpecId || "N/A"}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Spec frozen at
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">
                    {formatDateTime(contract.commercialContext?.sourceSpecUpdatedAt || undefined)}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      Commercial summary
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      {contract.commercialContext?.description ||
                        contract.project.description ||
                        "No additional commercial summary captured for this agreement."}
                    </p>
                  </div>
                  {contract.commercialContext?.escrowSplit && (
                    <div className="rounded-xl bg-teal-50 px-4 py-3 text-xs text-teal-800">
                      Escrow split:
                      <div className="mt-2 space-y-1">
                        <p>
                          Developer {contract.commercialContext.escrowSplit.developerPercentage}%
                        </p>
                        <p>
                          Broker {contract.commercialContext.escrowSplit.brokerPercentage}%
                        </p>
                        <p>
                          Platform {contract.commercialContext.escrowSplit.platformPercentage}%
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                    <span className="font-medium text-slate-900">Tech stack:</span>{" "}
                    {contract.commercialContext?.techStack || "As agreed in the signed spec"}
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                    <span className="font-medium text-slate-900">Feature count:</span>{" "}
                    {contract.commercialContext?.features?.length || 0}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {(hasFrozenScopeNarrative || scopeNarrativePlainText) && (
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ScrollText className="h-5 w-5 text-teal-600" />
                  Scope Notes
                </CardTitle>
                <CardDescription>
                  These detailed notes were frozen from the full spec and travel
                  with the agreement that parties sign.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {hasFrozenScopeNarrative ? (
                  <SpecNarrativeRenderer value={scopeNarrativeRichContent} />
                ) : (
                  <AgreementText termsContent={scopeNarrativePlainText} />
                )}
              </CardContent>
            </Card>
          )}

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-teal-600" />
                Frozen Milestone & Payment Schedule
              </CardTitle>
              <CardDescription>
                This schedule is the frozen source for project milestone cloning
                and escrow creation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Snapshot total
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-950">
                    {formatMoney(snapshotTotal, primaryCurrency)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Milestones
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-950">
                    {sortedSnapshot.length}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {sortedSnapshot.map((milestone: ContractMilestoneSnapshotItem) => (
                  <div
                    key={milestone.contractMilestoneKey}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="border-slate-300 text-slate-700">
                            #{milestone.sortOrder ?? "—"}
                          </Badge>
                          <h3 className="text-lg font-semibold text-slate-950">
                            {milestone.title}
                          </h3>
                        </div>
                        <p className="text-sm leading-6 text-slate-600">
                          {milestone.description || "No milestone description provided."}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-teal-50 px-4 py-3 text-right text-sm text-teal-900">
                        <p className="text-xs uppercase tracking-[0.18em] text-teal-700">
                          Amount
                        </p>
                        <p className="mt-1 text-lg font-semibold">
                          {formatMoney(milestone.amount, primaryCurrency)}
                        </p>
                        {!!milestone.retentionAmount && (
                          <p className="mt-1 text-xs text-teal-800">
                            Retention {formatMoney(milestone.retentionAmount, primaryCurrency)}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                        <span className="font-medium text-slate-900">Deliverable:</span>{" "}
                        {milestone.deliverableType || "OTHER"}
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                        <span className="font-medium text-slate-900">Start:</span>{" "}
                        {formatDate(milestone.startDate)}
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                        <span className="font-medium text-slate-900">Due:</span>{" "}
                        {formatDate(milestone.dueDate)}
                      </div>
                    </div>

                    {milestone.acceptanceCriteria &&
                      milestone.acceptanceCriteria.length > 0 && (
                        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                            Acceptance criteria
                          </p>
                          <div className="mt-3 space-y-2">
                            {milestone.acceptanceCriteria.map((criterion) => (
                              <div key={criterion} className="flex gap-3">
                                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-teal-600" />
                                <p className="text-sm leading-6 text-slate-700">
                                  {criterion}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ScrollText className="h-5 w-5 text-teal-600" />
                Full Agreement Text
              </CardTitle>
              <CardDescription>
                The canonical stored agreement text remains the signable payload,
                but it is shown here in a readable presentation layer.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <button
                type="button"
                onClick={() => setShowFullAgreement((value) => !value)}
                className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-left transition hover:border-teal-200 hover:bg-teal-50/40"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {showFullAgreement ? "Hide full agreement text" : "Show full agreement text"}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Review the exact legal text behind this frozen agreement version.
                  </p>
                </div>
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {showFullAgreement ? "Collapse" : "Expand"}
                </span>
              </button>

              {showFullAgreement && (
                <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-inner">
                  <AgreementText termsContent={contract.termsContent || ""} />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSignature className="h-5 w-5 text-teal-600" />
                Signature Flow
              </CardTitle>
              <CardDescription>
                Track signer progress and take the next valid contract action.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      Current progress
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">
                      {sortedSignatures.length}/{requiredSignerIds.length}
                    </p>
                  </div>
                  <Clock3 className="h-6 w-6 text-slate-400" />
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {signatureStatusCopy}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Required parties
                  </p>
                  <Badge variant="outline" className="border-slate-300 text-slate-700">
                    {sortedSignatures.length}/{requiredPartyProgress.length} signed
                  </Badge>
                </div>
                <div className="mt-4 space-y-3">
                  {requiredPartyProgress.map((party) => {
                    const isSignedParty = signedUserIds.has(party.id);
                    return (
                      <div
                        key={party.id}
                        className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {party.name}
                          </p>
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                            {party.label}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            isSignedParty
                              ? "border-emerald-200 text-emerald-700"
                              : "border-amber-200 text-amber-700"
                          }
                        >
                          {isSignedParty ? "Signed" : "Pending"}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      Legal signature provider
                    </p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">
                      {contract.provider || "Not started"}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      contract.legalSignatureStatus === "VERIFIED"
                        ? "border-emerald-200 text-emerald-700"
                        : contract.legalSignatureStatus === "FAILED"
                          ? "border-rose-200 text-rose-700"
                          : "border-amber-200 text-amber-700"
                    }
                  >
                    {contract.legalSignatureStatus || "NOT_STARTED"}
                  </Badge>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {legalSignatureStatusCopy}
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                    <span className="font-medium text-slate-900">Verified at:</span>{" "}
                    {formatDateTime(contract.verifiedAt)}
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                    <span className="font-medium text-slate-900">Certificate serial:</span>{" "}
                    {contract.certificateSerial || "Not available"}
                  </div>
                </div>
                {canCreateSignatureSession && (
                  <div className="mt-4 flex justify-end">
                    <Button
                      variant="outline"
                      onClick={handleCreateSignatureSession}
                      disabled={
                        isCreatingSignatureSession ||
                        contract.legalSignatureStatus === "VERIFIED"
                      }
                    >
                      {isCreatingSignatureSession
                        ? "Creating session..."
                        : contract.legalSignatureStatus === "VERIFIED"
                          ? "Provider Verified"
                          : "Start Legal Signature Session"}
                    </Button>
                  </div>
                )}
              </div>

              {sortedSignatures.length > 0 && (
                <div className="space-y-3">
                  {sortedSignatures.map((signature) => (
                    <div
                      key={`${signature.userId}-${signature.signedAt}`}
                      className="rounded-2xl border border-slate-200 bg-white p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-950">
                            {resolveSignerName(signature.userId)}
                          </p>
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                            {signature.signerRole || "Signer"}
                          </p>
                        </div>
                        <Badge variant="outline" className="border-emerald-200 text-emerald-700">
                          Signed
                        </Badge>
                      </div>
                      <p className="mt-3 text-sm text-slate-600">
                        {formatDateTime(signature.signedAt)}
                      </p>
                      <p className="mt-2 break-all font-mono text-[11px] text-slate-500">
                        {signature.signatureHash}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              {sortedSignatures.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600">
                  No signatures recorded yet. Once parties sign, the audit trail will appear here in chronological order.
                </div>
              )}

              {isDraft && (
                <Alert className="border-slate-200 bg-slate-50 text-slate-800">
                  <Lock className="h-4 w-4 text-slate-600" />
                  <AlertTitle>Legacy Draft Contract</AlertTitle>
                  <AlertDescription>
                    This record predates the new frozen-agreement flow. New
                    contracts now start directly in SENT, so draft editing is no
                    longer part of the normal path.
                  </AlertDescription>
                </Alert>
              )}

              {isSent && (
                <div className="space-y-4 rounded-3xl border border-blue-200 bg-blue-50/50 p-4">
                  <Alert className="border-white/70 bg-white/90">
                    <ShieldCheck className="h-4 w-4" />
                    <AlertTitle>Electronic Signature Check</AlertTitle>
                    <AlertDescription className="text-xs leading-5">
                      You are signing the current frozen contract version tied to
                      the content hash shown in the integrity panel.
                    </AlertDescription>
                  </Alert>

                  <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-white p-4">
                    <Checkbox
                      id="contract-sign-consent"
                      checked={isAgreementChecked}
                      onCheckedChange={(checked) =>
                        setIsAgreementChecked(Boolean(checked))
                      }
                    />
                    <Label
                      htmlFor="contract-sign-consent"
                      className="cursor-pointer text-sm font-normal leading-6"
                    >
                      I reviewed the frozen agreement, understand the milestone
                      payment schedule, and agree to sign this contract version.
                    </Label>
                  </div>

                  {!currentUserIsParty && (
                    <p className="text-sm text-amber-700">
                      Only contract parties can sign this agreement.
                    </p>
                  )}

                  <Button
                    className="w-full"
                    onClick={handleSign}
                    disabled={
                      !isAgreementChecked ||
                      isSigning ||
                      hasCurrentUserSigned ||
                      !currentUserIsParty ||
                      !contract.contentHash
                    }
                  >
                    {hasCurrentUserSigned
                      ? "Already Signed"
                      : isSigning
                        ? "Signing..."
                        : "Sign Frozen Agreement"}
                  </Button>
                </div>
              )}

              {canActivateContract && (
                <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                  <Lock className="h-4 w-4 text-amber-700" />
                  <AlertTitle>Ready for Activation</AlertTitle>
                  <AlertDescription className="space-y-3">
                    <p>
                      All required parties have signed. Activation will clone the
                      frozen milestone schedule into the project and generate
                      escrows from this contract.
                    </p>
                    <Button size="sm" onClick={handleActivateContract} disabled={isActivating}>
                      {isActivating ? "Activating..." : "Activate Contract"}
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {isSigned && !canActivateContract && contract.legalSignatureStatus !== "VERIFIED" && (
                <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                  <Lock className="h-4 w-4 text-amber-700" />
                  <AlertTitle>Activation blocked pending provider verification</AlertTitle>
                  <AlertDescription>
                    All parties signed the frozen contract, but activation stays
                    locked until the legal signature provider marks the contract
                    as verified.
                  </AlertDescription>
                </Alert>
              )}

              {isActivated && (
                <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
                  <CheckCircle className="h-4 w-4 text-emerald-700" />
                  <AlertTitle>Contract Activated</AlertTitle>
                  <AlertDescription className="space-y-3">
                    <p>
                      Milestones and escrows now follow the frozen contract
                      snapshot. Execution updates can continue in the workspace.
                    </p>
                    {workspaceHref && (
                      <Button size="sm" variant="outline" asChild>
                        <Link to={workspaceHref}>
                          Open Workspace
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-teal-600" />
                Integrity & Audit
              </CardTitle>
              <CardDescription>
                Hashes and version markers for the current contract state.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {contract.contentHash && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Content hash
                  </p>
                  <p className="mt-2 break-all font-mono text-xs leading-6 text-slate-800">
                    {contract.contentHash}
                  </p>
                </div>
              )}

              {contract.documentHash && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Document hash
                  </p>
                  <p className="mt-2 break-all font-mono text-xs leading-6 text-slate-800">
                    {contract.documentHash}
                  </p>
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                <p className="font-medium text-slate-900">Why both hashes exist</p>
                <p className="mt-2 leading-6">
                  The content hash identifies the signable contract version. The
                  document hash tracks the broader audit artifact used for export
                  and PDF verification.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsigned contract?</AlertDialogTitle>
            <AlertDialogDescription>
              This archives the current frozen contract and unlocks the source
              spec so the broker can revise it again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDiscarding}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleDiscardContract();
              }}
              disabled={isDiscarding}
            >
              {isDiscarding ? "Discarding..." : "Discard Contract"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
