import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import Spinner from '@/shared/components/ui/Spinner';
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/Card';
import { Badge } from '@/shared/components/ui/badge';
import { Textarea } from '@/shared/components/ui/textarea';
import { projectSpecsApi } from './api';
import type { ProjectSpec } from './types';
import { ProjectSpecStatus, SpecPhase } from './types';
import { STORAGE_KEYS } from '@/constants';
import { getStoredJson } from '@/shared/utils/storage';
import { SpecSignPanel } from './components/SpecSignPanel';

export default function ClientSpecReviewPage() {
  const { specId } = useParams<{ specId: string }>();
  const navigate = useNavigate();
  const currentUser = getStoredJson(STORAGE_KEYS.USER) as { id?: string; role?: string } | null;

  const [spec, setSpec] = useState<ProjectSpec | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
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
  const showClientReviewActions =
    isClientViewer &&
    spec.specPhase === SpecPhase.CLIENT_SPEC &&
    spec.status === ProjectSpecStatus.CLIENT_REVIEW;
  const showFinalSignActions =
    spec.specPhase === SpecPhase.FULL_SPEC && spec.status === ProjectSpecStatus.FINAL_REVIEW;
  const sortedMilestones = [...(spec.milestones || [])].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
  );
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
              <p className="text-xs text-muted-foreground">Category</p>
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

                    {(milestone.startDate || milestone.dueDate) && (
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-md border p-3">
                          <p className="text-xs text-muted-foreground">Start Date</p>
                          <p className="text-sm font-medium">{milestone.startDate || '—'}</p>
                        </div>
                        <div className="rounded-md border p-3">
                          <p className="text-xs text-muted-foreground">Due Date</p>
                          <p className="text-sm font-medium">{milestone.dueDate || '—'}</p>
                        </div>
                      </div>
                    )}

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
        <SpecSignPanel
          spec={spec}
          currentUserId={currentUser?.id}
          isSigning={isSubmitting}
          onSign={handleSignFullSpec}
        />
      )}
    </div>
  );
}
