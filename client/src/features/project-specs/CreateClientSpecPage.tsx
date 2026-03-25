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
import { CLIENT_SPEC_TEMPLATES } from './templates';

const PRODUCT_TYPE_TEMPLATE_BY_CODE: Partial<Record<string, string>> = {
  LANDING_PAGE: 'LANDING_PAGE_STARTER',
  ECOMMERCE: 'ECOMMERCE_STANDARD',
  WEB_APP: 'SAAS_PORTAL',
};

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  LANDING_PAGE: 'Landing Page',
  CORP_WEBSITE: 'Corporate Website',
  ECOMMERCE: 'E-commerce Website',
  MOBILE_APP: 'Mobile App',
  WEB_APP: 'Web App / SaaS Platform',
  SYSTEM: 'Internal Management System',
};

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

const buildRequestSeedValues = (
  request: ProjectRequest | null,
  requestId?: string,
): Partial<CreateClientSpecDTO> | null => {
  if (!request || !requestId) {
    return null;
  }

  const answers = request.answers || [];
  const productTypeAnswer = answers.find((answer) => answer.question?.code === 'PRODUCT_TYPE');
  const productTypeCode = normalizeWizardCode(productTypeAnswer?.valueText || productTypeAnswer?.option?.label);
  const matchedTemplate = CLIENT_SPEC_TEMPLATES.find(
    (template) => template.code === PRODUCT_TYPE_TEMPLATE_BY_CODE[productTypeCode],
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
    estimatedBudget: 0,
    estimatedTimeline: matchedTemplate?.estimatedTimeline || request.intendedTimeline || '',
    projectCategory:
      matchedTemplate?.projectCategory ||
      PRODUCT_TYPE_LABELS[productTypeCode] ||
      productTypeAnswer?.option?.label ||
      productTypeAnswer?.valueText ||
      '',
    templateCode: matchedTemplate?.code,
    clientFeatures:
      matchedTemplate?.clientFeatures ||
      (derivedFeatures.length > 0 ? derivedFeatures : undefined),
    referenceLinks: [],
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
    : requestSeedValues;

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
