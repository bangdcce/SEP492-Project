import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { useEffect, useMemo } from "react";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/shared/components/ui/card";
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
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
  SpecNarrativeEditor,
  narrativeHasContent,
} from "@/shared/components/rich-text/SpecNarrative";

import { DeliverableType } from "../types";
import type { ClientFeatureDTO, CreateProjectSpecDTO } from "../types";

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

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const HTTP_URL_PATTERN = /^https?:\/\/[\w.-]+\.[a-z]{2,}.*$/i;

const toLocalDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getTodayDateKey = () => toLocalDateKey(new Date());

const normalizeDateOnly = (value?: string | null): string | undefined => {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (DATE_ONLY_PATTERN.test(trimmed)) {
    return trimmed;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return toLocalDateKey(parsed);
};

const parseDateOnly = (value?: string | null): Date | null => {
  const normalized = normalizeDateOnly(value);
  if (!normalized) return null;
  const parsed = new Date(`${normalized}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const addDaysToDateKey = (
  value?: string | null,
  days = 0,
): string | undefined => {
  const baseDate = parseDateOnly(value);
  if (!baseDate) {
    return undefined;
  }

  const shifted = new Date(baseDate);
  shifted.setDate(shifted.getDate() + days);
  return toLocalDateKey(shifted);
};

const laterDateKey = (left?: string | null, right?: string | null): string => {
  const leftDate = parseDateOnly(left);
  const rightDate = parseDateOnly(right);

  if (!leftDate && !rightDate) {
    return getTodayDateKey();
  }
  if (!leftDate) {
    return normalizeDateOnly(right) || getTodayDateKey();
  }
  if (!rightDate) {
    return normalizeDateOnly(left) || getTodayDateKey();
  }

  return leftDate.getTime() >= rightDate.getTime()
    ? normalizeDateOnly(left) || getTodayDateKey()
    : normalizeDateOnly(right) || getTodayDateKey();
};

const normalizeReferenceUrl = (value?: string): string => {
  const trimmed = value?.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (/^[\w.-]+\.[a-z]{2,}.*$/i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
};

const referenceLinkSchema = z.object({
  label: z.string().min(1, "Link label is required"),
  url: z
    .string()
    .transform((value) => normalizeReferenceUrl(value))
    .refine((value) => HTTP_URL_PATTERN.test(value), {
      message: "Use a valid http(s) URL",
    }),
});

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
    approvedClientFeatureIds: z.array(z.string()).default([]),
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
    const today = parseDateOnly(getTodayDateKey());
    const startDate = parseDateOnly(milestone.startDate);
    const dueDate = parseDateOnly(milestone.dueDate);

    if (milestone.retentionAmount > milestone.amount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["retentionAmount"],
        message: "Retention cannot exceed the milestone amount",
      });
    }

    if (milestone.retentionAmount > milestone.amount * 0.1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["retentionAmount"],
        message: "Retention cannot exceed 10% of the milestone amount",
      });
    }

    if (milestone.startDate && !startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startDate"],
        message: "Start date is invalid",
      });
    }

    if (milestone.dueDate && !dueDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dueDate"],
        message: "Due date is invalid",
      });
    }

    if (today && startDate && startDate.getTime() < today.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startDate"],
        message: "Start date cannot be in the past",
      });
    }

    if (today && dueDate) {
      const minDueDate =
        startDate && startDate.getTime() > today.getTime() ? startDate : today;
      if (dueDate.getTime() < minDueDate.getTime()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["dueDate"],
          message: "Due date must be on or after today and the start date",
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
  return normalizeDateOnly(value);
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
    referenceLinks: z.array(referenceLinkSchema).optional(),

    // Validation: Features
    features: z
      .array(
        z.object({
          id: z.string().optional(),
          title: z.string().min(1, "Feature title is required"),
          description: z.string().min(1, "Description is required"),
          complexity: z.enum(["LOW", "MEDIUM", "HIGH"]),
          approvedClientFeatureIds: z.array(z.string()).default([]),
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
    milestones: z
      .array(milestoneSchema)
      .min(1, "At least one milestone is required"),
    changeSummary: z.string().optional(),
    richContentJson: z.record(z.string(), z.unknown()).nullable().optional(),
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
  );

type FormValues = z.infer<typeof formSchema>;

// 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
// COMPONENT
// 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

interface CreateProjectSpecFormProps {
  requestId: string;
  projectRequest?: any; // Avoiding full type import to prevent circular deps or complex imports, or better use the type if available
  onSubmit: (data: CreateProjectSpecDTO) => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
  isPhasedFlow?: boolean;
  initialValues?: Partial<CreateProjectSpecDTO> | null;
  submitLabel?: string;
  approvedBudgetCap?: number | null;
  approvedClientFeatures?: ClientFeatureDTO[];
  approvedDeliveryDeadline?: string | null;
  requestedDeadline?: string | null;
  projectGoalSummary?: string | null;
  lockedProjectCategory?: string | null;
  requireChangeSummary?: boolean;
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

const sumMilestoneRetention = (
  milestones:
    | Array<{ amount?: unknown; retentionAmount?: unknown }>
    | undefined,
): number =>
  (milestones || []).reduce((acc, milestone) => {
    const amount =
      typeof milestone?.amount === "string"
        ? parseFloat(milestone.amount)
        : Number(milestone?.amount);
    const retention =
      typeof milestone?.retentionAmount === "string"
        ? parseFloat(milestone.retentionAmount)
        : Number(milestone?.retentionAmount);

    const safeAmount = Number.isFinite(amount) ? Math.max(amount, 0) : 0;
    const safeRetention = Number.isFinite(retention)
      ? Math.max(Math.min(retention, safeAmount), 0)
      : 0;

    return acc + safeRetention;
  }, 0);

const sumMilestonePayableNow = (
  milestones:
    | Array<{ amount?: unknown; retentionAmount?: unknown }>
    | undefined,
): number =>
  (milestones || []).reduce((acc, milestone) => {
    const amount =
      typeof milestone?.amount === "string"
        ? parseFloat(milestone.amount)
        : Number(milestone?.amount);
    const retention =
      typeof milestone?.retentionAmount === "string"
        ? parseFloat(milestone.retentionAmount)
        : Number(milestone?.retentionAmount);

    const safeAmount = Number.isFinite(amount) ? Math.max(amount, 0) : 0;
    const safeRetention = Number.isFinite(retention)
      ? Math.max(Math.min(retention, safeAmount), 0)
      : 0;

    return acc + Math.max(safeAmount - safeRetention, 0);
  }, 0);

const sortedScheduleMilestones = (
  milestones: Array<{
    startDate?: string;
    dueDate?: string;
    amount?: number;
    retentionAmount?: number;
  }>,
) =>
  milestones.map((milestone, index) => ({
    ...milestone,
    index,
  }));

export function CreateProjectSpecForm({
  requestId,
  projectRequest,
  onSubmit,
  onCancel,
  isSubmitting,
  isPhasedFlow = false,
  initialValues = null,
  submitLabel,
  approvedBudgetCap = null,
  approvedClientFeatures = [],
  approvedDeliveryDeadline = null,
  requestedDeadline = null,
  projectGoalSummary = null,
  lockedProjectCategory = null,
  requireChangeSummary = false,
}: CreateProjectSpecFormProps) {
  const stopNumberFieldScroll = (event: React.WheelEvent<HTMLInputElement>) => {
    event.currentTarget.blur();
  };
  const preventArrowStep = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
    }
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      title: "",
      description: "",
      techStack: "",
      referenceLinks: [],
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
          approvedClientFeatureIds: [],
        },
      ],
      changeSummary: "",
      richContentJson: null,
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

  const {
    fields: referenceLinkFields,
    append: appendReferenceLink,
    remove: removeReferenceLink,
  } = useFieldArray({
    control: form.control,
    name: "referenceLinks",
  });

  // Real-time Warning Check
  const watchedMilestones = useWatch({
    control: form.control,
    name: "milestones",
  });
  const watchedDescription = useWatch({
    control: form.control,
    name: "description",
  });
  const watchedFeatures = useWatch({
    control: form.control,
    name: "features",
  });
  const watchedReferenceLinks = useWatch({
    control: form.control,
    name: "referenceLinks",
  });
  const watchedChangeSummary = useWatch({
    control: form.control,
    name: "changeSummary",
  });
  const watchedRichContentJson = useWatch({
    control: form.control,
    name: "richContentJson",
  });
  const narrativeContent = watchedRichContentJson as
    | Record<string, unknown>
    | null
    | undefined;
  const calculatedBudget = sumMilestones(watchedMilestones);
  const totalRetentionHold = sumMilestoneRetention(watchedMilestones);
  const totalPayableOnApproval = sumMilestonePayableNow(watchedMilestones);
  const budgetCap =
    typeof approvedBudgetCap === "number" ? approvedBudgetCap : null;
  const isApprovedBudgetMismatch =
    budgetCap !== null && Math.abs(calculatedBudget - budgetCap) > 0.01;
  const todayDateKey = getTodayDateKey();
  const normalizedApprovedDeadline =
    normalizeDateOnly(approvedDeliveryDeadline) || null;
  const approvedFeatureOptions = approvedClientFeatures.filter(
    (feature): feature is ClientFeatureDTO & { id: string } =>
      Boolean(feature.id && feature.title),
  );
  const coveredApprovedFeatureIds = new Set<string>();
  watchedFeatures?.forEach((feature) => {
    (feature?.approvedClientFeatureIds || []).forEach((featureId) => {
      if (featureId) {
        coveredApprovedFeatureIds.add(featureId);
      }
    });
  });
  watchedMilestones?.forEach((milestone) => {
    (milestone?.approvedClientFeatureIds || []).forEach((featureId) => {
      if (featureId) {
        coveredApprovedFeatureIds.add(featureId);
      }
    });
  });
  const uncoveredApprovedFeatures = approvedFeatureOptions.filter(
    (feature) => !coveredApprovedFeatureIds.has(feature.id),
  );
  const lastMilestoneIndex = Math.max((watchedMilestones?.length || 1) - 1, 0);
  const allocatedPercent =
    budgetCap && budgetCap > 0 ? (calculatedBudget / budgetCap) * 100 : null;
  const remainingBudget =
    budgetCap !== null
      ? Number((budgetCap - calculatedBudget).toFixed(2))
      : null;
  const remainingPercent =
    budgetCap && budgetCap > 0 && remainingBudget !== null
      ? Number(((remainingBudget / budgetCap) * 100).toFixed(2))
      : null;

  const getMilestonePercent = (amount?: unknown) => {
    const numericAmount =
      typeof amount === "string" ? parseFloat(amount) : Number(amount || 0);
    if (!Number.isFinite(numericAmount)) {
      return 0;
    }
    if (budgetCap && budgetCap > 0) {
      return (numericAmount / budgetCap) * 100;
    }
    if (calculatedBudget > 0) {
      return (numericAmount / calculatedBudget) * 100;
    }
    return 0;
  };

  const updateMilestonePercent = (index: number, nextPercentValue: string) => {
    if (budgetCap === null || budgetCap <= 0) {
      return;
    }

    if (nextPercentValue.trim() === "") {
      form.setValue(`milestones.${index}.amount`, 0, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      return;
    }

    const numericPercent = Number(nextPercentValue);
    if (!Number.isFinite(numericPercent) || numericPercent < 0) {
      return;
    }

    const nextAmount = Number(((budgetCap * numericPercent) / 100).toFixed(2));
    form.setValue(`milestones.${index}.amount`, nextAmount, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  };

  const warnings = useMemo(() => {
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

    return newWarnings;
  }, [watchedDescription, watchedFeatures]);

  useEffect(() => {
    if (!initialValues) return;

    const mappedFeatures =
      initialValues.features && initialValues.features.length > 0
        ? initialValues.features.map((feature) => ({
            id: feature.id || undefined,
            title: feature.title || "",
            description: feature.description || "",
            complexity: feature.complexity || "MEDIUM",
            approvedClientFeatureIds: feature.approvedClientFeatureIds || [],
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
              approvedClientFeatureIds:
                milestone.approvedClientFeatureIds || [],
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
              approvedClientFeatureIds: [],
            },
          ];

    form.reset({
      title: initialValues.title || "",
      description: initialValues.description || "",
      techStack: initialValues.techStack || "",
      referenceLinks: initialValues.referenceLinks || [],
      features: mappedFeatures,
      milestones: mappedMilestones,
      changeSummary: initialValues.changeSummary || "",
      richContentJson:
        (initialValues.richContentJson as
          | Record<string, unknown>
          | null
          | undefined) || null,
    });
  }, [form, initialValues]);

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
    if (errors.changeSummary) {
      form.setFocus("changeSummary");
      return;
    }

    const featureErrors = Array.isArray(errors.features) ? errors.features : [];
    const referenceLinkErrors = Array.isArray(errors.referenceLinks)
      ? errors.referenceLinks
      : [];
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

    for (let index = 0; index < referenceLinkErrors.length; index += 1) {
      const linkError = referenceLinkErrors[index];
      if (linkError?.label) {
        form.setFocus(`referenceLinks.${index}.label`);
        return;
      }
      if (linkError?.url) {
        form.setFocus(`referenceLinks.${index}.url`);
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
    form.clearErrors();

    if (budgetCap !== null && Math.abs(milestoneBudget - budgetCap) > 0.01) {
      form.setError("root", {
        type: "manual",
        message: `Milestone total must match the approved commercial budget of $${budgetCap.toLocaleString(
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

    const referenceBudgetForMilestoneRules =
      budgetCap && budgetCap > 0 ? budgetCap : milestoneBudget;
    if (referenceBudgetForMilestoneRules > 0 && values.milestones.length > 0) {
      const firstAmount = Number(values.milestones[0]?.amount || 0);
      const firstPercent =
        (firstAmount / referenceBudgetForMilestoneRules) * 100;

      if (firstPercent > 30.0001) {
        form.setError("milestones.0.amount", {
          type: "manual",
          message:
            "First milestone cannot exceed 30% of the validated budget baseline.",
        });
        form.setFocus("milestones.0.amount");
        return;
      }

      const finalMilestoneIndex = values.milestones.length - 1;
      const finalAmount = Number(
        values.milestones[finalMilestoneIndex]?.amount || 0,
      );
      const finalPercent =
        (finalAmount / referenceBudgetForMilestoneRules) * 100;

      if (finalPercent + 0.0001 < 20) {
        form.setError(`milestones.${finalMilestoneIndex}.amount`, {
          type: "manual",
          message:
            "Final milestone must be at least 20% of the validated budget baseline.",
        });
        form.setFocus(`milestones.${finalMilestoneIndex}.amount`);
        return;
      }
    }

    if (requireChangeSummary && !values.changeSummary?.trim()) {
      form.setError("changeSummary", {
        type: "manual",
        message: "Summarize what changed before resubmitting this revision.",
      });
      form.setFocus("changeSummary");
      return;
    }

    let previousDueDateKey: string | null = null;
    for (const milestone of sortedScheduleMilestones(values.milestones)) {
      const amount = Number(milestone.amount || 0);
      const retentionAmount = Number(milestone.retentionAmount || 0);
      const startDateKey = normalizeDateOnly(milestone.startDate);
      const dueDateKey = normalizeDateOnly(milestone.dueDate);

      if (retentionAmount > amount * 0.1 + 0.0001) {
        form.setError(`milestones.${milestone.index}.retentionAmount`, {
          type: "manual",
          message: "Retention cannot exceed 10% of the milestone amount.",
        });
        form.setFocus(`milestones.${milestone.index}.retentionAmount`);
        return;
      }

      if (!startDateKey) {
        form.setError(`milestones.${milestone.index}.startDate`, {
          type: "manual",
          message: "Start date is required.",
        });
        form.setFocus(`milestones.${milestone.index}.startDate`);
        return;
      }

      if (!dueDateKey) {
        form.setError(`milestones.${milestone.index}.dueDate`, {
          type: "manual",
          message: "Due date is required.",
        });
        form.setFocus(`milestones.${milestone.index}.dueDate`);
        return;
      }

      if (previousDueDateKey && startDateKey <= previousDueDateKey) {
        form.setError(`milestones.${milestone.index}.startDate`, {
          type: "manual",
          message:
            "Milestones must stay sequential. This start date must be after the previous milestone due date.",
        });
        form.setFocus(`milestones.${milestone.index}.startDate`);
        return;
      }

      if (
        normalizedApprovedDeadline &&
        dueDateKey > normalizedApprovedDeadline
      ) {
        form.setError(`milestones.${milestone.index}.dueDate`, {
          type: "manual",
          message: `Due date cannot exceed the approved delivery deadline ${normalizedApprovedDeadline}.`,
        });
        form.setFocus(`milestones.${milestone.index}.dueDate`);
        return;
      }

      previousDueDateKey = dueDateKey;
    }

    if (normalizedApprovedDeadline) {
      const finalMilestone = values.milestones[values.milestones.length - 1];
      const finalMilestoneDueDate = normalizeDateOnly(finalMilestone?.dueDate);
      if (finalMilestoneDueDate !== normalizedApprovedDeadline) {
        form.setError(`milestones.${values.milestones.length - 1}.dueDate`, {
          type: "manual",
          message: `The final milestone must finish exactly on ${normalizedApprovedDeadline}.`,
        });
        form.setFocus(`milestones.${values.milestones.length - 1}.dueDate`);
        return;
      }
    }

    const milestoneFeatureAssignments = new Map<string, number>();
    for (
      let milestoneIndex = 0;
      milestoneIndex < values.milestones.length;
      milestoneIndex += 1
    ) {
      const uniqueFeatureIds = Array.from(
        new Set(
          (values.milestones[milestoneIndex]?.approvedClientFeatureIds || [])
            .map((featureId) => featureId?.trim())
            .filter((featureId): featureId is string => Boolean(featureId)),
        ),
      );

      for (const featureId of uniqueFeatureIds) {
        const alreadyOwnedBy = milestoneFeatureAssignments.get(featureId);
        if (alreadyOwnedBy !== undefined) {
          form.setError(
            `milestones.${milestoneIndex}.approvedClientFeatureIds`,
            {
              type: "manual",
              message: `This feature is already assigned in Milestone ${alreadyOwnedBy + 1}. Each approved feature can only be mapped once across milestones.`,
            },
          );
          form.setError("root", {
            type: "manual",
            message:
              "Approved client-facing features cannot be duplicated across milestones. Keep one owner milestone per feature.",
          });
          return;
        }

        milestoneFeatureAssignments.set(featureId, milestoneIndex);
      }
    }

    if (
      approvedFeatureOptions.length > 0 &&
      uncoveredApprovedFeatures.length > 0
    ) {
      form.setError("root", {
        type: "manual",
        message: `Map every approved client-facing feature into the technical scope. Missing coverage: ${uncoveredApprovedFeatures
          .map((feature) => feature.title)
          .join(", ")}.`,
      });
      return;
    }

    // Transform data to match DTO
    const payload: CreateProjectSpecDTO = {
      requestId,
      status: status as any, // Cast to enum
      title: values.title.trim(),
      description: values.description.trim(),
      totalBudget: milestoneBudget,
      techStack: values.techStack.trim(),
      referenceLinks: values.referenceLinks?.length
        ? values.referenceLinks.map((link) => ({
            label: link.label.trim(),
            url: normalizeReferenceUrl(link.url),
          }))
        : undefined,
      features: values.features?.map((f) => ({
        id: f.id,
        title: f.title.trim(),
        description: f.description.trim(),
        complexity: f.complexity,
        acceptanceCriteria: f.acceptanceCriteria.map((ac) => ac.value.trim()),
        approvedClientFeatureIds: (f.approvedClientFeatureIds || []).filter(
          Boolean,
        ),
      })),
      milestones: values.milestones.map((m, index) => ({
        title: m.title.trim(),
        description: m.description.trim(),
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
        approvedClientFeatureIds: (m.approvedClientFeatureIds || []).filter(
          Boolean,
        ),
      })),
      richContentJson: narrativeHasContent(narrativeContent)
        ? narrativeContent || undefined
        : undefined,
      changeSummary: values.changeSummary?.trim() || undefined,
    };

    onSubmit(payload);
  };

  const milestoneSum = calculatedBudget;
  const budget = calculatedBudget;
  const retentionSharePercent =
    budget > 0 ? (totalRetentionHold / budget) * 100 : 0;
  const payableSharePercent =
    budget > 0 ? (totalPayableOnApproval / budget) * 100 : 0;

  return (
    <Form {...form}>
      <form className="mx-auto max-w-6xl space-y-8 py-6">
        {/* HEADER & WARNINGS */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Project Specification</h1>
          <p className="text-muted-foreground wrap-break-word">
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
            <AlertDescription className="whitespace-pre-wrap wrap-break-word">
              <ul className="list-disc pl-4 mt-2">
                {warnings.map((w, i) => (
                  <li key={i} className="wrap-break-word">
                    {w}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <Card className="border-slate-200 bg-slate-50/70">
          <CardHeader>
            <CardTitle className="text-base">Locked Baseline</CardTitle>
            <CardDescription>
              These request terms are fixed from the client request and approved
              client spec. The full spec must implement them, not rewrite them.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {normalizedApprovedDeadline ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                The final milestone must land exactly on the approved delivery
                deadline {normalizedApprovedDeadline}.
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-xl border bg-white p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  Product Type
                </p>
                <p className="mt-2 font-semibold text-slate-950 wrap-break-word">
                  {lockedProjectCategory || "Locked upstream"}
                </p>
              </div>
              <div className="rounded-xl border bg-white p-4 sm:col-span-2 xl:col-span-1">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  Project Goal
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700 wrap-break-word whitespace-pre-wrap">
                  {projectGoalSummary || "Locked upstream"}
                </p>
              </div>
              <div className="rounded-xl border bg-white p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  Requested / Agreed Deadline
                </p>
                <p className="mt-2 font-semibold text-slate-950 wrap-break-word">
                  {normalizedApprovedDeadline || requestedDeadline || "Not set"}
                </p>
                {requestedDeadline && normalizedApprovedDeadline ? (
                  <p className="mt-1 text-xs text-slate-500 wrap-break-word">
                    Request asked for {requestedDeadline}
                  </p>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        {approvedFeatureOptions.length > 0 && (
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-base">
                Approved Client Feature Coverage
              </CardTitle>
              <CardDescription>
                Every approved client-facing feature must be mapped into at
                least one technical feature or one milestone.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {approvedFeatureOptions.map((feature) => (
                  <Badge
                    key={feature.id}
                    variant="outline"
                    className={`max-w-full wrap-break-word whitespace-normal ${
                      coveredApprovedFeatureIds.has(feature.id)
                        ? "border-emerald-200 text-emerald-700"
                        : "border-amber-200 text-amber-700"
                    }`}
                  >
                    {coveredApprovedFeatureIds.has(feature.id)
                      ? "Covered"
                      : "Missing"}
                    : {feature.title}
                  </Badge>
                ))}
              </div>
              {uncoveredApprovedFeatures.length > 0 ? (
                <Alert>
                  <AlertTitle>Coverage still missing</AlertTitle>
                  <AlertDescription className="wrap-break-word whitespace-pre-wrap">
                    Map these approved client-facing features before submit:{" "}
                    {uncoveredApprovedFeatures
                      .map((feature) => feature.title)
                      .join(", ")}
                    .
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <AlertTitle>Coverage complete</AlertTitle>
                  <AlertDescription className="wrap-break-word whitespace-pre-wrap">
                    Every approved client-facing feature is mapped into the
                    technical scope draft.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
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
                    Keep this short and concrete. Use the detailed scope notes
                    below for narrative, assumptions, exclusions, and structured
                    bullets.
                  </CardDescription>
                  <FormControl>
                    <Textarea className="min-h-25" {...field} />
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
              value={narrativeContent || null}
              onChange={(value) => {
                form.setValue("richContentJson", value || null, {
                  shouldDirty: true,
                  shouldTouch: true,
                });
              }}
            />
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600">
              Use headings, bullets, numbered steps, checklists, quotes, links,
              and dividers to make the scope read like a polished spec instead
              of a raw form dump.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>3. Reference Links</CardTitle>
              <CardDescription>
                Add only working `http/https` links. Bare domains are
                auto-normalized to `https://`.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => appendReferenceLink({ label: "", url: "" })}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Link
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600">
              Examples: Figma file, Google Drive/Docs brief, GitHub/GitLab repo,
              Notion doc, staging/demo URL.
            </div>
            {referenceLinkFields.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No reference links added yet.
              </p>
            ) : (
              <div className="space-y-3">
                {referenceLinkFields.map((field, index) => (
                  <div
                    key={field.id}
                    className="grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-[1fr_2fr_auto]"
                  >
                    <FormField
                      control={form.control}
                      name={`referenceLinks.${index}.label`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Label</FormLabel>
                          <FormControl>
                            <Input placeholder="Figma wireframe" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`referenceLinks.${index}.url`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>URL</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="figma.com/file/..."
                              {...field}
                              onBlur={(event) => {
                                field.onBlur();
                                const normalized = normalizeReferenceUrl(
                                  event.target.value,
                                );
                                if (
                                  normalized &&
                                  normalized !== event.target.value
                                ) {
                                  form.setValue(
                                    `referenceLinks.${index}.url`,
                                    normalized,
                                    {
                                      shouldDirty: true,
                                      shouldTouch: true,
                                      shouldValidate: true,
                                    },
                                  );
                                }
                              }}
                            />
                          </FormControl>
                          <FormDescription>
                            Allowed schemes: `http://` or `https://`
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => removeReferenceLink(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {watchedReferenceLinks?.length ? (
              <div className="flex flex-wrap gap-2">
                {watchedReferenceLinks.map((link, index) => (
                  <Badge
                    key={`${link.label || "link"}-${index}`}
                    variant="outline"
                    className="max-w-full wrap-break-word whitespace-normal"
                  >
                    {link.label || `Link ${index + 1}`}
                  </Badge>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* 4. FEATURES & CRITERIA */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>4. Features & Acceptance Criteria</CardTitle>
              <CardDescription>
                Define functional requirements in detail.
              </CardDescription>
            </div>
            <Button
              type="button"
              onClick={() =>
                appendFeature({
                  id: undefined,
                  title: "",
                  description: "",
                  complexity: "MEDIUM",
                  approvedClientFeatureIds: [],
                  acceptanceCriteria: [{ value: "" }],
                })
              }
            >
              <Plus className="w-4 h-4 mr-2" /> Add Feature
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <Accordion type="multiple" className="w-full">
              {featureFields.map((field, index) => {
                const currentFeature = watchedFeatures?.[index];

                return (
                  <AccordionItem key={field.id} value={field.id}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex w-full flex-wrap items-center gap-2 pr-2">
                        <span className="font-semibold">
                          Feature {index + 1}
                        </span>
                        <Badge variant="outline">
                          {currentFeature?.complexity || "MEDIUM"}
                        </Badge>
                        <span className="min-w-0 flex-1 truncate text-muted-foreground font-normal max-w-75">
                          {currentFeature?.title || "Untitled"}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-4 border rounded-md mt-2 space-y-4 bg-muted/10">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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

                      <ApprovedFeatureCoverageSelector
                        control={form.control}
                        name={`features.${index}.approvedClientFeatureIds`}
                        approvedClientFeatures={approvedFeatureOptions}
                        label="Mapped approved client-facing features"
                        description="Tie this technical feature back to the approved client-facing requirements it implements."
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
                );
              })}
            </Accordion>
            {featureFields.length === 0 && (
              <p className="text-center text-muted-foreground py-4">
                No features added yet.
              </p>
            )}
          </CardContent>
        </Card>

        {/* 5. BUDGET & MILESTONES */}
        <Card>
          <CardHeader>
            <CardTitle>5. Budget & Milestones</CardTitle>
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
                    Budget is computed from milestone funded amounts. Warranty
                    retention is included inside each milestone amount (not
                    added on top).
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Split preview: release now ${" "}
                    {totalPayableOnApproval.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })}{" "}
                    | retention hold ${" "}
                    {totalRetentionHold.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })}
                  </p>
                  {budgetCap !== null && (
                    <p className="text-xs text-muted-foreground">
                      Approved commercial budget baseline: $
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

            {isApprovedBudgetMismatch && (
              <Alert variant="destructive">
                <AlertTitle>Budget does not match approved baseline</AlertTitle>
                <AlertDescription className="whitespace-pre-wrap wrap-break-word">
                  Milestone total is $
                  {budget.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}
                  , but the approved commercial budget is $
                  {budgetCap?.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}
                  . Adjust milestone amounts until the totals match exactly.
                  Retention is already counted inside each milestone amount.
                </AlertDescription>
              </Alert>
            )}

            <Separator />

            {milestoneFields.map((field, index) => {
              const currentMilestone = watchedMilestones?.[index];
              const currentMilestoneAmount = Number(
                currentMilestone?.amount || 0,
              );
              const currentMilestoneRetention = Number(
                currentMilestone?.retentionAmount || 0,
              );
              const currentMilestoneStartDate = currentMilestone?.startDate;
              const previousMilestoneDueDate =
                index > 0 ? watchedMilestones?.[index - 1]?.dueDate : undefined;
              const minimumSequentialStartDateKey =
                index > 0
                  ? addDaysToDateKey(previousMilestoneDueDate, 1)
                  : undefined;
              const startDateMinimum = laterDateKey(
                todayDateKey,
                minimumSequentialStartDateKey,
              );
              const dueDateMinimum = laterDateKey(
                startDateMinimum,
                currentMilestoneStartDate,
              );
              const featureIdsSelectedInOtherMilestones = new Set<string>();
              watchedMilestones?.forEach((milestone, milestoneIndex) => {
                if (milestoneIndex === index) {
                  return;
                }
                (milestone?.approvedClientFeatureIds || []).forEach(
                  (featureId) => {
                    if (featureId) {
                      featureIdsSelectedInOtherMilestones.add(featureId);
                    }
                  },
                );
              });
              const safeMilestoneAmount = Number.isFinite(
                currentMilestoneAmount,
              )
                ? Math.max(currentMilestoneAmount, 0)
                : 0;
              const safeMilestoneRetention = Number.isFinite(
                currentMilestoneRetention,
              )
                ? Math.max(
                    Math.min(currentMilestoneRetention, safeMilestoneAmount),
                    0,
                  )
                : 0;
              const currentMilestonePayableNow = Math.max(
                safeMilestoneAmount - safeMilestoneRetention,
                0,
              );
              const currentRetentionPercent =
                safeMilestoneAmount > 0
                  ? (safeMilestoneRetention / safeMilestoneAmount) * 100
                  : 0;

              return (
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
                    <h4 className="flex flex-wrap items-center gap-2 pr-12 font-semibold">
                      Milestone {index + 1}
                      {index === 0 && (
                        <Badge variant="secondary">Deposit (Max 30%)</Badge>
                      )}
                      {index === milestoneFields.length - 1 && (
                        <Badge variant="secondary">Final (Min 20%)</Badge>
                      )}
                    </h4>

                    <div className="grid grid-cols-1 gap-4">
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
                      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
                        <FormField
                          control={form.control}
                          name={`milestones.${index}.amount`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                Amount ($) (Total funded, includes retention)
                              </FormLabel>
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
                              <div className="min-h-10">
                                <FormDescription>
                                  {budgetCap !== null
                                    ? "This full milestone funding amount is checked against the approved commercial baseline."
                                    : "This full milestone funding amount is used to calculate project budget."}
                                </FormDescription>
                              </div>
                              <div className="min-h-5">
                                <FormMessage />
                              </div>
                            </FormItem>
                          )}
                        />
                        <FormItem>
                          <FormLabel>
                            {budgetCap !== null
                              ? "% of approved budget"
                              : "% of current total"}
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="0.1"
                              inputMode="decimal"
                              value={getMilestonePercent(
                                currentMilestoneAmount,
                              ).toFixed(2)}
                              onChange={(event) =>
                                updateMilestonePercent(
                                  index,
                                  event.target.value,
                                )
                              }
                              onWheel={stopNumberFieldScroll}
                              onKeyDown={preventArrowStep}
                              readOnly={budgetCap === null}
                            />
                          </FormControl>
                          <div className="min-h-10">
                            <FormDescription>
                              {budgetCap !== null
                                ? "Edit this field to update the milestone amount from the approved budget baseline."
                                : "Set an approved budget first to edit percentages directly."}
                            </FormDescription>
                          </div>
                          <div aria-hidden="true" className="min-h-5" />
                        </FormItem>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
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
                            <div className="min-h-5">
                              <FormMessage />
                            </div>
                            <div aria-hidden="true" className="min-h-10" />
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
                                max={Number(
                                  (currentMilestoneAmount * 0.1).toFixed(2),
                                )}
                                onWheel={stopNumberFieldScroll}
                                onKeyDown={preventArrowStep}
                                {...field}
                              />
                            </FormControl>
                            <div className="min-h-10">
                              <FormDescription>
                                Portion withheld as warranty hold and released
                                after acceptance/warranty checks. Cap: 10% of
                                this milestone amount. Current split: release
                                now ${" "}
                                {currentMilestonePayableNow.toLocaleString(
                                  undefined,
                                  {
                                    maximumFractionDigits: 2,
                                  },
                                )}{" "}
                                | hold ${" "}
                                {safeMilestoneRetention.toLocaleString(
                                  undefined,
                                  {
                                    maximumFractionDigits: 2,
                                  },
                                )}{" "}
                                ({currentRetentionPercent.toFixed(2)}%).
                              </FormDescription>
                            </div>
                            <div className="min-h-5">
                              <FormMessage />
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>

                    <ApprovedFeatureCoverageSelector
                      control={form.control}
                      name={`milestones.${index}.approvedClientFeatureIds`}
                      approvedClientFeatures={approvedFeatureOptions}
                      label="Approved client-facing features delivered in this milestone"
                      description="Map milestone output to the approved client-facing features it fulfills. Each approved feature should be owned by only one milestone."
                      blockedFeatureIds={Array.from(
                        featureIdsSelectedInOtherMilestones,
                      )}
                      blockedFeatureHint="Already mapped to another milestone. Remove it there first if you want to move ownership."
                    />

                    <div className="rounded-lg border border-dashed bg-muted/20 p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            Secondary milestone details
                          </p>
                          <p className="text-xs text-muted-foreground">
                            These details are copied into the frozen contract
                            schedule.
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
                                <Input
                                  type="date"
                                  min={startDateMinimum}
                                  {...field}
                                  value={field.value || ""}
                                />
                              </FormControl>
                              <FormDescription>
                                {minimumSequentialStartDateKey
                                  ? `Must be on or after ${minimumSequentialStartDateKey} so this milestone starts after the previous one ends.`
                                  : "Cannot be earlier than today."}
                              </FormDescription>
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
                                <Input
                                  type="date"
                                  min={dueDateMinimum}
                                  max={normalizedApprovedDeadline || undefined}
                                  {...field}
                                  value={field.value || ""}
                                />
                              </FormControl>
                              <FormDescription>
                                {index === lastMilestoneIndex &&
                                normalizedApprovedDeadline
                                  ? `This final milestone must end exactly on ${normalizedApprovedDeadline}.`
                                  : `Must be on or after today and the selected start date${
                                      normalizedApprovedDeadline
                                        ? `, and on or before ${normalizedApprovedDeadline}.`
                                        : "."
                                    }`}
                              </FormDescription>
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
              );
            })}

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
                  approvedClientFeatureIds: [],
                })
              }
            >
              <Plus className="w-4 h-4 mr-2" /> Add Milestone
            </Button>

            {/* Budget Check Footer */}
            <div className="grid gap-3 rounded-xl border bg-muted p-4 text-sm sm:grid-cols-2 xl:grid-cols-5">
              <div>
                <span className="text-muted-foreground">
                  Total Budget (Calculated)
                </span>
                <p className="font-semibold">${budget.toFixed(2)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">
                  Funded Milestones (incl. retention)
                </span>
                <p className="font-semibold">${milestoneSum.toFixed(2)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Retention Hold</span>
                <p className="font-semibold">
                  ${totalRetentionHold.toFixed(2)}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">
                  Payable On Approval
                </span>
                <p className="font-semibold">
                  ${totalPayableOnApproval.toFixed(2)}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">
                  {budgetCap !== null
                    ? "Remaining vs approved budget"
                    : "Milestone share"}
                </span>
                <p className="font-semibold">
                  {budgetCap !== null &&
                  remainingBudget !== null &&
                  remainingPercent !== null
                    ? `${remainingPercent.toFixed(2)}% / $${remainingBudget.toFixed(2)}`
                    : `${watchedMilestones.length} milestone${watchedMilestones.length === 1 ? "" : "s"}`}
                </p>
              </div>
            </div>
            {budget > 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                Funding split: {payableSharePercent.toFixed(2)}% payable on
                milestone approval and {retentionSharePercent.toFixed(2)}%
                retained as warranty hold (inside funded milestone amounts).
              </div>
            ) : null}
            {budgetCap !== null && allocatedPercent !== null ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 wrap-break-word whitespace-pre-wrap">
                Allocated {allocatedPercent.toFixed(2)}% of the approved budget
                baseline.
                {remainingBudget !== null && Math.abs(remainingBudget) > 0.01
                  ? " Milestone totals must land exactly on the approved baseline before submission."
                  : " Budget alignment is complete."}
              </div>
            ) : null}
            {form.formState.errors.root?.message && (
              <Alert variant="destructive">
                <AlertDescription className="wrap-break-word whitespace-pre-wrap">
                  {form.formState.errors.root.message}
                </AlertDescription>
              </Alert>
            )}
            {/* Explicit error for last milestone rule if refined generally */}
            {form.formState.errors.milestones?.root?.message && (
              <p className="text-destructive text-sm font-medium wrap-break-word whitespace-pre-wrap">
                {form.formState.errors.milestones.root.message}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>6. Revision Summary</CardTitle>
            <CardDescription>
              Explain what changed in this full spec draft.
              {requireChangeSummary
                ? " This is required because the previous revision was rejected."
                : " This becomes especially important when you resubmit after feedback."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="changeSummary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Change Summary</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value || ""}
                      className="min-h-30"
                      placeholder="Summarize budget alignment, timeline updates, scope clarifications, and milestone changes."
                    />
                  </FormControl>
                  <FormDescription>
                    Client and reviewers use this to understand what changed
                    between revisions.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            {!requireChangeSummary && watchedChangeSummary?.trim() ? (
              <p className="mt-3 text-sm text-slate-600">
                Revision note captured for this draft.
              </p>
            ) : null}
          </CardContent>
        </Card>

        {/* ACTIONS */}
        <div className="flex justify-end gap-4 pb-20">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>

          {!isPhasedFlow && (
            <Button
              type="button"
              variant="secondary"
              disabled={isSubmitting || isApprovedBudgetMismatch}
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
            disabled={isSubmitting || isApprovedBudgetMismatch}
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

function ApprovedFeatureCoverageSelector({
  control,
  name,
  approvedClientFeatures,
  label,
  description,
  blockedFeatureIds = [],
  blockedFeatureHint,
}: {
  control: any;
  name: string;
  approvedClientFeatures: Array<ClientFeatureDTO & { id: string }>;
  label: string;
  description: string;
  blockedFeatureIds?: string[];
  blockedFeatureHint?: string;
}) {
  if (approvedClientFeatures.length === 0) {
    return null;
  }

  const blockedFeatureIdSet = new Set(blockedFeatureIds.filter(Boolean));

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const selectedValues = Array.isArray(field.value) ? field.value : [];

        const toggleValue = (featureId: string, checked: boolean) => {
          if (
            checked &&
            blockedFeatureIdSet.has(featureId) &&
            !selectedValues.includes(featureId)
          ) {
            return;
          }

          const nextValues = checked
            ? Array.from(new Set([...selectedValues, featureId]))
            : selectedValues.filter((value: string) => value !== featureId);
          field.onChange(nextValues);
        };

        return (
          <FormItem className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="space-y-1">
              <FormLabel>{label}</FormLabel>
              <FormDescription>{description}</FormDescription>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {approvedClientFeatures.map((feature) => {
                const isChecked = selectedValues.includes(feature.id);
                const isBlocked = blockedFeatureIdSet.has(feature.id);
                const isDisabled = isBlocked && !isChecked;

                return (
                  <label
                    key={feature.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition ${
                      isDisabled
                        ? "cursor-not-allowed border-amber-200 bg-amber-50/50 opacity-70"
                        : ""
                    } ${
                      isChecked
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <Checkbox
                      checked={isChecked}
                      disabled={isDisabled}
                      onCheckedChange={(checked) =>
                        toggleValue(feature.id, Boolean(checked))
                      }
                    />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-slate-900">
                        {feature.title}
                      </p>
                      <p className="text-xs leading-5 text-slate-600">
                        {feature.description}
                      </p>
                      {isDisabled ? (
                        <p className="text-[11px] text-amber-700">
                          {blockedFeatureHint ||
                            "Already assigned to another milestone."}
                        </p>
                      ) : null}
                    </div>
                  </label>
                );
              })}
            </div>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}

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
      <div className="flex flex-wrap items-center justify-between gap-2">
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
      <div className="flex flex-wrap items-center justify-between gap-2">
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
          Add the concrete checks that must be satisfied before this milestone
          can be approved.
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
