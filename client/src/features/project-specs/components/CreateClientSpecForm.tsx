import { useEffect } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/Card';
import { Input } from '@/shared/components/ui/Input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Badge } from '@/shared/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import type { CreateClientSpecDTO } from '../types';
import { CLIENT_SPEC_TEMPLATES } from '../templates';

const clientFeatureSchema = z.object({
  title: z.string().min(1, 'Feature title is required'),
  description: z.string().min(10, 'Feature description must be at least 10 characters'),
  priority: z.enum(['MUST_HAVE', 'SHOULD_HAVE', 'NICE_TO_HAVE']),
});

const referenceLinkSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  url: z.string().url('Invalid URL'),
});

const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(20, 'Description must be at least 20 characters'),
  estimatedBudget: z.number().min(0, 'Estimated budget must be non-negative'),
  estimatedTimeline: z.string().min(1, 'Timeline is required'),
  projectCategory: z.string().optional(),
  templateCode: z.string().optional(),
  clientFeatures: z.array(clientFeatureSchema).min(1, 'At least one feature is required'),
  referenceLinks: z.array(referenceLinkSchema).optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateClientSpecFormProps {
  requestId: string;
  onSubmit: (payload: CreateClientSpecDTO) => void;
  isSubmitting?: boolean;
  initialValues?: Partial<CreateClientSpecDTO> | null;
  submitLabel?: string;
  requestBudgetRange?: string | null;
}

export function CreateClientSpecForm({
  requestId,
  onSubmit,
  isSubmitting = false,
  initialValues = null,
  submitLabel = 'Create Client Spec',
  requestBudgetRange = null,
}: CreateClientSpecFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      estimatedBudget: 0,
      estimatedTimeline: '',
      projectCategory: '',
      templateCode: '',
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
  const selectedTemplate = CLIENT_SPEC_TEMPLATES.find(
    (item) => item.code === selectedTemplateCode,
  );
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
    const template = CLIENT_SPEC_TEMPLATES.find((item) => item.code === templateCode);
    if (!template) return;

    form.setValue('templateCode', template.code);
    form.setValue('projectCategory', template.projectCategory);
    form.setValue('estimatedTimeline', template.estimatedTimeline);
    form.setValue('clientFeatures', template.clientFeatures);
  };

  const handleSubmit = (values: FormValues) => {
    const payload: CreateClientSpecDTO = {
      requestId,
      title: values.title,
      description: values.description,
      estimatedBudget: values.estimatedBudget,
      estimatedTimeline: values.estimatedTimeline,
      projectCategory: values.projectCategory || undefined,
      clientFeatures: values.clientFeatures,
      referenceLinks: values.referenceLinks?.length ? values.referenceLinks : undefined,
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
        typeof initialValues.estimatedBudget === 'number' ? initialValues.estimatedBudget : 0,
      estimatedTimeline: initialValues.estimatedTimeline || '',
      projectCategory: initialValues.projectCategory || '',
      templateCode: initialValues.templateCode || '',
      clientFeatures:
        initialValues.clientFeatures && initialValues.clientFeatures.length > 0
          ? initialValues.clientFeatures.map((feature) => ({
              title: feature.title || '',
              description: feature.description || '',
              priority: feature.priority || 'MUST_HAVE',
            }))
          : [{ title: '', description: '', priority: 'MUST_HAVE' }],
      referenceLinks: initialValues.referenceLinks || [],
    });
  }, [form, initialValues]);

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
    } else if (errors.estimatedTimeline) {
      form.setFocus('estimatedTimeline');
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
          <CardDescription>Choose one of 3 starter templates to pre-fill common requirements.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select
            value={form.watch('templateCode') || ''}
            onValueChange={(value) => applyTemplate(value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select starter template" />
            </SelectTrigger>
            <SelectContent>
              {CLIENT_SPEC_TEMPLATES.map((template) => (
                <SelectItem key={template.code} value={template.code}>
                  {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedTemplate && (
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
              {selectedTemplate.description}
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
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Estimated Budget (USD)</label>
              <Input
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                onWheel={stopNumberFieldScroll}
                onKeyDown={preventArrowStep}
                {...form.register('estimatedBudget', {
                  setValueAs: (value) =>
                    value === '' || value === null || value === undefined ? NaN : Number(value),
                })}
                className={errors.estimatedBudget ? 'border-red-500 focus-visible:ring-red-500' : ''}
              />
              {errors.estimatedBudget?.message && (
                <p className="mt-1 text-xs text-red-600">{errors.estimatedBudget.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Estimated Timeline</label>
              <Input
                {...form.register('estimatedTimeline')}
                placeholder="8-12 weeks"
                className={errors.estimatedTimeline ? 'border-red-500 focus-visible:ring-red-500' : ''}
              />
              {errors.estimatedTimeline?.message && (
                <p className="mt-1 text-xs text-red-600">{errors.estimatedTimeline.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Project Category</label>
              <Input {...form.register('projectCategory')} placeholder="E_COMMERCE / SAAS / ..." />
            </div>
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
                  placeholder="https://..."
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
