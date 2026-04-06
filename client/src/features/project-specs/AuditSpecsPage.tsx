import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, X, Eye } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import Spinner from "@/shared/components/ui/spinner";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/shared/components/ui/alert";
import { projectSpecsApi } from "./api";
import type { ProjectSpec } from "./types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";

export default function AuditSpecsPage() {
  const navigate = useNavigate();
  const [specs, setSpecs] = useState<ProjectSpec[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [approveId, setApproveId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchSpecs = async () => {
    try {
      setIsLoading(true);
      const data = await projectSpecsApi.getPendingSpecs();
      setSpecs(data);
    } catch (error) {
      console.error("Failed to fetch pending specs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSpecs();
  }, []);

  const handleApprove = async () => {
    if (!approveId) return;
    try {
      setIsProcessing(true);
      await projectSpecsApi.auditSpec(approveId, "APPROVE");
      setSpecs((prevSpecs) =>
        prevSpecs.filter((spec) => spec.id !== approveId),
      );
      setApproveId(null);
      toast.success("Spec approved successfully.");
    } catch (error) {
      console.error("Failed to approve spec:", error);
      toast.error("Failed to approve spec.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectId || !rejectReason.trim()) return;
    try {
      setIsProcessing(true);
      await projectSpecsApi.auditSpec(rejectId, "REJECT", rejectReason);
      setSpecs((prevSpecs) => prevSpecs.filter((spec) => spec.id !== rejectId));
      setRejectId(null);
      setRejectReason("");
      toast.success("Spec rejected.");
    } catch (error) {
      console.error("Failed to reject spec:", error);
      toast.error("Failed to reject spec.");
    } finally {
      setIsProcessing(false);
    }
  };

  const approvingSpec = approveId
    ? (specs.find((spec) => spec.id === approveId) ?? null)
    : null;

  if (isLoading)
    return (
      <div className="flex justify-center p-8">
        <Spinner size="lg" />
      </div>
    );

  return (
    <div className="container mx-auto py-8 max-w-5xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Spec Audit Dashboard (Admin)
        </h1>
        <p className="text-muted-foreground">
          Review and approve project specifications.
        </p>
      </div>

      {specs.length === 0 ? (
        <Alert>
          <AlertTitle>No pending specs</AlertTitle>
          <AlertDescription>
            All caught up! There are no specs waiting for audit.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-4">
          {specs.map((spec) => (
            <Card key={spec.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{spec.title}</CardTitle>
                    <CardDescription>
                      Request: {spec.request?.title} | Created:{" "}
                      {new Date(spec.createdAt).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <Badge variant="outline">{spec.status}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                  <div>
                    <span className="font-semibold">Budget:</span> $
                    {Number(spec.totalBudget).toLocaleString()}
                  </div>
                  <div>
                    <span className="font-semibold">Milestones:</span>{" "}
                    {spec.milestones?.length || 0}
                  </div>
                  <div className="col-span-2">
                    <span className="font-semibold">Description:</span>
                    <p className="line-clamp-2 text-muted-foreground">
                      {spec.description}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      navigate(`/admin/requests/${spec.requestId}`)
                    }
                  >
                    <Eye className="w-4 h-4 mr-2" /> View Request
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setRejectId(spec.id)}
                    disabled={isProcessing}
                  >
                    <X className="w-4 h-4 mr-2" /> Reject
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setApproveId(spec.id)}
                    disabled={isProcessing}
                  >
                    <Check className="w-4 h-4 mr-2" /> Approve
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Approve Dialog */}
      <Dialog
        open={!!approveId}
        onOpenChange={(open) => {
          if (!open && !isProcessing) {
            setApproveId(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Specification</DialogTitle>
            <DialogDescription>
              This will approve the selected specification and lock in the audit
              decision.
              {approvingSpec ? ` Spec: ${approvingSpec.title}` : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApproveId(null)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button onClick={handleApprove} disabled={isProcessing}>
              {isProcessing ? "Approving..." : "Confirm Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog
        open={!!rejectId}
        onOpenChange={(open) => {
          if (!open && !isProcessing) {
            setRejectId(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Specification</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this specification. The
              broker will be notified to make changes.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Missing detailed acceptance criteria for Feature A..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectId(null)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectReason.trim() || isProcessing}
            >
              Confirm Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
