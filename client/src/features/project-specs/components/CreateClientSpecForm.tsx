import { useEffect, useMemo } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Badge } from '@/shared/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import type { CreateClientSpecDTO } from '../types';
import {
  CLIENT_SPEC_TEMPLATES,
  getCompatibleClientSpecTemplates,
} from '../templates';
import { getProductTypeLabel, normalizeProductTypeCode } from '@/shared/utils/productType';

const HTTP_URL_PATTERN = /^https?:\/\/[\w.-]+\.[a-z]{2,}.*$/i;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const getTodayDateKey = () => {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
};

const getDateKeyCandidate = (value?: string | null): string | null => {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(value || '').trim());
  return match?.[1] || null;
};

const mergeTemplateFeatures = (
  existing: Array<{
    id?: string | null;
    title: string;
    description: string;
    priority: 'MUST_HAVE' | 'SHOULD_HAVE' | 'NICE_TO_HAVE';
  }>,
  templateFeatures: Array<{
    id?: string | null;
    title: string;
    description: string;
    priority: 'MUST_HAVE' | 'SHOULD_HAVE' | 'NICE_TO_HAVE';
  }>,
) : Array<{
  id?: string;
  title: string;
  description: string;
  priority: 'MUST_HAVE' | 'SHOULD_HAVE' | 'NICE_TO_HAVE';
}> => {
  const meaningfulExisting = existing.filter(
    (feature) =>
      feature.title.trim().length > 0 || feature.description.trim().length > 0,
  ).map((feature) => ({
    ...feature,
    id: feature.id || undefined,
  }));

  if (meaningfulExisting.length === 0) {
    return templateFeatures.map((feature) => ({
      ...feature,
      id: feature.id || undefined,
    }));
  }

  const seen = new Set(
    meaningfulExisting.map((feature) => feature.title.trim().toLowerCase()),
  );

  return [
    ...meaningfulExisting,
    ...templateFeatures
      .filter((feature) => !seen.has(feature.title.trim().toLowerCase()))
      .map((feature) => ({
        ...feature,
        id: feature.id || undefined,
      })),
  ];
};

const normalizeReferenceUrl = (value?: string): string => {
  const trimmed = value?.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (/^[\w.-]+\.[a-z]{2,}.*$/i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
};

const parseBudgetRange = (value?: string | null): { min?: number; max?: number } | null => {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const matches = raw.match(/\d[\d,.]*/g) || [];
  const numbers = matches
    .map((segment) => Number(segment.replace(/[^\d.]/g, '')))
    .filter((number) => Number.isFinite(number) && number >= 0);

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

const clientFeatureSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, 'Feature title is required'),
  description: z.string().min(10, 'Feature description must be at least 10 characters'),
  priority: z.enum(['MUST_HAVE', 'SHOULD_HAVE', 'NICE_TO_HAVE']),
});

const referenceLinkSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  url: z
    .string()
    .transform((value) => normalizeReferenceUrl(value))
    .refine((value) => HTTP_URL_PATTERN.test(value), {
      message: 'Use a valid http(s) URL',
    }),
});

const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(20, 'Description must be at least 20 characters'),
  estimatedBudget: z
    .union([z.number(), z.null(), z.undefined()])
    .refine((value): value is number => typeof value === 'number' && Number.isFinite(value), {
      message: 'Estimated budget is required',
    })
    .refine((value) => value > 0, {
      message: 'Estimated budget must be greater than 0',
    }),
  agreedDeliveryDeadline: z
    .string()
    .min(1, 'Agreed delivery deadline is required')
    .refine((value) => DATE_ONLY_PATTERN.test(value), {
      message: 'Use the YYYY-MM-DD date format',
    }),
  projectCategory: z.string().optional(),
  templateCode: z.string().optional(),
  changeSummary: z.string().optional(),
  clientFeatures: z.array(clientFeatureSchema).min(1, 'At least one feature is required'),
  referenceLinks: z.array(referenceLinkSchema).optional(),
});

type FormValues = z.input<typeof formSchema>;
type FormSubmitValues = z.output<typeof formSchema>;

interface CreateClientSpecFormProps {
  requestId: string;
  onSubmit: (payload: CreateClientSpecDTO) => void;
  isSubmitting?: boolean;
  initialValues?: Partial<CreateClientSpecDTO> | null;
  submitLabel?: string;
  requestBudgetRange?: string | null;
  requestedDeadline?: string | null;
  requestCreatedAt?: string | null;
  lockedProjectCategory?: string | null;
  requireChangeSummary?: boolean;
}

export function CreateClientSpecForm({
  requestId,
  onSubmit,
  isSubmitting = false,
  initialValues = null,
  submitLabel = 'Create Client Spec',
  requestBudgetRange = null,
  requestedDeadline = null,
  requestCreatedAt = null,
  lockedProjectCategory = null,
  requireChangeSummary = false,
}: CreateClientSpecFormProps) {
  const form = useForm<FormValues, undefined, FormSubmitValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      estimatedBudget: undefined as unknown as number,
      agreedDeliveryDeadline: '',
      projectCategory: '',
      templateCode: '',
      changeSummary: '',
      clientFeatures: [
        {
          title: '',
          description: '',
          priority: 'MUST_HAVE',
        },
      ],
      referenceLinks: [],
    },
  });

  const featureFields = useFieldArray({
    control: form.control,
    name: 'clientFeatures',
  });

  const linkFields = useFieldArray({
    control: form.control,
    name: 'referenceLinks',
  });

  const selectedTemplateCode = form.watch('templateCode');
  const agreedDeliveryDeadlineValue = form.watch('agreedDeliveryDeadline');
  const normalizedLockedProductType = useMemo(
    () => normalizeProductTypeCode(lockedProjectCategory),
    [lockedProjectCategory],
  );
  const compatibleTemplates = useMemo(
    () => getCompatibleClientSpecTemplates(normalizedLockedProductType || lockedProjectCategory),
    [normalizedLockedProductType, lockedProjectCategory],
  );
  const selectedTemplate =
    compatibleTemplates.find((item) => item.code === selectedTemplateCode) ||
    CLIENT_SPEC_TEMPLATES.find((item) => item.code === selectedTemplateCode);
  const estimatedBudgetValue = form.watch('estimatedBudget');
  const requestedDeadlineKey = getDateKeyCandidate(requestedDeadline);
  const requestCreatedDateKey = getDateKeyCandidate(requestCreatedAt);
  const minimumDeliveryDeadline = useMemo(() => {
    const todayKey = getTodayDateKey();
    const requestAnchor = requestedDeadlineKey || requestCreatedDateKey || todayKey;
    return requestAnchor > todayKey ? requestAnchor : todayKey;
  }, [requestCreatedDateKey, requestedDeadlineKey]);
  const deliveryDeadlineExtensionWarning = useMemo(() => {
    if (!requestedDeadlineKey || !agreedDeliveryDeadlineValue || agreedDeliveryDeadlineValue <= requestedDeadlineKey) {
      return null;
    }

    const requestedTime = new Date(`${requestedDeadlineKey}T00:00:00.000Z`).getTime();
    const agreedTime = new Date(`${agreedDeliveryDeadlineValue}T00:00:00.000Z`).getTime();
    const dayDiff = Math.round((agreedTime - requestedTime) / (24 * 60 * 60 * 1000));

    return `This extends the client requested deadline by ${dayDiff} day${dayDiff === 1 ? '' : 's'} and requires explicit client approval.`;
  }, [agreedDeliveryDeadlineValue, requestedDeadlineKey]);
  const parsedBudgetRange = parseBudgetRange(requestBudgetRange);
  const budgetDeviationWarning = (() => {
    if (
      typeof estimatedBudgetValue !== 'number' ||
      !Number.isFinite(estimatedBudgetValue) ||
      !parsedBudgetRange
    ) {
      return null;
    }

    if (parsedBudgetRange.min != null && estimatedBudgetValue < parsedBudgetRange.min) {
      return `Current estimate is below the client request floor of $${parsedBudgetRange.min.toLocaleString()}.`;
    }

    if (parsedBudgetRange.max != null && estimatedBudgetValue > parsedBudgetRange.max) {
      return `Current estimate is above the client request ceiling of $${parsedBudgetRange.max.toLocaleString()}.`;
    }

    return null;
  })();
  const errors = form.formState.errors;

  const stopNumberFieldScroll = (event: React.WheelEvent<HTMLInputElement>) => {
    event.currentTarget.blur();
  };

  const preventArrowStep = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
    }
  };

  const applyTemplate = (templateCode: string) => {
    const template = compatibleTemplates.find((item) => item.code === templateCode);
    if (!template) return;

    form.setValue('templateCode', template.code, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue('clientFeatures', mergeTemplateFeatures(form.getValues('clientFeatures'), template.clientFeatures), {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const handleSubmit = (values: FormSubmitValues) => {
    if (values.agreedDeliveryDeadline < minimumDeliveryDeadline) {
      form.setError('agreedDeliveryDeadline', {
        type: 'manual',
        message: `Agreed delivery deadline cannot be earlier than ${minimumDeliveryDeadline}.`,
      });
      form.setFocus('agreedDeliveryDeadline');
      return;
    }

    if (requireChangeSummary && (values.changeSummary?.trim()?.length ?? 0) < 10) {
      form.setError('changeSummary', {
        type: 'manual',
        message: 'Explain the revision in at least 10 characters',
      });
      return;
    }

    const payload: CreateClientSpecDTO = {
      requestId,
      title: values.title,
      description: values.description,
      estimatedBudget: values.estimatedBudget,
      estimatedTimeline: values.agreedDeliveryDeadline,
      agreedDeliveryDeadline: values.agreedDeliveryDeadline,
      projectCategory: lockedProjectCategory || values.projectCategory || undefined,
      changeSummary: values.changeSummary?.trim() || undefined,
      clientFeatures: values.clientFeatures,
      referenceLinks: values.referenceLinks?.length
        ? values.referenceLinks.map((link) => ({
            label: link.label.trim(),
            url: normalizeReferenceUrl(link.url),
          }))
        : undefined,
      templateCode: values.templateCode || undefined,
    };

    onSubmit(payload);
  };

  useEffect(() => {
    if (!initialValues) return;

    form.reset({
      title: initialValues.title || '',
      description: initialValues.description || '',
      estimatedBudget:
        typeof initialValues.estimatedBudget === 'number' && initialValues.estimatedBudget > 0
          ? initialValues.estimatedBudget
          : (undefined as unknown as number),
      agreedDeliveryDeadline:
        initialValues.agreedDeliveryDeadline || initialValues.estimatedTimeline || '',
      projectCategory: lockedProjectCategory || initialValues.projectCategory || '',
      templateCode:
        initialValues.templateCode &&
        compatibleTemplates.some((template) => template.code === initialValues.templateCode)
          ? initialValues.templateCode
          : '',
      changeSummary: initialValues.changeSummary || '',
      clientFeatures:
        initialValues.clientFeatures && initialValues.clientFeatures.length > 0
          ? initialValues.clientFeatures.map((feature) => ({
              id: feature.id || undefined,
              title: feature.title || '',
              description: feature.description || '',
              priority: feature.priority || 'MUST_HAVE',
            }))
          : [{ title: '', description: '', priority: 'MUST_HAVE' }],
      referenceLinks: initialValues.referenceLinks || [],
    });
  }, [compatibleTemplates, form, initialValues, lockedProjectCategory]);

  useEffect(() => {
    if (!agreedDeliveryDeadlineValue) {
      return;
    }

    if (agreedDeliveryDeadlineValue < minimumDeliveryDeadline) {
      form.setError('agreedDeliveryDeadline', {
        type: 'manual',
        message: `Agreed delivery deadline cannot be earlier than ${minimumDeliveryDeadline}.`,
      });
      return;
    }

    if (form.formState.errors.agreedDeliveryDeadline?.type === 'manual') {
      form.clearErrors('agreedDeliveryDeadline');
    }
  }, [
    agreedDeliveryDeadlineValue,
    form,
    form.formState.errors.agreedDeliveryDeadline?.type,
    minimumDeliveryDeadline,
  ]);

  useEffect(() => {
    if (
      selectedTemplateCode &&
      !compatibleTemplates.some((template) => template.code === selectedTemplateCode)
    ) {
      form.setValue('templateCode', '', { shouldDirty: true });
    }
  }, [compatibleTemplates, form, selectedTemplateCode]);

  const handleInvalidSubmit = () => {
    const featureErrors = Array.isArray(errors.clientFeatures) ? errors.clientFeatures : [];
    const linkErrors = Array.isArray(errors.referenceLinks) ? errors.referenceLinks : [];

    const firstFeatureWithError = featureErrors.findIndex(
      (featureError) => !!featureError?.title || !!featureError?.description || !!featureError?.priority,
    );
    const firstLinkWithError = linkErrors.findIndex(
      (linkError) => !!linkError?.label || !!linkError?.url,
    );

    if (errors.title) {
      form.setFocus('title');
    } else if (errors.description) {
      form.setFocus('description');
    } else if (errors.estimatedBudget) {
      form.setFocus('estimatedBudget');
    } else if (errors.agreedDeliveryDeadline) {
      form.setFocus('agreedDeliveryDeadline');
    } else if (errors.changeSummary) {
      form.setFocus('changeSummary');
    } else if (
      typeof firstFeatureWithError === 'number' &&
      firstFeatureWithError >= 0 &&
      errors.clientFeatures?.[firstFeatureWithError]?.title
    ) {
      form.setFocus(`clientFeatures.${firstFeatureWithError}.title`);
    } else if (
      typeof firstFeatureWithError === 'number' &&
      firstFeatureWithError >= 0 &&
      errors.clientFeatures?.[firstFeatureWithError]?.description
    ) {
      form.setFocus(`clientFeatures.${firstFeatureWithError}.description`);
    } else if (typeof firstLinkWithError === 'number' && firstLinkWithError >= 0) {
      if (errors.referenceLinks?.[firstLinkWithError]?.label) {
        form.setFocus(`referenceLinks.${firstLinkWithError}.label`);
      } else if (errors.referenceLinks?.[firstLinkWithError]?.url) {
        form.setFocus(`referenceLinks.${firstLinkWithError}.url`);
      }
    }
  };

  return (
    <form onSubmit={form.handleSubmit(handleSubmit, handleInvalidSubmit)} className="space-y-6">
      {form.formState.submitCount > 0 && !form.formState.isValid && (
        <Alert variant="destructive">
          <AlertTitle>Form has validation errors</AlertTitle>
          <AlertDescription>
            Please review the highlighted fields below. The first invalid field has been focused.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Template Starter</CardTitle>
          <CardDescription>
            Choose a starter template compatible with the locked product type. Templates only add suggested scope items and never overwrite the original client request baseline.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {compatibleTemplates.length > 0 ? (
            <Select
              value={form.watch('templateCode') || ''}
              onValueChange={(value) => applyTemplate(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select starter template" />
              </SelectTrigger>
              <SelectContent>
                {compatibleTemplates.map((template) => (
                  <SelectItem key={template.code} value={template.code}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              No starter templates are mapped to {getProductTypeLabel(lockedProjectCategory)} yet.
            </div>
          )}
          {selectedTemplate && (
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
              <p className="font-medium text-blue-900">{selectedTemplate.description}</p>
              <p className="mt-1">
                Suggested delivery pattern: {selectedTemplate.suggestedTimelineLabel}. You still need to choose a valid agreed date below.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Client Spec Overview</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Title</label>
            <Input
              {...form.register('title')}
              placeholder="Project overview title"
              className={errors.title ? 'border-red-500 focus-visible:ring-red-500' : ''}
            />
            {errors.title?.message && (
              <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Description</label>
            <Textarea
              {...form.register('description')}
              placeholder="Clear, simple scope for client review"
              className={`min-h-[120px] ${
                errors.description ? 'border-red-500 focus-visible:ring-red-500' : ''
              }`}
            />
            {errors.description?.message && (
              <p className="mt-1 text-xs text-red-600">{errors.description.message}</p>
            )}
          </div>
          {requestBudgetRange && (
            <div className="w-fit rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm text-amber-900">
              Client budget: <span className="font-semibold">{requestBudgetRange}</span>
            </div>
          )}
          {budgetDeviationWarning && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {budgetDeviationWarning} Client must explicitly approve any deviation before it becomes the commercial baseline.
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Estimated Budget (USD)</label>
              <Input
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                placeholder="8000"
                onWheel={stopNumberFieldScroll}
                onKeyDown={preventArrowStep}
                {...form.register('estimatedBudget', {
                  setValueAs: (value) =>
                    value === '' || value === null || value === undefined ? undefined : Number(value),
                })}
                className={errors.estimatedBudget ? 'border-red-500 focus-visible:ring-red-500' : ''}
              />
              {errors.estimatedBudget?.message && (
                <p className="mt-1 text-xs text-red-600">{errors.estimatedBudget.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Agreed Delivery Deadline</label>
              <Input
                type="date"
                min={minimumDeliveryDeadline}
                {...form.register('agreedDeliveryDeadline')}
                className={errors.agreedDeliveryDeadline ? 'border-red-500 focus-visible:ring-red-500' : ''}
              />
              {errors.agreedDeliveryDeadline?.message && (
                <p className="mt-1 text-xs text-red-600">{errors.agreedDeliveryDeadline.message}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                Requested deadline from client: {requestedDeadlineKey || 'Not set'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Minimum negotiable date for this request: {minimumDeliveryDeadline}
              </p>
              {deliveryDeadlineExtensionWarning && (
                <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  {deliveryDeadlineExtensionWarning}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Product Type</label>
              <Input
                {...form.register('projectCategory')}
                value={lockedProjectCategory || form.watch('projectCategory') || ''}
                readOnly
                aria-readonly="true"
                placeholder="Locked from request intake"
                className="bg-slate-50 text-slate-700"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Locked to the original client request. If this is wrong, revise the request intake first.
              </p>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Change Summary</label>
            <Textarea
              {...form.register('changeSummary')}
              placeholder="Explain what changed in this submission, especially budget, deadline, or feature scope adjustments."
              className={`min-h-[96px] ${
                errors.changeSummary ? 'border-red-500 focus-visible:ring-red-500' : ''
              }`}
            />
            {errors.changeSummary?.message && (
              <p className="mt-1 text-xs text-red-600">{errors.changeSummary.message}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {requireChangeSummary
                ? 'Required for a revised submission after client rejection.'
                : 'Optional for the first submission, recommended whenever commercial assumptions changed.'}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Client Features</CardTitle>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              featureFields.append({ title: '', description: '', priority: 'SHOULD_HAVE' })
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Feature
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {typeof errors.clientFeatures?.message === 'string' && (
            <p className="text-sm text-red-600">{errors.clientFeatures.message}</p>
          )}
          {featureFields.fields.map((field, index) => (
            <div
              key={field.id}
              className={`space-y-3 rounded-md border p-3 ${
                errors.clientFeatures?.[index]
                  ? 'border-red-300 bg-red-50/30'
                  : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <Badge variant="outline">Feature {index + 1}</Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => featureFields.remove(index)}
                  disabled={featureFields.fields.length <= 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <Input
                {...form.register(`clientFeatures.${index}.title`)}
                placeholder="Feature title"
                className={
                  errors.clientFeatures?.[index]?.title
                    ? 'border-red-500 focus-visible:ring-red-500'
                    : ''
                }
              />
              {errors.clientFeatures?.[index]?.title?.message && (
                <p className="text-xs text-red-600">
                  {errors.clientFeatures[index]?.title?.message}
                </p>
              )}
              <Textarea
                {...form.register(`clientFeatures.${index}.description`)}
                placeholder="Feature description for client review"
                className={
                  errors.clientFeatures?.[index]?.description
                    ? 'border-red-500 focus-visible:ring-red-500'
                    : ''
                }
              />
              {errors.clientFeatures?.[index]?.description?.message && (
                <p className="text-xs text-red-600">
                  {errors.clientFeatures[index]?.description?.message}
                </p>
              )}
              <Select
                value={form.watch(`clientFeatures.${index}.priority`)}
                onValueChange={(value) =>
                  form.setValue(`clientFeatures.${index}.priority`, value as FormValues['clientFeatures'][number]['priority'])
                }
              >
                <SelectTrigger
                  className={
                    errors.clientFeatures?.[index]?.priority
                      ? 'border-red-500 focus:ring-red-500'
                      : ''
                  }
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MUST_HAVE">Must Have</SelectItem>
                  <SelectItem value="SHOULD_HAVE">Should Have</SelectItem>
                  <SelectItem value="NICE_TO_HAVE">Nice to Have</SelectItem>
                </SelectContent>
              </Select>
              {errors.clientFeatures?.[index]?.priority?.message && (
                <p className="text-xs text-red-600">
                  {errors.clientFeatures[index]?.priority?.message}
                </p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Reference Links (Optional)</CardTitle>
          <Button
            type="button"
            variant="outline"
            onClick={() => linkFields.append({ label: '', url: '' })}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Link
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            Share clear examples only: Figma, Drive/Docs, GitHub/GitLab, Notion, or a live demo URL.
          </div>
          {typeof errors.referenceLinks?.message === 'string' && (
            <p className="text-sm text-red-600">{errors.referenceLinks.message}</p>
          )}
          {linkFields.fields.length === 0 && (
            <p className="text-sm text-muted-foreground">No reference links added.</p>
          )}
          {linkFields.fields.map((field, index) => (
            <div
              key={field.id}
              className={`grid gap-2 md:grid-cols-[1fr_2fr_auto] ${
                errors.referenceLinks?.[index] ? 'rounded-md border border-red-300 p-2' : ''
              }`}
            >
              <div>
                <Input
                  {...form.register(`referenceLinks.${index}.label`)}
                  placeholder="Label"
                  className={
                    errors.referenceLinks?.[index]?.label
                      ? 'border-red-500 focus-visible:ring-red-500'
                      : ''
                  }
                />
                {errors.referenceLinks?.[index]?.label?.message && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.referenceLinks[index]?.label?.message}
                  </p>
                )}
              </div>
              <div>
                <Input
                  {...form.register(`referenceLinks.${index}.url`)}
                  placeholder="figma.com/file/..."
                  onBlur={(event) => {
                    const normalized = normalizeReferenceUrl(event.target.value);
                    form.setValue(`referenceLinks.${index}.url`, normalized, {
                      shouldDirty: true,
                      shouldTouch: true,
                      shouldValidate: true,
                    });
                  }}
                  className={
                    errors.referenceLinks?.[index]?.url
                      ? 'border-red-500 focus-visible:ring-red-500'
                      : ''
                  }
                />
                {errors.referenceLinks?.[index]?.url?.message && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.referenceLinks[index]?.url?.message}
                  </p>
                )}
              </div>
              <Button type="button" variant="ghost" onClick={() => linkFields.remove(index)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
