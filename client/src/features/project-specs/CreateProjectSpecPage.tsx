import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';
import { Button } from '@/shared/components/custom/Button';
import { CreateProjectSpecForm } from './components/CreateProjectSpecForm';
import { projectRequestsApi } from '../project-requests/api';
import { projectSpecsApi } from './api';
import type { ProjectRequest } from '../project-requests/types';
import type { CreateProjectSpecDTO, ProjectSpec } from './types';
import { SpecPhase } from './types';
import Spinner from '@/shared/components/ui/Spinner';
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/Card';

export default function CreateProjectSpecPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [request, setRequest] = useState<ProjectRequest | null>(null);
  const [clientSpec, setClientSpec] = useState<ProjectSpec | null>(null);
  const [existingFullSpec, setExistingFullSpec] = useState<ProjectSpec | null>(null);
  const [createdSpec, setCreatedSpec] = useState<ProjectSpec | null>(null);
  const [isEditingExisting, setIsEditingExisting] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadedExistingSpec, setLoadedExistingSpec] = useState(false);
  const freelancerProposalList = (request as any)?.freelancerProposals || (request as any)?.proposals || [];
  const acceptedFreelancerCount = freelancerProposalList.filter(
    (proposal: any) => String(proposal?.status || '').toUpperCase() === 'ACCEPTED',
  ).length;
  const legacyPendingFreelancerCount = freelancerProposalList.filter(
    (proposal: any) => String(proposal?.status || '').toUpperCase() === 'PENDING',
  ).length;
  const hasSelectedFreelancer =
    acceptedFreelancerCount > 0 ||
    (acceptedFreelancerCount === 0 && legacyPendingFreelancerCount === 1);
  const isEditableFullSpec = (spec: ProjectSpec | null | undefined) =>
    Boolean(spec && (spec.status === 'DRAFT' || spec.status === 'REJECTED'));
  const activeSpec = createdSpec || existingFullSpec;
  const editableDraftSpec = isEditableFullSpec(createdSpec)
    ? createdSpec
    : isEditableFullSpec(existingFullSpec)
      ? existingFullSpec
      : null;
  const formInitialValues = useMemo(
    () =>
      isEditingExisting && editableDraftSpec
        ? {
            requestId: id!,
            parentSpecId: editableDraftSpec.parentSpecId || undefined,
            title: editableDraftSpec.title,
            description: editableDraftSpec.description,
            totalBudget: Number(editableDraftSpec.totalBudget || 0),
            techStack: editableDraftSpec.techStack || '',
            features: (editableDraftSpec.features || []).map((feature) => ({
              title: feature.title,
              description: feature.description,
              complexity: feature.complexity,
              acceptanceCriteria: feature.acceptanceCriteria || [],
              inputOutputSpec: feature.inputOutputSpec || undefined,
            })),
            milestones: [...(editableDraftSpec.milestones || [])]
              .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
              .map((milestone) => ({
                title: milestone.title,
                description: milestone.description,
                amount: Number(milestone.amount || 0),
                deliverableType: milestone.deliverableType,
                retentionAmount: Number(milestone.retentionAmount || 0),
                acceptanceCriteria: milestone.acceptanceCriteria || [],
                sortOrder: milestone.sortOrder,
                startDate: (milestone as any).startDate || undefined,
                dueDate: (milestone as any).dueDate || undefined,
              })),
          }
        : null,
    [editableDraftSpec, id, isEditingExisting],
  );

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [reqData, specs] = await Promise.all([
          projectRequestsApi.getById(id),
          projectSpecsApi.getSpecsByRequest(id),
        ]);
        setRequest(reqData);

        // Find the approved client spec (parent for full spec)
        const approved = specs.find(
          (s) => s.specPhase === SpecPhase.CLIENT_SPEC && s.status === 'CLIENT_APPROVED',
        );
        if (approved) setClientSpec(approved);

        const existingFullSpec = specs.find((s) => {
          if (s.specPhase !== SpecPhase.FULL_SPEC) return false;
          if (approved) return s.parentSpecId === approved.id;
          return true;
        });

        if (existingFullSpec) {
          setExistingFullSpec(existingFullSpec);
          setLoadedExistingSpec(true);
          if (existingFullSpec.status === 'DRAFT' || existingFullSpec.status === 'REJECTED') {
            setCreatedSpec(null);
            setIsEditingExisting(true);
          } else {
            setCreatedSpec(existingFullSpec);
            setIsEditingExisting(false);
          }
        } else {
          setExistingFullSpec(null);
          setCreatedSpec(null);
          setLoadedExistingSpec(false);
          setIsEditingExisting(false);
        }
      } catch (err) {
        console.error('Failed to fetch data:', err);
        setError('Could not load project request details.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleSubmit = async (data: CreateProjectSpecDTO) => {
    try {
      setIsSubmitting(true);
      setSubmitError(null);
      setWarnings([]);

      const shouldSubmitFinalReview = Boolean(clientSpec && data.status === 'PENDING_APPROVAL');
      const createPayload: CreateProjectSpecDTO = shouldSubmitFinalReview
        ? { ...data, status: 'DRAFT' as any }
        : data;
      let newSpec: ProjectSpec;
      let createWarnings: string[] = [];
      const editingSpec =
        isEditingExisting && editableDraftSpec ? editableDraftSpec : null;

      if (editingSpec) {
        const response = await projectSpecsApi.updateFullSpec(editingSpec.id, {
          ...createPayload,
          parentSpecId: editingSpec.parentSpecId || clientSpec?.id || undefined,
        });
        newSpec = response.spec;
        createWarnings = response.warnings || [];
      } else if (clientSpec) {
        // Phase 2: Create full spec linked to parent client spec
        const response = await projectSpecsApi.createFullSpec({
          ...createPayload,
          parentSpecId: clientSpec.id,
        });
        newSpec = response.spec;
        createWarnings = response.warnings || [];
      } else {
        // Legacy: No client spec exists, create directly
        const response = await projectSpecsApi.createSpec(createPayload);
        newSpec = response.spec;
        createWarnings = response.warnings || [];
      }

      if (shouldSubmitFinalReview) {
        newSpec = await projectSpecsApi.submitForFinalReview(newSpec.id);
      }

      setWarnings(createWarnings);
      setCreatedSpec(newSpec);
      setExistingFullSpec(newSpec);
      setLoadedExistingSpec(Boolean(editingSpec) || loadedExistingSpec);
      setIsEditingExisting(false);
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Failed to save project specification.';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitForFinalReview = async () => {
    const targetSpec = activeSpec;
    if (!targetSpec) return;
    if (clientSpec && !hasSelectedFreelancer) {
      setSubmitError(
        'Freelancer must accept invitation before submitting full spec for final review. You can keep drafting and save the full spec now.',
      );
      return;
    }
    try {
      setIsSubmitting(true);
      setSubmitError(null);
      const updated = await projectSpecsApi.submitForFinalReview(targetSpec.id);
      setCreatedSpec(updated);
      setExistingFullSpec(updated);
      setIsEditingExisting(false);
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Failed to submit full spec for final review.';
      setSubmitError(message);
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

  if (!request) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error || 'Request not found'}</AlertDescription>
        </Alert>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/broker/project-requests')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Requests
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" className="h-9 w-9 p-0" onClick={() => navigate(`/broker/project-requests/${id}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create Full Specification</h1>
          <p className="text-muted-foreground">For request: {request.title}</p>
        </div>
        {clientSpec && (
          <Badge variant="secondary" className="ml-auto text-xs">
            Phase 2 — Technical Spec
          </Badge>
        )}
      </div>

      {/* Show approved Client Spec summary as context */}
      {clientSpec && (
        <Card className="border-green-200 bg-green-50/30">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-green-600" />
              <CardTitle className="text-sm text-green-700">
                Client Spec (Approved)
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p><strong>Title:</strong> {clientSpec.title}</p>
            <p className="text-muted-foreground line-clamp-3">{clientSpec.description}</p>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>Budget: ${clientSpec.totalBudget?.toLocaleString()}</span>
              <span>Timeline: {clientSpec.estimatedTimeline || '—'}</span>
              {clientSpec.clientFeatures && (
                <span>{clientSpec.clientFeatures.length} features</span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Warning if no client spec */}
      {!clientSpec && (
        <Alert>
          <AlertTitle>No Client Spec Found</AlertTitle>
          <AlertDescription>
            No approved client specification was found for this request. You can still
            create a full spec directly, but the recommended flow is to create a Client
            Spec first for client approval.
          </AlertDescription>
        </Alert>
      )}

      {clientSpec && !hasSelectedFreelancer && (
        <Alert>
          <AlertTitle>Draft first, submit later</AlertTitle>
          <AlertDescription>
            You can draft the full spec now. Submitting for final review is locked until a freelancer accepts the invitation.
          </AlertDescription>
        </Alert>
      )}

      {submitError && (
        <Alert variant="destructive">
          <AlertTitle>Submission Error</AlertTitle>
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      {loadedExistingSpec && activeSpec && !isEditingExisting && (
        <Alert>
          <AlertTitle>Existing full spec loaded</AlertTitle>
          <AlertDescription>
            A full spec already exists for this request, so this page loaded the existing record instead of creating a new one.
          </AlertDescription>
        </Alert>
      )}

      {warnings.length > 0 && (
        <Alert>
          <AlertTitle>Governance Warnings</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {(isEditingExisting || !activeSpec) && (
        <CreateProjectSpecForm
          requestId={id!}
          projectRequest={request}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          isPhasedFlow={Boolean(clientSpec)}
          initialValues={formInitialValues}
          submitLabel={isEditingExisting ? 'Update Full Spec Draft' : undefined}
        />
      )}

      {activeSpec && !isEditingExisting && (
        <Card>
          <CardHeader>
            <CardTitle>{loadedExistingSpec ? 'Full spec details' : 'Full spec created'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Spec ID: {activeSpec.id} · Current status: <strong>{activeSpec.status}</strong>
            </p>

            {clientSpec && activeSpec.status !== 'FINAL_REVIEW' && hasSelectedFreelancer && (
              <Alert>
                <AlertTitle>Next step</AlertTitle>
                <AlertDescription>
                  Submit this full spec for 3-party final review so Client, Broker, and Freelancer can sign.
                </AlertDescription>
              </Alert>
            )}

            {clientSpec && activeSpec.status !== 'FINAL_REVIEW' && !hasSelectedFreelancer && (
              <Alert>
                <AlertTitle>Waiting for freelancer acceptance</AlertTitle>
                <AlertDescription>
                  Full spec draft is saved. Invite/select a freelancer first, then submit for final review.
                </AlertDescription>
              </Alert>
            )}

            {activeSpec.status === 'FINAL_REVIEW' && (
              <Alert>
                <AlertTitle>Submitted for final review</AlertTitle>
                <AlertDescription>
                  The full spec is ready for 3-party signing.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap gap-3">
              {(activeSpec.status === 'DRAFT' || activeSpec.status === 'REJECTED') && (
                <Button variant="outline" onClick={() => setIsEditingExisting(true)} disabled={isSubmitting}>
                  Edit Draft
                </Button>
              )}
              {clientSpec && (activeSpec.status === 'DRAFT' || activeSpec.status === 'REJECTED') && (
                <Button onClick={handleSubmitForFinalReview} disabled={isSubmitting || !hasSelectedFreelancer}>
                  {isSubmitting ? 'Submitting...' : 'Submit For Final Review'}
                </Button>
              )}
              <Button variant="outline" onClick={() => navigate(`/broker/project-requests/${id}`)}>
                Return To Request
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
