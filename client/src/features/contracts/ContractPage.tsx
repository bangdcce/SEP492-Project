import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Download,
  PenTool,
  CheckCircle,
  Lock,
  FileText,
  Eye,
} from "lucide-react";
import { PDFViewer } from "@react-pdf/renderer";
import { Button } from "@/shared/components/ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/shared/components/ui/Card";
import { Badge } from "@/shared/components/ui/badge";
import Spinner from "@/shared/components/ui/Spinner";
import { Input } from "@/shared/components/ui/Input";
import { Label } from "@/shared/components/ui/label";
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/shared/components/ui/alert";
import type { Contract } from "./types";
import { contractsApi } from "./api";
import { ContractPDF } from "./ContractPDF";
import { getStoredJson } from "@/shared/utils/storage";
import { STORAGE_KEYS } from "@/constants";

export default function ContractPage() {
  const { id } = useParams<{ id: string }>();
  const [contract, setContract] = useState<Contract | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAgreementChecked, setIsAgreementChecked] = useState(false);
  const [signatureNote, setSignatureNote] = useState("");
  const [isSigning, setIsSigning] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [error, setError] = useState("");
  const [showPDFViewer, setShowPDFViewer] = useState(false);
  const currentUser = getStoredJson<{ id?: string }>(STORAGE_KEYS.USER);

  const reloadContract = async (contractId: string) => {
    const updated = await contractsApi.getContract(contractId);
    setContract(updated);
    return updated;
  };

  useEffect(() => {
    if (id) {
      contractsApi
        .getContract(id)
        .then(setContract)
        .catch((err) => {
          console.error(err);
          setError("Failed to load contract");
        })
        .finally(() => setIsLoading(false));
    }
  }, [id]);

  const handleSign = async () => {
    if (!contract || !isAgreementChecked) return;
    try {
      setIsSigning(true);
      const signResult = await contractsApi.signContract(
        contract.id,
        signatureNote.trim(),
      );
      let updated = await reloadContract(contract.id);
      if (signResult.allRequiredSigned && !updated.activatedAt) {
        await contractsApi.activateContract(contract.id);
        updated = await reloadContract(contract.id);
      }
      setSignatureNote("");
      setIsAgreementChecked(false);
      alert("Contract signed successfully!");
    } catch (err: any) {
      console.error(err);
      const message =
        err?.response?.data?.message ||
        "Failed to sign contract. Please refresh and try again.";
      alert(message);
    } finally {
      setIsSigning(false);
    }
  };

  const handleActivateContract = async () => {
    if (!contract) return;
    try {
      setIsActivating(true);
      const result = await contractsApi.activateContract(contract.id);
      await reloadContract(contract.id);
      alert(
        result.alreadyActivated
          ? "Contract was already activated."
          : "Contract activated and project milestones initialized.",
      );
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        "Failed to activate contract. Please refresh and try again.";
      alert(message);
    } finally {
      setIsActivating(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!contract) return;
    try {
      setIsDownloadingPdf(true);
      const pdfBuffer = await contractsApi.downloadPdf(contract.id);
      const blob = new Blob([pdfBuffer], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `contract-${contract.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        "Failed to download signed PDF. Please try again.";
      alert(message);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  if (isLoading)
    return (
      <div className="h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  if (!contract)
    return (
      <div className="p-8 text-center text-red-500">
        {error || "Contract not found"}
      </div>
    );

  const isSigned =
    contract.status === "SIGNED" ||
    contract.status === "ACTIVATED" ||
    contract.status === "ACTIVE";
  const isActivated = Boolean(contract.activatedAt);
  const hasCurrentUserSigned = Boolean(
    currentUser?.id &&
    contract.signatures?.some(
      (signature) => signature.userId === currentUser.id,
    ),
  );
  const snapshotCount = Array.isArray(contract.milestoneSnapshot)
    ? contract.milestoneSnapshot.length
    : 0;
  const snapshotTotal = Array.isArray(contract.milestoneSnapshot)
    ? contract.milestoneSnapshot.reduce(
        (sum, milestone) => sum + Number(milestone.amount || 0),
        0,
      )
    : 0;
  const sortedSignatures = [...(contract.signatures || [])].sort(
    (a, b) => new Date(a.signedAt).getTime() - new Date(b.signedAt).getTime(),
  );
  const requiredSignerIds = [
    contract.project?.clientId,
    contract.project?.brokerId,
    contract.project?.freelancerId,
  ].filter((value): value is string => Boolean(value));
  const signedUserIds = new Set(
    (contract.signatures || []).map((item) => item.userId),
  );
  const missingSignerIds = requiredSignerIds.filter(
    (userId) => !signedUserIds.has(userId),
  );
  const hasAllRequiredSignatures = missingSignerIds.length === 0;
  const canActivateContract = hasAllRequiredSignatures && !isActivated;

  const resolveSignerName = (userId: string) => {
    const signature = sortedSignatures.find((item) => item.userId === userId);
    if (signature?.user?.fullName) return signature.user.fullName;
    if (userId === contract.project?.clientId)
      return contract.project?.client?.fullName || "Client";
    if (userId === contract.project?.brokerId)
      return contract.project?.broker?.fullName || "Broker";
    if (userId === contract.project?.freelancerId)
      return contract.project?.freelancer?.fullName || "Freelancer";
    return userId;
  };

  // Identify missing signatures (Mock logic as we don't have current user ID easily here without context)
  // We rely on backend to tell us if WE signed based on error or status.
  // Actually, for this view, we just show the list.

  return (
    <div className="container mx-auto py-8 max-w-6xl space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{contract.title}</h1>
          <p className="text-muted-foreground">
            Project ID: {contract.projectId}
          </p>
          {contract.activatedAt && (
            <p className="text-sm text-slate-500">
              Activated: {new Date(contract.activatedAt).toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Badge
            variant={isSigned ? "default" : "outline"}
            className="text-lg px-4 py-1"
          >
            {contract.status}
          </Badge>
          <Button
            variant="outline"
            onClick={() => setShowPDFViewer(!showPDFViewer)}
          >
            <Eye className="w-4 h-4 mr-2" />{" "}
            {showPDFViewer ? "Hide" : "Preview"} PDF
          </Button>
          <Button
            variant="outline"
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
          >
            <Download className="w-4 h-4 mr-2" />
            {isDownloadingPdf ? "Downloading..." : "Download Signed PDF"}
          </Button>
        </div>
      </div>

      {/* PDF Viewer */}
      {showPDFViewer && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>PDF Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full h-[600px] border rounded">
              <PDFViewer width="100%" height="100%">
                <ContractPDF contract={contract} />
              </PDFViewer>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Contract Content (Left) */}
        <div className="md:col-span-2">
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" /> Terms & Conditions
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto max-h-[70vh] bg-muted/20 p-6 rounded-md font-mono text-sm whitespace-pre-wrap">
              {contract.termsContent}
            </CardContent>
          </Card>
        </div>

        {/* Actions (Right) */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Signatures</CardTitle>
              <CardDescription>
                All required parties must sign to activate.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {contract.documentHash && (
                <div className="rounded-md border bg-slate-50 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-600">
                    Document Hash (SHA-256)
                  </p>
                  <p className="mt-1 break-all font-mono text-xs text-slate-800">
                    {contract.documentHash}
                  </p>
                </div>
              )}

              <div className="rounded-md border bg-white p-3 text-xs text-slate-600">
                Signature progress:{" "}
                <span className="font-semibold text-slate-900">
                  {sortedSignatures.length}/{requiredSignerIds.length}
                </span>
                {missingSignerIds.length > 0 && (
                  <p className="mt-1 text-[11px] text-amber-700">
                    Waiting for:{" "}
                    {missingSignerIds.map(resolveSignerName).join(", ")}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${contract.signatures?.some((s) => s.userId === contract.project?.clientId) ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}
                >
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold">Client</p>
                  {contract.project?.client?.fullName || "Client"}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${contract.signatures?.some((s) => s.userId === contract.project?.brokerId) ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}
                >
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold">Broker (Lead)</p>
                  {contract.project?.broker?.fullName || "Broker"}
                </div>
              </div>
              {contract.project?.freelancerId && (
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${contract.signatures?.some((s) => s.userId === contract.project?.freelancerId) ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}
                  >
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold">Freelancer</p>
                    {contract.project?.freelancer?.fullName || "Freelancer"}
                  </div>
                </div>
              )}

              {sortedSignatures.length > 0 && (
                <div className="space-y-2 rounded-md border p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Signature Timeline
                  </p>
                  {sortedSignatures.map((signature) => (
                    <div
                      key={`${signature.userId}-${signature.signedAt}`}
                      className="rounded-md bg-muted/30 p-2 text-xs"
                    >
                      <p className="font-medium">
                        {resolveSignerName(signature.userId)}
                      </p>
                      <p className="text-muted-foreground">
                        Signed at:{" "}
                        {new Date(signature.signedAt).toLocaleString()}
                      </p>
                      <p className="mt-1 break-all font-mono text-[10px] text-slate-600">
                        Signature hash: {signature.signatureHash}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {snapshotCount > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Locked Payment Schedule</CardTitle>
                <CardDescription>
                  Contract snapshot captured at activation.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Milestones</span>
                  <span className="font-semibold">{snapshotCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Snapshot Total</span>
                  <span className="font-semibold">
                    ${snapshotTotal.toFixed(2)}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {!isSigned && (
            <Card className="border-blue-200 bg-blue-50/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-700">
                  <PenTool className="w-5 h-5" /> Sign Contract
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert className="bg-white">
                  <Lock className="w-4 h-4" />
                  <AlertTitle>Signature Confirmation</AlertTitle>
                  <AlertDescription className="text-xs">
                    This step confirms your digital signature for this platform
                    workflow. It does not require your account password.
                  </AlertDescription>
                </Alert>
                <div className="flex items-start gap-3 rounded-md border bg-white p-3">
                  <Checkbox
                    id="contract-sign-consent"
                    checked={isAgreementChecked}
                    onCheckedChange={(checked) =>
                      setIsAgreementChecked(Boolean(checked))
                    }
                  />
                  <Label
                    htmlFor="contract-sign-consent"
                    className="cursor-pointer text-sm font-normal leading-5"
                  >
                    I confirm I reviewed this contract and I want to sign it.
                  </Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signature-note">
                    Signature Note (optional)
                  </Label>
                  <Input
                    id="signature-note"
                    placeholder="Example: Approved by Nguyen Van A"
                    value={signatureNote}
                    onChange={(e) => setSignatureNote(e.target.value)}
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  onClick={handleSign}
                  disabled={
                    !isAgreementChecked || isSigning || hasCurrentUserSigned
                  }
                >
                  {hasCurrentUserSigned
                    ? "Already Signed"
                    : isSigning
                      ? "Signing..."
                      : "Digitally Sign Contract"}
                </Button>
              </CardFooter>
            </Card>
          )}

          {canActivateContract && (
            <Alert className="bg-amber-50 border-amber-200 text-amber-800">
              <Lock className="w-4 h-4 text-amber-600" />
              <AlertTitle>Activation Pending</AlertTitle>
              <AlertDescription className="space-y-3">
                <p>
                  All parties signed, but this contract is not activated yet.
                  Activate now to initialize project milestones.
                </p>
                <Button
                  size="sm"
                  onClick={handleActivateContract}
                  disabled={isActivating}
                >
                  {isActivating ? "Activating..." : "Activate Contract"}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {isActivated && (
            <Alert className="bg-green-50 border-green-200 text-green-800">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <AlertTitle>Contract Active</AlertTitle>
              <AlertDescription>
                This project has been activated. Work can commence defined in
                milestones.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
}
