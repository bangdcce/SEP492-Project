import type { ContractSummary } from "@/features/contracts/types";
import type { ProjectSpec } from "@/features/project-specs/types";
import { ProjectSpecStatus } from "@/features/project-specs/types";

export type RequestActionCard = {
  title: string;
  description: string;
  ctaLabel: string;
  onClick: () => void;
};

type BuildClientNextActionInput = {
  currentPhase: number;
  clientSpec: ProjectSpec | null;
  fullSpec: ProjectSpec | null;
  hasAcceptedFreelancer: boolean;
  linkedContract: ContractSummary | null;
  canOpenContract: boolean;
  canOpenWorkspace: boolean;
  onRefresh: () => void;
  onSetPhase: (phase: number) => void;
  onOpenClientSpec: (specId: string) => void;
  onOpenFullSpec: (specId: string) => void;
  onOpenContract: (contractId: string) => void;
  onOpenWorkspace: (projectId: string) => void;
};

export const buildClientNextAction = (
  input: BuildClientNextActionInput,
): RequestActionCard => {
  const {
    currentPhase,
    clientSpec,
    fullSpec,
    hasAcceptedFreelancer,
    linkedContract,
    canOpenContract,
    canOpenWorkspace,
    onRefresh,
    onSetPhase,
    onOpenClientSpec,
    onOpenFullSpec,
    onOpenContract,
    onOpenWorkspace,
  } = input;

  if (currentPhase <= 1) {
    return {
      title: "Hire a broker",
      description: "Start by selecting a broker to manage the specification workflow.",
      ctaLabel: "Go to Phase 1",
      onClick: () => onSetPhase(1),
    };
  }

  if (currentPhase === 2) {
    if (!clientSpec) {
      return {
        title: "Waiting for Client Spec",
        description: "Broker is preparing the first spec draft for your approval.",
        ctaLabel: "Refresh",
        onClick: onRefresh,
      };
    }

    if (clientSpec.status === ProjectSpecStatus.CLIENT_REVIEW) {
      return {
        title: "Review Client Spec now",
        description: "Approve or reject Client Spec to move to freelancer selection.",
        ctaLabel: "Open Client Spec",
        onClick: () => onOpenClientSpec(clientSpec.id),
      };
    }

    if (clientSpec.status === ProjectSpecStatus.REJECTED) {
      return {
        title: "Waiting broker revision",
        description: "You rejected Client Spec. Broker needs to revise and resubmit.",
        ctaLabel: "Go to Phase 2",
        onClick: () => onSetPhase(2),
      };
    }

    return {
      title: "Client Spec approved",
      description: "Proceed to freelancer selection.",
      ctaLabel: "Go to Phase 3",
      onClick: () => onSetPhase(3),
    };
  }

  if (currentPhase === 3) {
    if (!hasAcceptedFreelancer) {
      return {
        title: "Review broker freelancer recommendations",
        description: "Approve one broker-recommended freelancer before Final Spec sign-off.",
        ctaLabel: "Go to Phase 3",
        onClick: () => onSetPhase(3),
      };
    }

    return {
      title: "Freelancer selected",
      description: "Broker can now submit Final Spec for 3-party sign-off.",
      ctaLabel: "Go to Phase 4",
      onClick: () => onSetPhase(4),
    };
  }

  if (currentPhase === 4) {
    if (!fullSpec) {
      return {
        title: "Waiting for Final Spec draft",
        description: "Broker is preparing the Final Spec from approved scope.",
        ctaLabel: "Refresh",
        onClick: onRefresh,
      };
    }

    if (fullSpec.status === ProjectSpecStatus.FINAL_REVIEW) {
      return {
        title: "Sign Final Spec",
        description: "Client + Broker + Freelancer must sign Final Spec to unlock contract.",
        ctaLabel: "Review & Sign Final Spec",
        onClick: () => onOpenFullSpec(fullSpec.id),
      };
    }

    return {
      title: "Final Spec in progress",
      description: "Continue until all 3 signatures are completed.",
      ctaLabel: "Go to Phase 4",
      onClick: () => onSetPhase(4),
    };
  }

  if (canOpenContract && linkedContract) {
    if (canOpenWorkspace) {
      return {
        title: "Project is active",
        description: "Contract is complete and project workspace is ready.",
        ctaLabel: "Open Workspace",
        onClick: () => onOpenWorkspace(linkedContract.projectId!),
      };
    }

    if (linkedContract.status === "SIGNED") {
      return {
        title: "Waiting for project activation",
        description: "All contract signatures are complete. Broker can activate the project next.",
        ctaLabel: "Open Contract",
        onClick: () => onOpenContract(linkedContract.id),
      };
    }

    return {
      title: "Sign contract",
      description: "Complete remaining signatures to activate project.",
      ctaLabel: "Open Contract",
      onClick: () => onOpenContract(linkedContract.id),
    };
  }

  return {
    title: "Waiting for contract initialization",
    description: "Broker must create contract after Final Spec reaches ALL_SIGNED.",
    ctaLabel: "Go to Phase 5",
    onClick: () => onSetPhase(5),
  };
};
