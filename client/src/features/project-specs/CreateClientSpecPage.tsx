import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import Spinner from '@/shared/components/ui/spinner';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { projectRequestsApi } from '../project-requests/api';
import type { ProjectRequest } from '../project-requests/types';
import { projectSpecsApi } from './api';
import type { CreateClientSpecDTO, ProjectSpec } from './types';
import { SpecPhase } from './types';
import { CreateClientSpecForm } from './components/CreateClientSpecForm';
import {
  CLIENT_SPEC_TEMPLATES,
  getDefaultClientSpecTemplateCode,
} from './templates';
import { RequestAttachmentGallery } from '@/features/requests/components/RequestAttachmentGallery';
import {
  getProductTypeLabel,
  normalizeProductTypeCode,
} from '@/shared/utils/productType';

const FEATURE_LABELS: Record<string, string> = {
  AUTH: 'Authentication',
  PRODUCT_CATALOG: 'Product Catalog & Search',
  CART_PAYMENT: 'Cart & Online Payment',
  BOOKING: 'Booking / Scheduling',
  CHAT: 'Live Chat',
  MAPS: 'Maps & Location',
  BLOG_NEWS: 'Blog & News',
  ADMIN_DASHBOARD: 'Admin Dashboard',
  REPORTING: 'Reporting & Analytics',
  NOTIFICATIONS: 'Notifications',
  MULTI_LANG: 'Multi-language',
};

const normalizeWizardCode = (value?: string | null) =>
  String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .toUpperCase();

const toTitleLabel = (value?: string | null) =>
  String(value || '')
    .trim()
    .replace(/[_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const getFeatureLabel = (value?: string | null) => {
  const normalizedValue = normalizeWizardCode(value);
  return FEATURE_LABELS[normalizedValue] || toTitleLabel(value);
};

const parseBudgetRange = (value?: string | null): { min?: number; max?: number } | null => {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const matches = raw.match(/\d[\d,.]*/g) || [];
  const numbers = matches
    .map((segment) => Number(segment.replace(/[^\d.]/g, '')))
    .filter((number) => Number.isFinite(number) && number > 0);

  if (numbers.length === 0) {
    return null;
  }

  if (raw.includes('+')) {
    return { min: numbers[0] };
  }

  if (numbers.length === 1) {
    return { min: numbers[0], max: numbers[0] };
  }

  return {
    min: Math.min(...numbers),
    max: Math.max(...numbers),
  };
};

const deriveSeedBudget = (request: ProjectRequest | null): number | undefined => {
  const approvedBudget =
    request?.commercialBaseline?.agreedBudget ?? request?.commercialBaseline?.estimatedBudget;
  if (typeof approvedBudget === 'number' && Number.isFinite(approvedBudget) && approvedBudget > 0) {
    return approvedBudget;
  }

  const parsedRange = parseBudgetRange(request?.budgetRange);
  if (!parsedRange) {
    return undefined;
  }

  if (parsedRange.min != null && parsedRange.max != null) {
    return Math.round((parsedRange.min + parsedRange.max) / 2);
  }

  return parsedRange.min;
};
const buildRequestSeedValues = (
  request: ProjectRequest | null,
  requestId?: string,
): Partial<CreateClientSpecDTO> | null => {
  if (!request || !requestId) {
    return null;
  }

  const scopeBaseline = request.requestScopeBaseline;
  const answers = request.answers || [];
  const productTypeAnswer = answers.find((answer) => answer.question?.code === 'PRODUCT_TYPE');
  const productTypeCode =
    normalizeProductTypeCode(productTypeAnswer?.valueText || productTypeAnswer?.option?.label) ||
    normalizeProductTypeCode(scopeBaseline?.productTypeCode || scopeBaseline?.productTypeLabel);
  const productTypeLabel =
    scopeBaseline?.productTypeLabel ||
    (productTypeCode ? getProductTypeLabel(productTypeCode) : '') ||
    productTypeAnswer?.option?.label ||
    toTitleLabel(productTypeAnswer?.valueText);
  const matchedTemplate = CLIENT_SPEC_TEMPLATES.find(
    (template) => template.code === getDefaultClientSpecTemplateCode(productTypeCode),
  );

  const derivedFeatures = answers
    .filter((answer) => answer.question?.code === 'FEATURES')
    .map((answer) => answer.option?.label || getFeatureLabel(answer.valueText))
    .filter((label): label is string => Boolean(label))
    .map((label) => ({
      title: label,
      description: `Include ${label.toLowerCase()} in the initial client-approved scope.`,
      priority: 'SHOULD_HAVE' as const,
    }));

  return {
    requestId,
    title: request.title || '',
    description: request.description || '',
    estimatedBudget: deriveSeedBudget(request),
    estimatedTimeline:
      request.commercialBaseline?.agreedDeliveryDeadline ||
      scopeBaseline?.requestedDeadline ||
      request.requestedDeadline ||
      request.intendedTimeline ||
      '',
    agreedDeliveryDeadline:
      request.commercialBaseline?.agreedDeliveryDeadline ||
      scopeBaseline?.requestedDeadline ||
      request.requestedDeadline ||
      undefined,
    projectCategory: productTypeLabel || '',
    templateCode: matchedTemplate?.code,
    clientFeatures:
      request.commercialBaseline?.agreedClientFeatures?.length
        ? request.commercialBaseline.agreedClientFeatures.map((feature) => ({
            id: feature.id || undefined,
            title: feature.title,
            description: feature.description,
            priority: feature.priority || 'SHOULD_HAVE',
          }))
        : matchedTemplate?.clientFeatures ||
      (derivedFeatures.length > 0 ? derivedFeatures : undefined),
    referenceLinks: [],
    changeSummary: '',
  };
};

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
  const requestSeedValues = useMemo(() => buildRequestSeedValues(request, id), [request, id]);

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
        setIsEditingExisting(
          clientSpec?.status === 'DRAFT' || clientSpec?.status === 'REJECTED',
        );
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
        estimatedBudget:
          Number(editableExistingSpec.totalBudget || 0) > 0
            ? Number(editableExistingSpec.totalBudget || 0)
            : requestSeedValues?.estimatedBudget,
        estimatedTimeline: editableExistingSpec.estimatedTimeline || '',
        agreedDeliveryDeadline: editableExistingSpec.estimatedTimeline || '',
        projectCategory:
          requestSeedValues?.projectCategory ||
          request?.requestScopeBaseline?.productTypeLabel ||
          editableExistingSpec.projectCategory ||
          undefined,
        clientFeatures: (editableExistingSpec.clientFeatures || []).map((feature) => ({
          id: feature.id || undefined,
          title: feature.title,
          description: feature.description,
          priority: feature.priority,
        })),
        referenceLinks: editableExistingSpec.referenceLinks || [],
        changeSummary: editableExistingSpec.changeSummary || '',
      }
    : requestSeedValues;
  const originalRequestContext = request.originalRequestContext || request;
  const requestScopeBaseline = request.requestScopeBaseline;
  const lockedProductType =
    requestScopeBaseline?.productTypeLabel || requestSeedValues?.projectCategory || 'Not set';

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

      <Card>
        <CardHeader>
          <CardTitle>Locked Request Context</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Original brief</p>
            <p className="mt-2 font-medium text-slate-950">
              {requestScopeBaseline?.requestTitle || originalRequestContext.title || request.title}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-slate-600">
              {requestScopeBaseline?.requestDescription || originalRequestContext.description || request.description}
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border bg-slate-50/70 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Budget range</p>
              <p className="mt-1 font-medium">{originalRequestContext.budgetRange || 'Not set'}</p>
            </div>
            <div className="rounded-xl border bg-slate-50/70 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Requested Deadline</p>
              <p className="mt-1 font-medium">
                {requestScopeBaseline?.requestedDeadline || originalRequestContext.requestedDeadline || originalRequestContext.intendedTimeline || 'Not set'}
              </p>
            </div>
            <div className="rounded-xl border bg-slate-50/70 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Project Goal</p>
              <p className="mt-1 font-medium">
                {requestScopeBaseline?.projectGoalSummary || originalRequestContext.techPreferences || 'Not set'}
              </p>
            </div>
            <div className="rounded-xl border bg-slate-50/70 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Product type</p>
              <p className="mt-1 font-medium">{lockedProductType}</p>
            </div>
          </div>
          <RequestAttachmentGallery
            attachments={originalRequestContext.attachments}
            emptyLabel="No request attachments were provided."
          />
        </CardContent>
      </Card>

      {existingClientSpec?.status === 'REJECTED' && existingClientSpec.rejectionReason && (
        <Alert>
          <AlertTitle>Client requested a revision</AlertTitle>
          <AlertDescription>{existingClientSpec.rejectionReason}</AlertDescription>
        </Alert>
      )}

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
          requestedDeadline={
            request.requestScopeBaseline?.requestedDeadline ?? request.requestedDeadline ?? null
          }
          requestCreatedAt={request.createdAt}
          lockedProjectCategory={lockedProductType}
          requireChangeSummary={Boolean(isEditingExisting && existingClientSpec?.status === 'REJECTED')}
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
