import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import Spinner from '@/shared/components/ui/Spinner';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/Card';
import { projectRequestsApi } from '../project-requests/api';
import type { ProjectRequest } from '../project-requests/types';
import { projectSpecsApi } from './api';
import type { CreateClientSpecDTO, ProjectSpec } from './types';
import { SpecPhase } from './types';
import { CreateClientSpecForm } from './components/CreateClientSpecForm';

export default function CreateClientSpecPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [request, setRequest] = useState<ProjectRequest | null>(null);
  const [existingClientSpec, setExistingClientSpec] = useState<ProjectSpec | null>(null);
  const [createdSpec, setCreatedSpec] = useState<ProjectSpec | null>(null);
  const [isEditingExisting, setIsEditingExisting] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      try {
        setIsLoading(true);
        const [requestData, specs] = await Promise.all([
          projectRequestsApi.getById(id),
          projectSpecsApi.getSpecsByRequest(id),
        ]);
        setRequest(requestData);
        const clientSpec = specs.find((spec) => spec.specPhase === SpecPhase.CLIENT_SPEC) || null;
        setExistingClientSpec(clientSpec);
      } catch (fetchError) {
        console.error(fetchError);
        setError('Could not load request details.');
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [id]);

  const handleCreateClientSpec = async (payload: CreateClientSpecDTO) => {
    try {
      setIsSubmitting(true);
      setError(null);
      const canEditExisting =
        existingClientSpec &&
        (existingClientSpec.status === 'DRAFT' || existingClientSpec.status === 'REJECTED');

      const response = canEditExisting && isEditingExisting
        ? await projectSpecsApi.updateClientSpec(existingClientSpec.id, payload)
        : await projectSpecsApi.createClientSpec(payload);
      setCreatedSpec(response.spec);
      setWarnings(response.warnings || []);
      setIsEditingExisting(false);
    } catch (submitError: any) {
      const message = submitError?.response?.data?.message || 'Failed to create client spec.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitForReview = async () => {
    const targetSpec = createdSpec || existingClientSpec;
    if (!targetSpec) return;
    try {
      setIsSubmitting(true);
      await projectSpecsApi.submitForClientReview(targetSpec.id);
      navigate(`/broker/project-requests/${id}`);
    } catch (submitError: any) {
      const message = submitError?.response?.data?.message || 'Failed to submit for client review.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditExistingSpec = () => {
    if (!existingClientSpec) return;
    setWarnings([]);
    setCreatedSpec(null);
    setError(null);
    setIsEditingExisting(true);
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
      </div>
    );
  }

  const editableExistingSpec =
    existingClientSpec &&
    (existingClientSpec.status === 'DRAFT' || existingClientSpec.status === 'REJECTED')
      ? existingClientSpec
      : null;

  const formInitialValues = isEditingExisting && editableExistingSpec
    ? {
        requestId: id!,
        title: editableExistingSpec.title,
        description: editableExistingSpec.description,
        estimatedBudget: Number(editableExistingSpec.totalBudget || 0),
        estimatedTimeline: editableExistingSpec.estimatedTimeline || '',
        projectCategory: editableExistingSpec.projectCategory || undefined,
        clientFeatures: (editableExistingSpec.clientFeatures || []).map((feature) => ({
          title: feature.title,
          description: feature.description,
          priority: feature.priority,
        })),
        referenceLinks: editableExistingSpec.referenceLinks || [],
      }
    : null;

  return (
    <div className="container mx-auto max-w-5xl space-y-6 py-8">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => navigate(`/broker/project-requests/${id}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Create Client Spec</h1>
          <p className="text-sm text-muted-foreground">Request: {request.title}</p>
        </div>
      </div>

      {existingClientSpec && !createdSpec && !isEditingExisting && (
        <Alert>
          <AlertTitle>Client spec already exists</AlertTitle>
          <AlertDescription>
            <div className="space-y-3">
              <p>
                Existing Client Spec status: <strong>{existingClientSpec.status}</strong>. You can continue
                with the existing one.
              </p>
              <div>
                {editableExistingSpec ? (
                  <Button type="button" variant="outline" size="sm" onClick={handleEditExistingSpec}>
                    Edit Existing Client Spec
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/broker/specs/${existingClientSpec.id}`)}
                  >
                    View Existing Client Spec
                  </Button>
                )}
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
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

      {!createdSpec && (!existingClientSpec || isEditingExisting) && (
        <CreateClientSpecForm
          requestId={id!}
          onSubmit={handleCreateClientSpec}
          isSubmitting={isSubmitting}
          initialValues={formInitialValues}
          submitLabel={isEditingExisting ? 'Update Client Spec' : 'Create Client Spec'}
          requestBudgetRange={request.budgetRange}
        />
      )}

      {createdSpec && (
        <Card>
          <CardHeader>
            <CardTitle>
              {existingClientSpec && createdSpec.id === existingClientSpec.id
                ? 'Client spec draft updated'
                : 'Client spec draft created'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Draft ID: {createdSpec.id}. Next step is submitting it for client review.
            </p>
            <div className="flex gap-3">
              <Button onClick={handleSubmitForReview} disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Submit For Client Review'}
              </Button>
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
