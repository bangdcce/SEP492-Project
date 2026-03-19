import type { ContractSummary } from "@/features/contracts/types";
import type { ProjectSpec } from "@/features/project-specs/types";
import { ProjectSpecStatus, SpecPhase } from "@/features/project-specs/types";
import type {
  FreelancerProposalItem,
  ProjectRequest,
  RequestFlowSnapshot,
} from "./types";

export const pickLatestSpecByPhase = (
  specs: ProjectSpec[],
  phase: SpecPhase,
): ProjectSpec | null =>
  [...specs]
    .filter((spec) => spec.specPhase === phase)
    .sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt).getTime() -
        new Date(a.updatedAt || a.createdAt).getTime(),
    )[0] ?? null;

export const isContractActivated = (contract?: ContractSummary | null) => {
  if (!contract) return false;
  const normalizedProjectStatus = String(contract.projectStatus || "").toUpperCase();
  return (
    Boolean(contract.activatedAt) ||
    ["IN_PROGRESS", "TESTING", "COMPLETED", "PAID", "DISPUTED"].includes(
      normalizedProjectStatus,
    )
  );
};

export const formatHumanStatus = (status?: string | null) =>
  String(status || "UNKNOWN").replace(/_/g, " ");

export const getSelectedFreelancerProposal = (
  request?: Pick<ProjectRequest, "freelancerSelectionSummary" | "freelancerProposals" | "proposals"> | null,
): FreelancerProposalItem | null => {
  if (request?.freelancerSelectionSummary?.selectedFreelancer) {
    return request.freelancerSelectionSummary.selectedFreelancer;
  }

  const proposals = request?.freelancerProposals || request?.proposals || [];
  return (
    proposals.find((proposal) => String(proposal?.status || "").toUpperCase() === "ACCEPTED") ||
    proposals.find((proposal) => String(proposal?.status || "").toUpperCase() === "PENDING") ||
    null
  );
};

export const buildFallbackFlowSnapshot = (
  request?: ProjectRequest | null,
  flow?: { clientSpec: ProjectSpec | null; fullSpec: ProjectSpec | null },
  linkedContract?: ContractSummary | null,
): RequestFlowSnapshot => {
  if (!request) {
    return {
      phase: "REQUEST_INTAKE",
      phaseNumber: 1,
      status: "DRAFT",
      brokerAssigned: false,
      freelancerSelected: false,
      linkedContractId: null,
      linkedProjectId: null,
      contractActivated: false,
      readOnly: false,
      nextAction: "SELECT_BROKER",
      clientSpecStatus: null,
      fullSpecStatus: null,
    };
  }

  const derivedSpecs = request.specs || [];
  const clientSpec =
    flow?.clientSpec ??
    (derivedSpecs.length > 0 ? pickLatestSpecByPhase(derivedSpecs, SpecPhase.CLIENT_SPEC) : null);
  const fullSpec =
    flow?.fullSpec ??
    (derivedSpecs.length > 0 ? pickLatestSpecByPhase(derivedSpecs, SpecPhase.FULL_SPEC) : null);
  const selectedFreelancer = getSelectedFreelancerProposal(request);
  const contractActivated = isContractActivated(linkedContract);
  const linkedProjectId = request.linkedProjectSummary?.id ?? request.requestProgress?.linkedProjectId ?? null;
  const linkedContractId = linkedContract?.id ?? request.linkedContractSummary?.id ?? request.requestProgress?.linkedContractId ?? null;

  let phase: RequestFlowSnapshot["phase"] = linkedProjectId
    ? "PROJECT_CREATED"
    : linkedContractId || contractActivated
      ? "CONTRACT"
      : request.status === "SPEC_APPROVED" || request.status === "HIRING"
        ? "FREELANCER_SELECTION"
        : request.status === "BROKER_ASSIGNED" || request.status === "PENDING_SPECS" || request.status === "SPEC_SUBMITTED"
          ? "SPEC_WORKFLOW"
          : "REQUEST_INTAKE";

  if (fullSpec?.status === ProjectSpecStatus.FINAL_REVIEW) {
    phase = "FINAL_SPEC_REVIEW";
  } else if (fullSpec?.status === ProjectSpecStatus.ALL_SIGNED) {
    phase = linkedContractId ? "CONTRACT" : "FINAL_SPEC_REVIEW";
  } else if (clientSpec?.status === ProjectSpecStatus.CLIENT_REVIEW) {
    phase = "SPEC_WORKFLOW";
  }

  const phaseNumber =
    phase === "REQUEST_INTAKE"
      ? 1
      : phase === "SPEC_WORKFLOW"
        ? 2
        : phase === "FREELANCER_SELECTION"
          ? 3
          : phase === "FINAL_SPEC_REVIEW"
            ? 4
            : 5;

  return {
    phase,
    phaseNumber,
    status: request.status,
    brokerAssigned: Boolean(request.brokerId),
    freelancerSelected: Boolean(selectedFreelancer),
    clientSpecStatus: clientSpec?.status ?? null,
    fullSpecStatus: fullSpec?.status ?? null,
    linkedContractId,
    linkedProjectId,
    contractActivated,
    readOnly: Boolean(linkedProjectId),
    nextAction:
      phaseNumber === 1
        ? "SELECT_BROKER"
        : phaseNumber === 2
          ? "REVIEW_OR_PREPARE_SPEC"
          : phaseNumber === 3
            ? "SELECT_FREELANCER"
            : phaseNumber === 4
              ? "FINALIZE_SPEC"
              : linkedProjectId
                ? "OPEN_PROJECT"
                : "COMPLETE_CONTRACT_HANDOFF",
  };
};

export const resolveRequestFlowSnapshot = (
  request?: ProjectRequest | null,
  flow?: { clientSpec: ProjectSpec | null; fullSpec: ProjectSpec | null },
  linkedContract?: ContractSummary | null,
) => request?.flowSnapshot ?? buildFallbackFlowSnapshot(request, flow, linkedContract);
