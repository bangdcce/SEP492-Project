import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import Spinner from '@/shared/components/ui/spinner';
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Textarea } from '@/shared/components/ui/textarea';
import { projectSpecsApi } from './api';
import type { ProjectSpec } from './types';
import { ProjectSpecStatus, SpecPhase } from './types';
import { SpecSignPanel } from './components/SpecSignPanel';
import {
  SpecNarrativeRenderer,
  narrativeHasContent,
} from '@/shared/components/rich-text/SpecNarrative';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import type {
  ClientFeatureDTO,
  ReferenceLinkDTO,
  SpecFeatureDTO,
  SpecSubmissionSnapshot,
} from './types';
import { getProductTypeLabel } from '@/shared/utils/productType';

const formatCurrency = (value?: number | null) =>
  typeof value === 'number' && Number.isFinite(value)
    ? `$${Number(value).toLocaleString()}`
    : 'Not set';

const formatDateValue = (value?: string | null) => {
  const normalized = String(value || '').trim();
  if (!normalized) return 'Not set';
  const parsed = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(normalized)
      ? `${normalized}T00:00:00.000Z`
      : normalized,
  );
  if (Number.isNaN(parsed.getTime())) {
    return normalized;
  }
  return parsed.toLocaleDateString();
};

const renderFeatureCards = (
  features?: ClientFeatureDTO[] | null,
  emptyLabel = 'No scope items.',
) => {
  if (!features?.length) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-3">
      {features.map((feature, index) => (
        <div key={feature.id || `${feature.title}-${index}`} className="rounded-md border bg-white p-3">
          <div className="mb-2 flex items-start justify-between gap-3">
            <p className="font-medium text-slate-900">{feature.title}</p>
            <Badge variant="outline">{feature.priority.replace(/_/g, ' ')}</Badge>
          </div>
          <p className="text-sm whitespace-pre-wrap text-slate-600">{feature.description}</p>
        </div>
      ))}
    </div>
  );
};

const renderReferenceLinks = (
  links?: ReferenceLinkDTO[] | null,
  emptyLabel = 'No reference links.',
) => {
  if (!links?.length) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-2">
      {links.map((link, index) => (
        <a
          key={`${link.url}-${index}`}
          href={link.url}
          target="_blank"
          rel="noreferrer"
          className="block rounded-md border bg-white px-3 py-2 text-sm text-blue-700 underline-offset-2 hover:underline"
        >
          {link.label || link.url}
        </a>
      ))}
    </div>
  );
};

const renderTechnicalFeatures = (
  features?: SpecFeatureDTO[] | null,
  emptyLabel = 'No technical features.',
) => {
  if (!features?.length) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-3">
      {features.map((feature, index) => (
        <div key={feature.id || `${feature.title}-${index}`} className="rounded-md border bg-white p-3">
          <div className="mb-2 flex items-start justify-between gap-3">
            <p className="font-medium text-slate-900">{feature.title}</p>
            <Badge variant="outline">{feature.complexity}</Badge>
          </div>
          <p className="text-sm whitespace-pre-wrap text-slate-600">{feature.description}</p>
          {feature.acceptanceCriteria?.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
              {feature.acceptanceCriteria.map((criteria, criteriaIndex) => (
                <li key={`${feature.title}-${criteriaIndex}`}>{criteria}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </div>
  );
};

const renderMilestones = (
  milestones?: SpecSubmissionSnapshot['milestones'] | null,
  emptyLabel = 'No milestones.',
) => {
  if (!milestones?.length) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-3">
      {milestones.map((milestone, index) => (
        <div key={`${milestone.title}-${index}`} className="rounded-md border bg-white p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Milestone {index + 1}
              </p>
              <p className="font-medium text-slate-900">{milestone.title}</p>
            </div>
            <p className="font-semibold text-slate-900">{formatCurrency(milestone.amount)}</p>
          </div>
          <p className="mt-2 text-sm whitespace-pre-wrap text-slate-600">
            {milestone.description}
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="rounded-md bg-slate-50 px-3 py-2 text-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Schedule</p>
              <p className="font-medium text-slate-900">
                {formatDateValue(milestone.startDate)} to {formatDateValue(milestone.dueDate)}
              </p>
            </div>
            <div className="rounded-md bg-slate-50 px-3 py-2 text-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Deliverable</p>
              <p className="font-medium text-slate-900">
                {milestone.deliverableType.replace(/_/g, ' ')}
              </p>
            </div>
            <div className="rounded-md bg-slate-50 px-3 py-2 text-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Warranty Hold</p>
              <p className="font-medium text-slate-900">
                {formatCurrency(milestone.retentionAmount)}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const diffClientFeatures = (
  previousFeatures?: ClientFeatureDTO[] | null,
  currentFeatures?: ClientFeatureDTO[] | null,
) => {
  const previousMap = new Map(
    (previousFeatures || []).map((feature, index) => [
      feature.id || `${feature.title}-${index}`,
      feature,
    ]),
  );
  const currentMap = new Map(
    (currentFeatures || []).map((feature, index) => [
      feature.id || `${feature.title}-${index}`,
      feature,
    ]),
  );

  const added = [...currentMap.entries()]
    .filter(([key]) => !previousMap.has(key))
    .map(([, feature]) => feature);
  const removed = [...previousMap.entries()]
    .filter(([key]) => !currentMap.has(key))
    .map(([, feature]) => feature);
  const updated = [...currentMap.entries()]
    .filter(([key, feature]) => {
      const previous = previousMap.get(key);
      return previous && JSON.stringify(previous) !== JSON.stringify(feature);
    })
    .map(([key, feature]) => ({
      previous: previousMap.get(key)!,
      current: feature,
    }));

  return { added, removed, updated };
};

const renderDiffValue = (
  field: string,
  value: unknown,
  options?: { previous?: unknown },
): ReactNode => {
  switch (field) {
    case 'title':
    case 'description':
    case 'techStack':
    case 'changeSummary':
      return (
        <div className="rounded-md bg-white p-3 text-sm whitespace-pre-wrap text-slate-700">
          {String(value || 'Not set')}
        </div>
      );
    case 'totalBudget':
      return (
        <div className="rounded-md bg-white p-3 text-sm font-medium text-slate-900">
          {formatCurrency(typeof value === 'number' ? value : Number(value || 0))}
        </div>
      );
    case 'projectCategory':
      return (
        <div className="rounded-md bg-white p-3 text-sm font-medium text-slate-900">
          {getProductTypeLabel(String(value || ''))}
        </div>
      );
    case 'estimatedTimeline':
      return (
        <div className="rounded-md bg-white p-3 text-sm font-medium text-slate-900">
          {formatDateValue(String(value || ''))}
        </div>
      );
    case 'clientFeatures': {
      const previousFeatures = (options?.previous as ClientFeatureDTO[] | null | undefined) || [];
      const currentFeatures = (value as ClientFeatureDTO[] | null | undefined) || [];
      const diff = diffClientFeatures(previousFeatures, currentFeatures);
      return (
        <div className="space-y-3">
          {diff.added.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Added
              </p>
              {renderFeatureCards(diff.added, 'No added scope items.')}
            </div>
          )}
          {diff.updated.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                Updated
              </p>
              {diff.updated.map((item, index) => (
                <div key={`${item.current.id || item.current.title}-${index}`} className="grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Previous</p>
                    {renderFeatureCards([item.previous], 'Not set')}
                  </div>
                  <div>
                    <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Current</p>
                    {renderFeatureCards([item.current], 'Not set')}
                  </div>
                </div>
              ))}
            </div>
          )}
          {diff.removed.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-700">
                Removed
              </p>
              {renderFeatureCards(diff.removed, 'No removed scope items.')}
            </div>
          )}
          {diff.added.length === 0 &&
          diff.updated.length === 0 &&
          diff.removed.length === 0
            ? renderFeatureCards(currentFeatures, 'No scope items.')
            : null}
        </div>
      );
    }
    case 'referenceLinks':
      return renderReferenceLinks(value as ReferenceLinkDTO[] | null | undefined);
    case 'features':
      return renderTechnicalFeatures(value as SpecFeatureDTO[] | null | undefined);
    case 'milestones':
      return renderMilestones(value as SpecSubmissionSnapshot['milestones']);
    default:
      return (
        <div className="rounded-md bg-white p-3 text-sm whitespace-pre-wrap text-slate-700">
          {String(value || 'Not set')}
        </div>
      );
  }
};

export default function ClientSpecReviewPage() {
  const { specId } = useParams<{ specId: string }>();
  const navigate = useNavigate();
  const currentUser = useCurrentUser<{ id?: string; role?: string }>();

  const [spec, setSpec] = useState<ProjectSpec | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [changeRequestReason, setChangeRequestReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadSpec = async () => {
    if (!specId) return;
    try {
      setIsLoading(true);
      const data = await projectSpecsApi.getSpec(specId);
      setSpec(data);
    } catch (fetchError) {
      console.error(fetchError);
      setError('Unable to load spec details.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSpec();
  }, [specId]);

  const handleClientReview = async (action: 'APPROVE' | 'REJECT') => {
    if (!specId) return;
    try {
      setIsSubmitting(true);
      setError(null);
      await projectSpecsApi.clientReviewSpec(
        specId,
        action,
        action === 'REJECT' ? rejectReason : undefined,
      );
      await loadSpec();
    } catch (submitError: any) {
      const message = submitError?.response?.data?.message || 'Failed to review spec.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignFullSpec = async () => {
    if (!specId) return;
    try {
      setIsSubmitting(true);
      setError(null);
      await projectSpecsApi.signSpec(specId);
      await loadSpec();
    } catch (submitError: any) {
      const message = submitError?.response?.data?.message || 'Failed to sign spec.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestFullSpecChanges = async () => {
    if (!specId) return;
    if (changeRequestReason.trim().length < 10) {
      setError('Please provide a change request reason with at least 10 characters.');
      return;
    }
    try {
      setIsSubmitting(true);
      setError(null);
      await projectSpecsApi.requestFullSpecChanges(specId, changeRequestReason.trim());
      setChangeRequestReason('');
      await loadSpec();
    } catch (submitError: any) {
      const message =
        submitError?.response?.data?.message || 'Failed to request changes for this full spec.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!spec) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error || 'Spec not found'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const isClientViewer = ['CLIENT', 'CLIENT_SME', 'SME'].includes(currentUser?.role || '');
  const isBrokerViewer = currentUser?.role === 'BROKER';
  const showClientReviewActions =
    isClientViewer &&
    spec.specPhase === SpecPhase.CLIENT_SPEC &&
    spec.status === ProjectSpecStatus.CLIENT_REVIEW;
  const showFinalSignActions =
    spec.specPhase === SpecPhase.FULL_SPEC && spec.status === ProjectSpecStatus.FINAL_REVIEW;
  const changeRequestReasonTrimmed = changeRequestReason.trim();
  const changeRequestReasonTooShort =
    changeRequestReasonTrimmed.length > 0 && changeRequestReasonTrimmed.length < 10;
  const sortedMilestones = [...(spec.milestones || [])].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
  );
  const requestContext = spec.requestContext || {
    originalRequest: {
      title:
        spec.request?.requestScopeBaseline?.requestTitle ||
        spec.request?.title ||
        null,
      description:
        spec.request?.requestScopeBaseline?.requestDescription ||
        spec.request?.description ||
        null,
      budgetRange: spec.request?.budgetRange || null,
      requestedDeadline:
        spec.request?.requestScopeBaseline?.requestedDeadline ||
        spec.request?.requestedDeadline ||
        spec.request?.intendedTimeline ||
        null,
      productTypeLabel:
        spec.request?.requestScopeBaseline?.productTypeLabel ||
        spec.projectCategory ||
        null,
      projectGoalSummary:
        spec.request?.requestScopeBaseline?.projectGoalSummary || null,
    },
    approvedCommercialBaseline: spec.request?.commercialBaseline
      ? {
          source: spec.request.commercialBaseline.source || null,
          agreedBudget:
            spec.request.commercialBaseline.agreedBudget ?? null,
          agreedDeliveryDeadline:
            spec.request.commercialBaseline.agreedDeliveryDeadline ?? null,
          agreedClientFeatures:
            spec.request.commercialBaseline.agreedClientFeatures || null,
        }
      : null,
  };
  const backPath =
    currentUser?.role === 'BROKER' && spec.requestId
      ? `/broker/project-requests/${spec.requestId}`
      : currentUser?.role === 'FREELANCER' && spec.requestId
        ? `/freelancer/requests/${spec.requestId}`
      : '/client/my-requests';

  return (
    <div className="container mx-auto max-w-5xl space-y-6 py-8">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => navigate(backPath)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Spec Review</h1>
          <p className="text-sm text-muted-foreground">
            Phase: {spec.specPhase} · Status: {spec.status}
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Original Client Request</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Original brief</p>
              <p className="mt-2 font-medium text-slate-950">
                {requestContext.originalRequest.title || 'Not set'}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-slate-600">
                {requestContext.originalRequest.description || 'No original request description.'}
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border bg-slate-50/70 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Budget range</p>
                <p className="mt-1 font-medium">{requestContext.originalRequest.budgetRange || 'Not set'}</p>
              </div>
              <div className="rounded-xl border bg-slate-50/70 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Requested Deadline</p>
                <p className="mt-1 font-medium">
                  {formatDateValue(requestContext.originalRequest.requestedDeadline)}
                </p>
              </div>
              <div className="rounded-xl border bg-slate-50/70 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Product Type</p>
                <p className="mt-1 font-medium">
                  {getProductTypeLabel(requestContext.originalRequest.productTypeLabel || '')}
                </p>
              </div>
              <div className="rounded-xl border bg-slate-50/70 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Project Goal</p>
                <p className="mt-1 font-medium">
                  {requestContext.originalRequest.projectGoalSummary || 'Not set'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Approved Commercial Baseline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-700">Current source</p>
              <p className="mt-2 font-medium text-emerald-950">
                {requestContext.approvedCommercialBaseline?.source || 'Pending client approval'}
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border bg-slate-50/70 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Agreed Budget</p>
                <p className="mt-1 font-medium">
                  {formatCurrency(requestContext.approvedCommercialBaseline?.agreedBudget ?? null)}
                </p>
              </div>
              <div className="rounded-xl border bg-slate-50/70 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Agreed Delivery Deadline</p>
                <p className="mt-1 font-medium">
                  {formatDateValue(
                    requestContext.approvedCommercialBaseline?.agreedDeliveryDeadline ?? null,
                  )}
                </p>
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                Approved Client Features
              </p>
              {renderFeatureCards(
                requestContext.approvedCommercialBaseline?.agreedClientFeatures || null,
                'No approved commercial baseline features yet.',
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {spec.status === ProjectSpecStatus.REJECTED && spec.rejectionReason && (
          <Alert>
            <AlertTitle>
              {spec.specPhase === SpecPhase.CLIENT_SPEC
                ? 'Client requested revisions'
                : 'Changes were requested'}
            </AlertTitle>
            <AlertDescription>{spec.rejectionReason}</AlertDescription>
          </Alert>
        )}

      {(spec.submissionVersion || spec.changeSummary || (spec.lastSubmittedDiff?.length ?? 0) > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Revision Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Submission Version</p>
                <p className="font-medium">v{spec.submissionVersion || 1}</p>
              </div>
              <div className="rounded-md border p-3 md:col-span-2">
                <p className="text-xs text-muted-foreground">Broker Change Summary</p>
                <p className="font-medium whitespace-pre-wrap">
                  {spec.changeSummary || 'No broker change summary was provided for this version.'}
                </p>
              </div>
            </div>

            {spec.lastSubmittedDiff?.length ? (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-900">Changed Fields</p>
                {spec.lastSubmittedDiff.map((entry, index) => (
                  <div key={`${entry.field}-${index}`} className="rounded-md border bg-slate-50/60 p-4">
                    <div className="mb-3">
                      <p className="font-medium text-slate-900">{entry.label}</p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Previous</p>
                        {renderDiffValue(entry.field, entry.previous)}
                      </div>
                      <div>
                        <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Current</p>
                        {renderDiffValue(entry.field, entry.next, { previous: entry.previous })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {spec.rejectionHistory?.length ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-900">Revision History</p>
                {spec.rejectionHistory.map((entry, index) => (
                  <div key={`${entry.rejectedAt}-${index}`} className="rounded-md border p-3">
                    <p className="text-sm font-medium">
                      {entry.phase.replace(/_/g, ' ')} rejected on{' '}
                      {new Date(entry.rejectedAt).toLocaleString()}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                      {entry.reason}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {isBrokerViewer &&
        spec.specPhase === SpecPhase.CLIENT_SPEC &&
        (spec.status === ProjectSpecStatus.DRAFT || spec.status === ProjectSpecStatus.REJECTED) && (
          <Card>
            <CardHeader>
              <CardTitle>
                {spec.status === ProjectSpecStatus.REJECTED ? 'Revise and resubmit' : 'Continue drafting'}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {spec.status === ProjectSpecStatus.REJECTED
                  ? 'Update the client spec based on the rejection reason, then submit it again for client review.'
                  : 'Keep editing this draft until it is ready to send to the client for review.'}
              </p>
              <Button onClick={() => navigate(`/broker/project-requests/${spec.requestId}/create-client-spec`)}>
                {spec.status === ProjectSpecStatus.REJECTED ? 'Revise Client Spec' : 'Edit Draft'}
              </Button>
            </CardContent>
          </Card>
        )}

      <Card>
        <CardHeader>
          <CardTitle>{spec.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{spec.description}</p>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Budget</p>
              <p className="font-medium">${Number(spec.totalBudget || 0).toLocaleString()}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Timeline</p>
              <p className="font-medium">{spec.estimatedTimeline || '—'}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Product Type</p>
              <p className="font-medium">{spec.projectCategory || '—'}</p>
            </div>
          </div>
          {spec.specPhase === SpecPhase.FULL_SPEC && (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Tech Stack</p>
                <p className="font-medium whitespace-pre-wrap">{spec.techStack || '—'}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Milestones</p>
                <p className="font-medium">{sortedMilestones.length}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {spec.specPhase === SpecPhase.CLIENT_SPEC && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Client Scope Items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {spec.clientFeatures && spec.clientFeatures.length > 0 ? (
                spec.clientFeatures.map((feature, index) => (
                  <div key={`${feature.title}-${index}`} className="rounded-md border p-3">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <h3 className="font-medium">{feature.title}</h3>
                      <Badge variant="outline">{feature.priority.replace(/_/g, ' ')}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {feature.description}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No scope items listed.</p>
              )}
            </CardContent>
          </Card>

        </>
      )}

      {spec.specPhase === SpecPhase.FULL_SPEC && (
        <>
          {narrativeHasContent(spec.richContentJson || null) && (
            <Card>
              <CardHeader>
                <CardTitle>Detailed Scope Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <SpecNarrativeRenderer value={spec.richContentJson || null} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Technical Features & Acceptance Criteria</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {spec.features && spec.features.length > 0 ? (
                spec.features.map((feature, index) => (
                  <div key={`${feature.title}-${index}`} className="rounded-md border p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-medium">{feature.title}</h3>
                      <Badge variant="outline">{feature.complexity}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {feature.description}
                    </p>
                    {feature.acceptanceCriteria && feature.acceptanceCriteria.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Acceptance Criteria
                        </p>
                        <div className="space-y-2">
                          {feature.acceptanceCriteria.map((criteria, criteriaIndex) => (
                            <div
                              key={`${feature.title}-criteria-${criteriaIndex}`}
                              className="flex items-start gap-2 rounded-md bg-muted/30 p-2 text-sm"
                            >
                              <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                              <span className="whitespace-pre-wrap">{criteria}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No detailed technical features listed.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Milestones & Payment Schedule</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {sortedMilestones.length > 0 ? (
                sortedMilestones.map((milestone, index) => (
                  <div key={milestone.id} className="rounded-md border p-4 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Milestone {index + 1}
                          {typeof milestone.sortOrder === 'number'
                            ? ` · Order ${milestone.sortOrder + 1}`
                            : ''}
                        </p>
                        <h3 className="font-medium">{milestone.title}</h3>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Amount</p>
                        <p className="font-semibold">
                          ${Number(milestone.amount || 0).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {milestone.description}
                    </p>

                    <div className="grid gap-3 md:grid-cols-4">
                      <div className="rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">Deliverable</p>
                        <p className="text-sm font-medium">{milestone.deliverableType}</p>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">Retention</p>
                        <p className="text-sm font-medium">
                          ${Number(milestone.retentionAmount || 0).toLocaleString()}
                        </p>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">Duration</p>
                        <p className="text-sm font-medium">
                          {milestone.duration ? `${milestone.duration} days` : '—'}
                        </p>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">Status</p>
                        <p className="text-sm font-medium">{milestone.status}</p>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">Start Date</p>
                        <p className="text-sm font-medium">{milestone.startDate || 'Not set'}</p>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">Due Date</p>
                        <p className="text-sm font-medium">{milestone.dueDate || 'Not set'}</p>
                      </div>
                    </div>

                    {milestone.acceptanceCriteria && milestone.acceptanceCriteria.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Milestone Acceptance Criteria
                        </p>
                        <ul className="space-y-2">
                          {milestone.acceptanceCriteria.map((criteria, criteriaIndex) => (
                            <li
                              key={`${milestone.id}-criteria-${criteriaIndex}`}
                              className="rounded-md bg-muted/30 px-3 py-2 text-sm"
                            >
                              {criteria}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No milestones listed.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {spec.referenceLinks && spec.referenceLinks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Reference Links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {spec.referenceLinks.map((link, index) => (
              <a
                key={`${link.url}-${index}`}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-md border p-3 text-sm hover:bg-muted/40"
              >
                <p className="font-medium">{link.label}</p>
                <p className="truncate text-muted-foreground">{link.url}</p>
              </a>
            ))}
          </CardContent>
        </Card>
      )}
      {showClientReviewActions && (
        <Card>
          <CardHeader>
            <CardTitle>Client Decision</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Reason is required when rejecting (minimum 10 chars)"
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
            />
            <div className="flex gap-3">
              <Button onClick={() => handleClientReview('APPROVE')} disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Approve Client Spec'}
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleClientReview('REJECT')}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : 'Reject Client Spec'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showFinalSignActions && (
        <>
          <SpecSignPanel
            spec={spec}
            currentUserId={currentUser?.id}
            isSigning={isSubmitting}
            onSign={handleSignFullSpec}
          />

          <Card>
            <CardHeader>
              <CardTitle>Need changes before signing?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                If the full spec still needs revisions, send it back to the broker with a clear
                reason. Any existing signatures on this review round will be cleared.
              </p>
              <Textarea
                placeholder="Explain what needs to change (minimum 10 characters)"
                value={changeRequestReason}
                onChange={(event) => setChangeRequestReason(event.target.value)}
              />
              {changeRequestReasonTooShort && (
                <p className="text-sm text-amber-700">
                  Please add a bit more detail so the broker knows exactly what to revise.
                </p>
              )}
              <Button
                variant="outline"
                onClick={handleRequestFullSpecChanges}
                disabled={isSubmitting || changeRequestReasonTrimmed.length < 10}
              >
                {isSubmitting ? 'Sending...' : 'Request Changes'}
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
