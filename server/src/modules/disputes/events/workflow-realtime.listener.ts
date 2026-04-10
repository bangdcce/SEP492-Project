import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DisputeGateway } from '../gateways/dispute.gateway';

type WorkflowRealtimePayload = {
  userId?: string | null;
  requestId?: string | null;
  specId?: string | null;
  contractId?: string | null;
  projectId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
};

@Injectable()
export class WorkflowRealtimeListener {
  constructor(private readonly disputeGateway: DisputeGateway) {}

  @OnEvent('request.updated')
  handleRequestUpdated(payload: WorkflowRealtimePayload) {
    if (!payload?.userId || !payload.requestId) {
      return;
    }

    this.disputeGateway.emitUserEvent(payload.userId, 'REQUEST_UPDATED', {
      requestId: payload.requestId,
      entityType: payload.entityType ?? 'ProjectRequest',
      entityId: payload.entityId ?? payload.requestId,
    });
  }

  @OnEvent('spec.updated')
  handleSpecUpdated(payload: WorkflowRealtimePayload) {
    if (!payload?.userId || !payload.specId) {
      return;
    }

    this.disputeGateway.emitUserEvent(payload.userId, 'SPEC_UPDATED', {
      specId: payload.specId,
      requestId: payload.requestId ?? null,
      entityType: payload.entityType ?? 'ProjectSpec',
      entityId: payload.entityId ?? payload.specId,
    });
  }

  @OnEvent('contract.updated')
  handleContractUpdated(payload: WorkflowRealtimePayload) {
    if (!payload?.userId || !payload.contractId) {
      return;
    }

    this.disputeGateway.emitUserEvent(payload.userId, 'CONTRACT_UPDATED', {
      contractId: payload.contractId,
      projectId: payload.projectId ?? null,
      requestId: payload.requestId ?? null,
      entityType: payload.entityType ?? 'Contract',
      entityId: payload.entityId ?? payload.contractId,
    });
  }

  @OnEvent('project.updated')
  handleProjectUpdated(payload: WorkflowRealtimePayload) {
    if (!payload?.userId || !payload.projectId) {
      return;
    }

    this.disputeGateway.emitUserEvent(payload.userId, 'PROJECT_UPDATED', {
      projectId: payload.projectId,
      requestId: payload.requestId ?? null,
      entityType: payload.entityType ?? 'Project',
      entityId: payload.entityId ?? payload.projectId,
    });
  }
}
