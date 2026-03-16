import { Badge, Button, Card, CardContent, CardHeader } from "@/shared/components/ui";
import type { ContractSummary } from "@/features/contracts/types";

type RequestContractHandoffPanelProps = {
  currentPhase: number;
  linkedContract: ContractSummary | null;
  canOpenContract: boolean;
  contractActivated: boolean;
  canOpenWorkspace: boolean;
  onOpenContract: () => void;
  onOpenWorkspace: () => void;
  onRefreshStatus: () => void;
  formatDate: (value: string | null | undefined, format: string) => string;
};

export function RequestContractHandoffPanel({
  currentPhase,
  linkedContract,
  canOpenContract,
  contractActivated,
  canOpenWorkspace,
  onOpenContract,
  onOpenWorkspace,
  onRefreshStatus,
  formatDate,
}: RequestContractHandoffPanelProps) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-xl font-semibold">Finalize Project & Contract</h2>
      </CardHeader>
      <CardContent>
        {currentPhase < 5 ? (
          <div className="rounded-lg border-2 border-dashed bg-muted/20 py-12 text-center">
            <p className="text-muted-foreground">Complete final spec 3-party sign-off to generate contract.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-lg border bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground">
                Phase 5 uses the actual contract record generated from the fully signed Final Spec.
              </p>
            </div>

            {canOpenContract ? (
              <div className="rounded-lg border bg-background p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{linkedContract?.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      Created {formatDate(linkedContract?.createdAt, "PPP")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {contractActivated
                        ? "Project activated. Continue execution in workspace."
                        : "Signatures or activation are still in progress."}
                    </p>
                  </div>
                  <Badge variant={linkedContract?.status === "SIGNED" ? "default" : "outline"}>
                    {linkedContract?.status || "DRAFT"}
                  </Badge>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button onClick={onOpenContract}>Open Contract</Button>
                  {canOpenWorkspace ? <Button onClick={onOpenWorkspace}>Open Workspace</Button> : null}
                  <Button variant="outline" onClick={onRefreshStatus}>
                    Refresh Status
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <h3 className="font-semibold text-amber-900">Contract not initialized yet</h3>
                <p className="mt-1 text-sm text-amber-800">
                  Broker must click <strong>Create Contract</strong> after Final Spec reaches <strong>ALL_SIGNED</strong>.
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
