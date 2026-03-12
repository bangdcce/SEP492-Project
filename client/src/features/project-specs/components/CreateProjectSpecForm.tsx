import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/ui/Input";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/shared/components/ui/Card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/shared/components/ui/form";
import { Separator } from "@/shared/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/components/ui/accordion";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/shared/components/ui/alert";
import { Badge } from "@/shared/components/ui/badge";
import {
  SpecNarrativeEditor,
  narrativeHasContent,
} from "@/shared/components/rich-text/SpecNarrative";

import { DeliverableType } from "../types";
import type { CreateProjectSpecDTO } from "../types";

// 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
// CONSTANTS & HELPERS
// 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

const BANNED_KEYWORDS = [
  "ﾄ黛ｺｹp",
  "sang tr盻肱g",
  "hi盻㌻ ﾄ黛ｺ｡i",
  "thﾃ｢n thi盻㌻",
  "beautiful",
  "modern",
  "friendly",
  "elegant",
  "nhanh",
  "t盻奏",
  "m蘯｡nh m蘯ｽ",
  "cao c蘯･p",
  "fast",
  "good",
  "powerful",
  "premium",
  "smooth",
  "easy",
  "simple",
];

const checkKeywords = (text: string): string[] => {
  if (!text) return [];
  const lower = text.toLowerCase();
  return BANNED_KEYWORDS.filter((k) => lower.includes(k));
};

const optionalDateSchema = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().optional(),
);

const milestoneSchema = z
  .object({
    title: z.string().min(1, "Milestone title is required"),
    description: z.string().min(1, "Description is required"),
    amount: z.coerce.number().min(0, "Amount must be positive"),
    deliverableType: z.nativeEnum(DeliverableType),
    retentionAmount: z.coerce.number().min(0).default(0),
    acceptanceCriteria: z
      .array(
        z.object({
          value: z.string(),
        }),
      )
      .default([]),
    startDate: optionalDateSchema,
    dueDate: optionalDateSchema,
    duration: z.preprocess(
      (value) => (value === "" || value == null ? undefined : value),
      z.coerce.number().optional(),
    ),
  })
  .superRefine((milestone, ctx) => {
    if (milestone.retentionAmount > milestone.amount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["retentionAmount"],
        message: "Retention cannot exceed the milestone amount",
      });
    }

    if (milestone.startDate && milestone.dueDate) {
      const startDate = new Date(milestone.startDate);
      const dueDate = new Date(milestone.dueDate);
      if (
        !Number.isNaN(startDate.getTime()) &&
        !Number.isNaN(dueDate.getTime()) &&
        dueDate.getTime() < startDate.getTime()
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["dueDate"],
          message: "Due date must be on or after the start date",
        });
      }
    }
  });

const toDateInputValue = (value?: string | null): string => {
  if (!value) return "";
  const normalized = /^(\d{4}-\d{2}-\d{2})/.exec(value)?.[1];
  return normalized || value;
};

const normalizeDatePayload = (value?: string): string | undefined => {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString();
};

// 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
// VALIDATION SCHEMA
// 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

const formSchema = z
  .object({
    title: z.string().min(1, "Title is required"),
    description: z
      .string()
      .min(10, "Description must be at least 10 characters"),
    techStack: z.string().min(1, "Tech stack is required"),

    // Validation: Features
    features: z
      .array(
        z.object({
          title: z.string().min(1, "Feature title is required"),
          description: z.string().min(1, "Description is required"),
          complexity: z.enum(["LOW", "MEDIUM", "HIGH"]),
          acceptanceCriteria: z
            .array(
              z.object({
                value: z.string().min(10, "Criteria must be at least 10 chars"),
              }),
            )
            .min(1, "At least one acceptance criterion is required"),
        }),
      )
      .optional(),

    // Validation: Milestones
    milestones: z.array(milestoneSchema).min(1, "At least one milestone is required"),
  })
  .refine(
    (data) => {
      const totalBudget = data.milestones.reduce(
        (sum, m) => sum + (Number(m.amount) || 0),
        0,
      );
      return totalBudget > 0;
    },
    {
      message: "At least one milestone amount must be greater than 0",
      path: ["milestones"],
    },
  )
  .refine(
    (data) => {
      const totalBudget = data.milestones.reduce(
        (sum, m) => sum + (Number(m.amount) || 0),
        0,
      );
      if (totalBudget <= 0 || data.milestones.length === 0) return true;
      if (data.milestones.length > 0) {
        const firstAmount = data.milestones[0].amount;
        return firstAmount / totalBudget <= 0.3;
      }
      return true;
    },
    {
      message:
        "First milestone cannot exceed 30% of total budget (Anti-Front-loading Rule)",
      path: ["milestones.0.amount"],
    },
  )
  .refine(
    (data) => {
      const totalBudget = data.milestones.reduce(
        (sum, m) => sum + (Number(m.amount) || 0),
        0,
      );
      if (totalBudget <= 0 || data.milestones.length === 0) return true;
      if (data.milestones.length > 0) {
        const lastAmount = data.milestones[data.milestones.length - 1].amount;
        return lastAmount / totalBudget >= 0.2;
      }
      return true;
    },
    {
      message:
        "Final milestone must be at least 20% of total budget (Completion Guarantee)",
      path: [`milestones`],
    },
  );

type FormValues = z.infer<typeof formSchema>;

// 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
// COMPONENT
// 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

interface CreateProjectSpecFormProps {
  requestId: string;
  projectRequest?: any; // Avoiding full type import to prevent circular deps or complex imports, or better use the type if available
  onSubmit: (data: CreateProjectSpecDTO) => void;
  isSubmitting?: boolean;
  isPhasedFlow?: boolean;
  initialValues?: Partial<CreateProjectSpecDTO> | null;
  submitLabel?: string;
  approvedBudgetCap?: number | null;
}

const sumMilestones = (
  milestones: Array<{ amount?: unknown }> | undefined,
): number =>
  (milestones || []).reduce((acc, milestone) => {
    const val =
      typeof milestone?.amount === "string"
        ? parseFloat(milestone.amount)
        : Number(milestone?.amount);
    return acc + (Number.isFinite(val) ? val : 0);
  }, 0);

export function CreateProjectSpecForm({
  requestId,
  projectRequest,
  onSubmit,
  isSubmitting,
  isPhasedFlow = false,
  initialValues = null,
  submitLabel,
  approvedBudgetCap = null,
}: CreateProjectSpecFormProps) {
  const [warnings, setWarnings] = useState<string[]>([]);
  const [richContentJson, setRichContentJson] = useState<
    Record<string, unknown> | null
  >(initialValues?.richContentJson || null);
  const stopNumberFieldScroll = (event: React.WheelEvent<HTMLInputElement>) => {
    event.currentTarget.blur();
  };
  const preventArrowStep = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
    }
  };

  const form = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      title: "",
      description: "",
      techStack: "",
      features: [],
      milestones: [
        {
          title: "Project Setup & Design",
          description: "Initial setup and design phase",
          amount: 0,
          deliverableType: DeliverableType.DESIGN_PROTOTYPE,
          retentionAmount: 0,
          acceptanceCriteria: [],
          startDate: "",
          dueDate: "",
        },
      ],
    },
    mode: "onChange",
  });

  const {
    fields: milestoneFields,
    append: appendMilestone,
    remove: removeMilestone,
  } = useFieldArray({
    control: form.control,
    name: "milestones",
  });

  const {
    fields: featureFields,
    append: appendFeature,
    remove: removeFeature,
  } = useFieldArray({
    control: form.control,
    name: "features",
  });

  // Real-time Warning Check
  const watchedMilestones = form.watch("milestones");
  const watchedDescription = form.watch("description");
  const watchedFeatures = form.watch("features");
  const calculatedBudget = sumMilestones(watchedMilestones);
  const budgetCap =
    typeof approvedBudgetCap === "number" ? approvedBudgetCap : null;
  const isOverApprovedBudget =
    budgetCap !== null && calculatedBudget - budgetCap > 0.01;

  useEffect(() => {
    const newWarnings: string[] = [];

    // Check Description
    if (watchedDescription) {
      const keywords = checkKeywords(watchedDescription);
      if (keywords.length > 0)
        newWarnings.push(
          `Description contains vague words: ${keywords.join(", ")}`,
        );
    }

    // Check Features
    watchedFeatures?.forEach((f, idx) => {
      if (f?.description) {
        const keywords = checkKeywords(f.description);
        if (keywords.length > 0)
          newWarnings.push(
            `Feature ${idx + 1} uses vague words: ${keywords.join(", ")}`,
          );
      }
    });

    setWarnings(newWarnings);
  }, [watchedDescription, watchedFeatures]);

  useEffect(() => {
    if (!initialValues) return;

    const mappedFeatures =
      initialValues.features && initialValues.features.length > 0
        ? initialValues.features.map((feature) => ({
            title: feature.title || "",
            description: feature.description || "",
            complexity: feature.complexity || "MEDIUM",
            acceptanceCriteria:
              feature.acceptanceCriteria &&
              feature.acceptanceCriteria.length > 0
                ? feature.acceptanceCriteria.map((criteria) => ({
                    value: criteria || "",
                  }))
                : [{ value: "" }],
          }))
        : [];

    const mappedMilestones =
      initialValues.milestones && initialValues.milestones.length > 0
        ? [...initialValues.milestones]
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
            .map((milestone) => ({
              title: milestone.title || "",
              description: milestone.description || "",
              amount: Number(milestone.amount ?? 0),
              deliverableType:
                milestone.deliverableType || DeliverableType.SOURCE_CODE,
              retentionAmount: Number(milestone.retentionAmount ?? 0),
              acceptanceCriteria: Array.isArray(milestone.acceptanceCriteria)
                ? milestone.acceptanceCriteria.map((criteria) => ({
                    value: criteria || "",
                  }))
                : [],
              startDate: toDateInputValue(milestone.startDate),
              dueDate: toDateInputValue(milestone.dueDate),
              duration:
                (milestone as { duration?: number | string | null }).duration ==
                null
                  ? undefined
                  : Number(
                      (milestone as { duration?: number | string }).duration,
                    ),
            }))
        : [
            {
              title: "Project Setup & Design",
              description: "Initial setup and design phase",
              amount: 0,
              deliverableType: DeliverableType.DESIGN_PROTOTYPE,
              retentionAmount: 0,
              acceptanceCriteria: [],
              startDate: "",
              dueDate: "",
            },
          ];

    form.reset({
      title: initialValues.title || "",
      description: initialValues.description || "",
      techStack: initialValues.techStack || "",
      features: mappedFeatures,
      milestones: mappedMilestones,
    });
    setRichContentJson(initialValues.richContentJson || null);
  }, [form, initialValues]);

  useEffect(() => {
    if (!initialValues) {
      setRichContentJson(null);
    }
  }, [initialValues]);

  const handleInvalidSubmit = () => {
    const errors = form.formState.errors;

    if (errors.title) {
      form.setFocus("title");
      return;
    }
    if (errors.description) {
      form.setFocus("description");
      return;
    }
    if (errors.techStack) {
      form.setFocus("techStack");
      return;
    }

    const featureErrors = Array.isArray(errors.features) ? errors.features : [];
    for (let index = 0; index < featureErrors.length; index += 1) {
      const featureError = featureErrors[index];
      if (featureError?.title) {
        form.setFocus(`features.${index}.title`);
        return;
      }
      if (featureError?.description) {
        form.setFocus(`features.${index}.description`);
        return;
      }
      const criteriaErrors = Array.isArray(featureError?.acceptanceCriteria)
        ? featureError.acceptanceCriteria
        : [];
      const criteriaIndex = criteriaErrors.findIndex(
        (criterion) => !!criterion?.value,
      );
      if (criteriaIndex >= 0) {
        form.setFocus(
          `features.${index}.acceptanceCriteria.${criteriaIndex}.value`,
        );
        return;
      }
    }

    const milestoneErrors = Array.isArray(errors.milestones)
      ? errors.milestones
      : [];
    for (let index = 0; index < milestoneErrors.length; index += 1) {
      const milestoneError = milestoneErrors[index];
      if (milestoneError?.title) {
        form.setFocus(`milestones.${index}.title`);
        return;
      }
      if (milestoneError?.amount) {
        form.setFocus(`milestones.${index}.amount`);
        return;
      }
      if (milestoneError?.description) {
        form.setFocus(`milestones.${index}.description`);
        return;
      }
      if (milestoneError?.retentionAmount) {
        form.setFocus(`milestones.${index}.retentionAmount`);
        return;
      }
      if (milestoneError?.startDate) {
        form.setFocus(`milestones.${index}.startDate`);
        return;
      }
      if (milestoneError?.dueDate) {
        form.setFocus(`milestones.${index}.dueDate`);
        return;
      }
      const criteriaErrors = Array.isArray(milestoneError?.acceptanceCriteria)
        ? milestoneError.acceptanceCriteria
        : [];
      const criteriaIndex = criteriaErrors.findIndex(
        (criterion) => !!criterion?.value,
      );
      if (criteriaIndex >= 0) {
        form.setFocus(
          `milestones.${index}.acceptanceCriteria.${criteriaIndex}.value`,
        );
        return;
      }
    }
  };

  // Nested Array handler helper (Acceptance Criteria) is tricky with useFieldArray at top level.
  // We will inline the Criteria list management inside the Feature map loop or create a sub-component.
  // For simplicity in this single file, let's create a sub-component `FeatureItem`.

  const handleSubmit = (
    values: FormValues,
    status: "DRAFT" | "PENDING_APPROVAL" = "DRAFT",
  ) => {
    const milestoneBudget = sumMilestones(values.milestones);
    form.clearErrors("root");

    if (budgetCap !== null && milestoneBudget - budgetCap > 0.01) {
      form.setError("root", {
        type: "manual",
        message: `Milestone total cannot exceed approved client budget of $${budgetCap.toLocaleString(
          undefined,
          {
            maximumFractionDigits: 2,
          },
        )}. Current total: $${milestoneBudget.toLocaleString(undefined, {
          maximumFractionDigits: 2,
        })}.`,
      });
      return;
    }

    // Transform data to match DTO
    const payload: CreateProjectSpecDTO = {
      requestId,
      status: status as any, // Cast to enum
      title: values.title,
      description: values.description,
      totalBudget: milestoneBudget,
      techStack: values.techStack,
      features: values.features?.map((f) => ({
        title: f.title,
        description: f.description,
        complexity: f.complexity,
        acceptanceCriteria: f.acceptanceCriteria.map((ac) => ac.value.trim()),
      })),
      milestones: values.milestones.map((m, index) => ({
        title: m.title,
        description: m.description,
        amount: m.amount,
        duration: m.duration,
        deliverableType: m.deliverableType,
        retentionAmount: m.retentionAmount,
        acceptanceCriteria: (m.acceptanceCriteria || [])
          .map((criterion) => criterion.value.trim())
          .filter(Boolean),
        startDate: normalizeDatePayload(m.startDate),
        dueDate: normalizeDatePayload(m.dueDate),
        sortOrder: index + 1,
      })),
      richContentJson: narrativeHasContent(richContentJson)
        ? richContentJson || undefined
        : undefined,
    };

    onSubmit(payload);
  };

  const milestoneSum = calculatedBudget;
  const budget = calculatedBudget;

  return (
    <Form {...form}>
      <form className="space-y-8 max-w-4xl mx-auto py-6">
        {/* HEADER & WARNINGS */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Project Specification</h1>
          <p className="text-muted-foreground">
            Define the scope, features, and milestones for the freelancer-facing
            specification.
          </p>
        </div>

        {form.formState.submitCount > 0 && !form.formState.isValid && (
          <Alert variant="destructive">
            <AlertTitle>Form has validation errors</AlertTitle>
            <AlertDescription>
              Please review the highlighted fields. The first invalid field has
              been focused.
            </AlertDescription>
          </Alert>
        )}

        {warnings.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Governance Warnings</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4 mt-2">
                {warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* 1. GENERAL INFO */}
        <Card>
          <CardHeader>
            <CardTitle>1. General Information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Title</FormLabel>
                  <FormControl>
                    <Input placeholder="E-commerce Platform..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Executive Summary</FormLabel>
                  <CardDescription className="mb-2">
                    Keep this short and concrete. Use the detailed scope notes below for narrative, assumptions, exclusions, and structured bullets.
                  </CardDescription>
                  <FormControl>
                    <Textarea className="min-h-[100px]" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="techStack"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Tech Stack
                    {projectRequest?.techPreferences && (
                      <span className="ml-2 text-xs text-muted-foreground font-normal">
                        (Client preferred: {projectRequest.techPreferences})
                      </span>
                    )}
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="React, NestJS, PostgreSQL, Redis..."
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Specify required technologies.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Detailed Scope Notes</CardTitle>
            <CardDescription>
              Write the broker-authored narrative that explains delivery notes,
              exclusions, review guidance, and scope clarifications. This
              content is frozen into the contract that parties sign.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <SpecNarrativeEditor
              value={richContentJson}
              onChange={setRichContentJson}
            />
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600">
              Use headings, bullets, numbered steps, checklists, quotes, links,
              and dividers to make the scope read like a polished spec instead
              of a raw form dump.
            </div>
          </CardContent>
        </Card>

        {/* 3. FEATURES & CRITERIA */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>3. Features & Acceptance Criteria</CardTitle>
              <CardDescription>
                Define functional requirements in detail.
              </CardDescription>
            </div>
            <Button
              type="button"
              onClick={() =>
                appendFeature({
                  title: "",
                  description: "",
                  complexity: "MEDIUM",
                  acceptanceCriteria: [{ value: "" }],
                })
              }
            >
              <Plus className="w-4 h-4 mr-2" /> Add Feature
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <Accordion type="multiple" className="w-full">
              {featureFields.map((field, index) => (
                <AccordionItem key={field.id} value={field.id}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-4 w-full">
                      <span className="font-semibold">Feature {index + 1}</span>
                      <Badge variant="outline">
                        {form.watch(`features.${index}.complexity`)}
                      </Badge>
                      <span className="text-muted-foreground font-normal truncate max-w-[300px]">
                        {form.watch(`features.${index}.title`) || "Untitled"}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-4 border rounded-md mt-2 space-y-4 bg-muted/10">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name={`features.${index}.title`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Feature Name</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`features.${index}.complexity`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Complexity</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="LOW">
                                  Low (Simple CRUD)
                                </SelectItem>
                                <SelectItem value="MEDIUM">
                                  Medium (Logic involved)
                                </SelectItem>
                                <SelectItem value="HIGH">
                                  High (Complex algo/integration)
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name={`features.${index}.description`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Acceptance Criteria Sub-List */}
                    <AcceptanceCriteriaList
                      nestIndex={index}
                      control={form.control}
                    />

                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => removeFeature(index)}
                      className="mt-2"
                    >
                      <Trash2 className="w-4 h-4 mr-2" /> Remove Feature
                    </Button>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            {featureFields.length === 0 && (
              <p className="text-center text-muted-foreground py-4">
                No features added yet.
              </p>
            )}
          </CardContent>
        </Card>

        {/* 4. BUDGET & MILESTONES */}
        <Card>
          <CardHeader>
            <CardTitle>4. Budget & Milestones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg border bg-muted/40 p-4">
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-medium">
                    Total Budget (auto-calculated)
                    {projectRequest?.budgetRange && (
                      <span className="ml-2 text-xs text-muted-foreground font-normal">
                        Client Range: {projectRequest.budgetRange}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Budget is computed from milestone amounts to avoid mismatch
                    and input jumping.
                  </p>
                  {budgetCap !== null && (
                    <p className="text-xs text-muted-foreground">
                      Approved client budget cap: $
                      {budgetCap.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  )}
                </div>
                <p className="text-2xl font-bold tabular-nums">
                  $
                  {budget.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>

            {isOverApprovedBudget && (
              <Alert variant="destructive">
                <AlertTitle>Budget exceeds approved cap</AlertTitle>
                <AlertDescription>
                  Milestone total is $
                  {budget.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}
                  , which exceeds the approved client budget of $
                  {budgetCap?.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}
                  .
                </AlertDescription>
              </Alert>
            )}

            <Separator />

            {milestoneFields.map((field, index) => (
              <div
                key={field.id}
                className="p-4 border rounded-lg bg-card text-card-foreground shadow-sm relative"
              >
                <div className="absolute top-4 right-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removeMilestone(index)}
                    disabled={milestoneFields.length <= 1}
                  >
                    <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
                <div className="grid gap-4">
                  <h4 className="font-semibold flex items-center gap-2">
                    Milestone {index + 1}
                    {index === 0 && (
                      <Badge variant="secondary">Deposit (Max 30%)</Badge>
                    )}
                    {index === milestoneFields.length - 1 && (
                      <Badge variant="secondary">Final (Min 20%)</Badge>
                    )}
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name={`milestones.${index}.title`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Title</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Phase 1" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`milestones.${index}.amount`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amount ($)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              inputMode="decimal"
                              onWheel={stopNumberFieldScroll}
                              onKeyDown={preventArrowStep}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name={`milestones.${index}.deliverableType`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Deliverable Type</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem
                                value={DeliverableType.DESIGN_PROTOTYPE}
                              >
                                Design Prototype (Figma)
                              </SelectItem>
                              <SelectItem value={DeliverableType.API_DOCS}>
                                API Docs (Swagger)
                              </SelectItem>
                              <SelectItem value={DeliverableType.SOURCE_CODE}>
                                Source Code (Git)
                              </SelectItem>
                              <SelectItem value={DeliverableType.DEPLOYMENT}>
                                Live Deployment
                              </SelectItem>
                              <SelectItem
                                value={DeliverableType.SYS_OPERATION_DOCS}
                              >
                                SysOps Docs (Docker)
                              </SelectItem>
                              <SelectItem
                                value={DeliverableType.CREDENTIAL_VAULT}
                              >
                                Credential Vault
                              </SelectItem>
                              <SelectItem value={DeliverableType.OTHER}>
                                Other
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`milestones.${index}.retentionAmount`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Retention ($) (Warranty Hold)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              inputMode="decimal"
                              onWheel={stopNumberFieldScroll}
                              onKeyDown={preventArrowStep}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="rounded-lg border border-dashed bg-muted/20 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Secondary milestone details
                        </p>
                        <p className="text-xs text-muted-foreground">
                          These details are copied into the frozen contract schedule.
                        </p>
                      </div>
                      <Badge variant="outline">Contract-facing</Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name={`milestones.${index}.startDate`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Start date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`milestones.${index}.dueDate`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Due date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="mt-4">
                      <MilestoneAcceptanceCriteriaList
                        nestIndex={index}
                        control={form.control}
                      />
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name={`milestones.${index}.description`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Deliverables Description</FormLabel>
                        <FormControl>
                          <Textarea {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              className="w-full dashed"
              onClick={() =>
                appendMilestone({
                  title: "",
                  description: "",
                  amount: 0,
                  deliverableType: DeliverableType.SOURCE_CODE,
                  retentionAmount: 0,
                  acceptanceCriteria: [],
                  startDate: "",
                  dueDate: "",
                })
              }
            >
              <Plus className="w-4 h-4 mr-2" /> Add Milestone
            </Button>

            {/* Budget Check Footer */}
            <div
              className={`p-4 rounded-md border text-sm flex justify-between items-center bg-muted`}
            >
              <span>
                Total Budget (Calculated): <strong>${budget}</strong>
              </span>
              <span>
                Milestone Sum: <strong>${milestoneSum}</strong>
              </span>
            </div>
            {form.formState.errors.root?.message && (
              <Alert variant="destructive">
                <AlertDescription>
                  {form.formState.errors.root.message}
                </AlertDescription>
              </Alert>
            )}
            {/* Explicit error for last milestone rule if refined generally */}
            {form.formState.errors.milestones?.root?.message && (
              <p className="text-destructive text-sm font-medium">
                {form.formState.errors.milestones.root.message}
              </p>
            )}
          </CardContent>
        </Card>

        {/* ACTIONS */}
        <div className="flex justify-end gap-4 pb-20">
          <Button
            type="button"
            variant="outline"
            onClick={() => window.history.back()}
          >
            Cancel
          </Button>

          {!isPhasedFlow && (
            <Button
              type="button"
              variant="secondary"
              disabled={isSubmitting || isOverApprovedBudget}
              onClick={form.handleSubmit(
                (d) => handleSubmit(d, "DRAFT"),
                handleInvalidSubmit,
              )}
            >
              Save Draft
            </Button>
          )}

          <Button
            type="button"
            disabled={isSubmitting || isOverApprovedBudget}
            size="lg"
            className="bg-green-600 hover:bg-green-700"
            onClick={form.handleSubmit(
              (d) =>
                handleSubmit(d, isPhasedFlow ? "DRAFT" : "PENDING_APPROVAL"),
              handleInvalidSubmit,
            )}
          >
            {isSubmitting
              ? "Submitting..."
              : submitLabel ||
                (isPhasedFlow
                  ? "Create Full Spec Draft"
                  : "Submit for Approval")}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
// SUB-COMPONENT: Acceptance Criteria List
// 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

function AcceptanceCriteriaList({
  nestIndex,
  control,
}: {
  nestIndex: number;
  control: any;
}) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `features.${nestIndex}.acceptanceCriteria`,
  });

  return (
    <div className="space-y-3 pl-4 border-l-2 border-primary/20">
      <div className="flex justify-between items-center">
        <FormLabel className="text-xs uppercase tracking-wide text-muted-foreground">
          Acceptance Criteria (Checklist)
        </FormLabel>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ value: "" })}
        >
          <Plus className="w-3 h-3 mr-1" /> Add Criteria
        </Button>
      </div>
      {fields.map((item, k) => (
        <div key={item.id} className="flex gap-2 items-center">
          <FormField
            control={control}
            name={`features.${nestIndex}.acceptanceCriteria.${k}.value`}
            render={({ field }) => (
              <FormItem className="flex-1 space-y-0">
                <FormControl>
                  <Input
                    placeholder="e.g. User receives 2FA email within 1 minute"
                    {...field}
                    className="h-8 text-sm"
                  />
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            onClick={() => remove(k)}
            disabled={fields.length <= 1}
          >
            {/* Prevent deleting last one to force at least 1 rule */}
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}

function MilestoneAcceptanceCriteriaList({
  nestIndex,
  control,
}: {
  nestIndex: number;
  control: any;
}) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `milestones.${nestIndex}.acceptanceCriteria`,
  });

  return (
    <div className="space-y-3 border-l-2 border-primary/20 pl-4">
      <div className="flex items-center justify-between">
        <FormLabel className="text-xs uppercase tracking-wide text-muted-foreground">
          Acceptance criteria
        </FormLabel>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ value: "" })}
        >
          <Plus className="mr-1 h-3 w-3" /> Add criterion
        </Button>
      </div>
      {fields.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Add the concrete checks that must be satisfied before this milestone can be approved.
        </p>
      )}
      {fields.map((item, k) => (
        <div key={item.id} className="flex items-start gap-2">
          <FormField
            control={control}
            name={`milestones.${nestIndex}.acceptanceCriteria.${k}.value`}
            render={({ field }) => (
              <FormItem className="flex-1 space-y-0">
                <FormControl>
                  <Input
                    placeholder="e.g. API documentation is complete and approved"
                    {...field}
                    className="h-9 text-sm"
                  />
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 text-muted-foreground"
            onClick={() => remove(k)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}
