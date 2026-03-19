import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  Progress,
  Spinner,
} from "@/shared/components/ui";
import { StepB1 } from "./components/StepB1";
import { StepB2 } from "./components/StepB2";
import { StepB3 } from "./components/StepB3";
import { StepB4 } from "./components/StepB4";
import { StepB5 } from "./components/StepB5";
import {
  type CreateProjectRequestDto,
  type ProjectRequestAttachment,
  type WizardQuestion,
  wizardService,
} from "./services/wizardService";
import { ROUTES } from "@/constants";
import { ArrowLeft, ArrowRight, Check, AlertCircle, Cloud, CloudOff, Save } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/shared/api/client";

const TOTAL_STEPS = 5;

type SubmitMode = "draft" | "marketplace" | "invite";
type AutosaveState = "idle" | "saving" | "saved" | "error";

type DraftRequestResponse = {
  id: string;
  title?: string | null;
  description?: string | null;
  budgetRange?: string | null;
  intendedTimeline?: string | null;
  status?: string | null;
  attachments?: ProjectRequestAttachment[] | null;
  wizardProgressStep?: number | null;
  answers?: Array<{
    valueText?: string | null;
    question?: { code?: string | null } | null;
    option?: { label?: string | null } | null;
  }>;
};

const autosaveCopy: Record<AutosaveState, string> = {
  idle: "Draft changes not saved yet",
  saving: "Saving draft...",
  saved: "Draft saved",
  error: "Draft save failed",
};

type KycProfileResponse = {
  status?: string | null;
};

export default function WizardPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const draftId = searchParams.get("draftId");

  const [currentStep, setCurrentStep] = useState(1);
  const [questions, setQuestions] = useState<WizardQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [kycStatus, setKycStatus] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(draftId);
  const [autosaveState, setAutosaveState] = useState<AutosaveState>("idle");

  const [productType, setProductType] = useState("");
  const [industry, setIndustry] = useState("");
  const [budget, setBudget] = useState("");
  const [timeline, setTimeline] = useState("");
  const [features, setFeatures] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [attachments, setAttachments] = useState<ProjectRequestAttachment[]>([]);

  const hydratingRef = useRef(true);
  const autosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestPayloadRef = useRef<string>("");

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const data = await wizardService.getQuestions();
        setQuestions(data);
      } catch (_error) {
        toast.error("Could not load wizard questions.");
      }
    };

    const checkKycStatus = async () => {
      try {
        const data = await apiClient.get<KycProfileResponse>("/kyc/me");
        setKycStatus(data.status || "NOT_STARTED");
      } catch (error) {
        console.error("Error checking KYC:", error);
      }
    };

    Promise.all([fetchQuestions(), checkKycStatus()]).finally(() => {
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!draftId) {
      hydratingRef.current = false;
      return;
    }

    const loadDraft = async () => {
      try {
        setLoading(true);
        const draft = (await wizardService.getRequestById(draftId)) as DraftRequestResponse;
        setRequestId(draft.id);
        setTitle(draft.title || "");
        setDescription(draft.description || "");
        setBudget(draft.budgetRange || "");
        setTimeline(draft.intendedTimeline || "");
        setAttachments(Array.isArray(draft.attachments) ? draft.attachments : []);
        setCurrentStep(Math.min(Math.max(draft.wizardProgressStep || 1, 1), TOTAL_STEPS));

        const answersByCode = new Map<string, string[]>();
        for (const answer of draft.answers || []) {
          const code = String(answer.question?.code || "").trim();
          if (!code) continue;
          const value = String(answer.valueText || answer.option?.label || "").trim();
          if (!value) continue;
          const existing = answersByCode.get(code) || [];
          existing.push(value);
          answersByCode.set(code, existing);
        }

        setProductType(answersByCode.get("PRODUCT_TYPE")?.[0] || "");
        setIndustry(answersByCode.get("INDUSTRY")?.[0] || "");
        setFeatures(answersByCode.get("FEATURES") || []);
        setAutosaveState("saved");
      } catch (error) {
        console.error("Failed to load draft", error);
        toast.error("Could not load the saved draft.");
      } finally {
        hydratingRef.current = false;
        setLoading(false);
      }
    };

    void loadDraft();
  }, [draftId]);

  const progress = (currentStep / TOTAL_STEPS) * 100;
  const canPublish = kycStatus === "APPROVED";

  const getQuestion = (code: string) => questions.find((question) => question.code === code);

  const buildPayload = (mode: SubmitMode): CreateProjectRequestDto => {
    const isDraftMode = mode === "draft";
    const answers: CreateProjectRequestDto["answers"] = [];
    const productTypeQuestion = getQuestion("PRODUCT_TYPE");
    const industryQuestion = getQuestion("INDUSTRY");
    const featuresQuestion = getQuestion("FEATURES");

    if (productTypeQuestion && productType) {
      answers.push({ questionId: productTypeQuestion.id, valueText: productType });
    }
    if (industryQuestion && industry) {
      answers.push({ questionId: industryQuestion.id, valueText: industry });
    }
    if (featuresQuestion && features.length > 0) {
      features.forEach((feature) => {
        answers.push({ questionId: featuresQuestion.id, valueText: feature });
      });
    }

    return {
      title: title.trim() || (isDraftMode ? "Draft Project Request" : "New Project Request"),
      description: description.trim() || "Project intake draft",
      budgetRange: budget || undefined,
      intendedTimeline: timeline || undefined,
      isDraft: isDraftMode,
      status:
        mode === "marketplace"
          ? "PUBLIC_DRAFT"
          : mode === "invite"
            ? "PRIVATE_DRAFT"
            : undefined,
      wizardProgressStep: currentStep,
      attachments,
      answers,
    };
  };

  const hasMeaningfulDraftContent = useMemo(
    () =>
      Boolean(
        title.trim() ||
          description.trim() ||
          productType ||
          industry ||
          budget ||
          timeline ||
          features.length ||
          attachments.length,
      ),
    [attachments.length, budget, description, features.length, industry, productType, timeline, title],
  );

  const persistDraft = async (showToast = false) => {
    if (!hasMeaningfulDraftContent) {
      return null;
    }

    const payload = buildPayload("draft");
    setAutosaveState("saving");

    try {
      const savedRequest = requestId
        ? await wizardService.updateRequest(requestId, payload)
        : await wizardService.submitRequest(payload);
      if (!requestId && savedRequest?.id) {
        setRequestId(savedRequest.id);
        setSearchParams({ draftId: savedRequest.id }, { replace: true });
      }
      setAutosaveState("saved");
      if (showToast) {
        toast.success("Draft saved.");
      }
      return savedRequest;
    } catch (error) {
      console.error("Failed to persist draft", error);
      setAutosaveState("error");
      if (showToast) {
        toast.error("Could not save draft.");
      }
      return null;
    }
  };

  useEffect(() => {
    if (hydratingRef.current || !questions.length || !hasMeaningfulDraftContent) {
      return;
    }

    const payloadKey = JSON.stringify({
      currentStep,
      productType,
      industry,
      budget,
      timeline,
      features,
      title,
      description,
      attachments,
    });

    if (payloadKey === latestPayloadRef.current) {
      return;
    }

    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }

    autosaveTimeoutRef.current = setTimeout(() => {
      latestPayloadRef.current = payloadKey;
      void persistDraft(false);
    }, 1200);

    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [
    attachments,
    budget,
    currentStep,
    description,
    features,
    hasMeaningfulDraftContent,
    industry,
    productType,
    questions.length,
    timeline,
    title,
  ]);

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS) setCurrentStep((previous) => previous + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep((previous) => previous - 1);
  };

  const handleSubmit = async (mode: SubmitMode) => {
    try {
      setSubmitting(true);

      if (mode !== "draft" && !canPublish) {
        toast.error("KYC approval is required before posting or inviting.");
        return;
      }

      if (mode === "draft") {
        await persistDraft(true);
        return;
      }

      const payload = buildPayload(mode);
      let savedRequest;
      if (requestId) {
          if (mode === 'marketplace') {
              const updatePayload: Partial<CreateProjectRequestDto> = {
                  title: payload.title,
                  description: payload.description,
                  budgetRange: payload.budgetRange,
                  intendedTimeline: payload.intendedTimeline,
                  techPreferences: payload.techPreferences,
                  answers: payload.answers,
              };
              await wizardService.updateRequest(requestId, updatePayload);
              savedRequest = await wizardService.publishRequest(requestId);
          } else {
              // Update existing
              savedRequest = await wizardService.updateRequest(requestId, payload);
          }
      } else {
          // Create new
          savedRequest = await wizardService.submitRequest(payload);
      }

      if (savedRequest?.id) {
        setRequestId(savedRequest.id);
      }

      if (mode === "marketplace") {
        toast.success("Request posted to the broker marketplace.");
        navigate(ROUTES.CLIENT_DASHBOARD);
        return;
      }

      toast.success("Draft is ready for broker outreach.");
      navigate(`/client/requests/${savedRequest.id}?tab=recruitment&action=find`);
    } catch (error) {
      console.error("Wizard submit failed", error);
      toast.error("Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const autosaveIcon = autosaveState === "error" ? CloudOff : autosaveState === "saving" ? Save : Cloud;
  const AutosaveIcon = autosaveIcon;

  return (
    <div className="flex min-h-screen flex-col items-center bg-background px-4 pb-10 pt-10">
      <div className="mb-6 flex w-full max-w-4xl items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 shadow-sm backdrop-blur">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-600">Guided Intake</p>
          <h1 className="text-xl font-semibold text-slate-900">Project Request Wizard</h1>
          <p className="text-sm text-slate-500">Drafts save step progress, answers, and attachments while you refine scope.</p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
          <AutosaveIcon className="h-3.5 w-3.5" />
          {autosaveCopy[autosaveState]}
        </div>
      </div>

      {kycStatus && kycStatus !== "APPROVED" && (
        <div
          className={`mb-6 w-full max-w-4xl rounded-xl border p-4 ${
            kycStatus === "PENDING"
              ? "border-amber-200 bg-amber-50"
              : "border-blue-200 bg-blue-50"
          }`}
        >
          <div className="flex items-start gap-3">
            <AlertCircle
              className={`mt-0.5 h-5 w-5 ${kycStatus === "PENDING" ? "text-amber-600" : "text-blue-600"}`}
            />
            <div className="space-y-1">
              <h3 className={`font-semibold ${kycStatus === "PENDING" ? "text-amber-900" : "text-blue-900"}`}>
                {kycStatus === "PENDING" ? "KYC review is still pending" : "KYC is required to post this request"}
              </h3>
              <p className={`text-sm ${kycStatus === "PENDING" ? "text-amber-800" : "text-blue-800"}`}>
                Draft save and autosave stay available. Marketplace posting and broker invites remain locked until KYC is approved.
              </p>
              {kycStatus !== "PENDING" && (
                <button
                  onClick={() => navigate("/kyc")}
                  className="text-sm font-medium text-blue-700 underline underline-offset-2"
                >
                  Open KYC verification
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mb-8 w-full max-w-4xl space-y-2">
        <div className="flex justify-between text-sm font-medium text-muted-foreground">
          <span>Step {currentStep} of {TOTAL_STEPS}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <Card className="w-full max-w-4xl border-none bg-card/70 shadow-xl backdrop-blur-sm">
        <CardHeader />
        <CardContent className="min-h-[400px] p-6 md:p-10">
          {currentStep === 1 && getQuestion("PRODUCT_TYPE") && (
            <StepB1
              question={getQuestion("PRODUCT_TYPE")!}
              value={productType}
              onChange={setProductType}
            />
          )}
          {currentStep === 2 && getQuestion("INDUSTRY") && (
            <StepB2 question={getQuestion("INDUSTRY")!} value={industry} onChange={setIndustry} />
          )}
          {currentStep === 3 && (
            <StepB3
              budget={budget}
              setBudget={setBudget}
              timeline={timeline}
              setTimeline={setTimeline}
            />
          )}
          {currentStep === 4 && getQuestion("FEATURES") && (
            <StepB4
              question={getQuestion("FEATURES")!}
              selectedValues={features}
              onChange={setFeatures}
            />
          )}
          {currentStep === 5 && (
            <StepB5
              title={title}
              setTitle={setTitle}
              description={description}
              setDescription={setDescription}
              attachments={attachments}
              onAttachmentsChange={setAttachments}
            />
          )}
        </CardContent>

        <CardFooter className="flex justify-between rounded-b-xl border-t bg-muted/20 p-6">
          <Button variant="outline" onClick={handleBack} disabled={currentStep === 1} className="w-32">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>

          {currentStep < TOTAL_STEPS ? (
            <Button
              onClick={handleNext}
              className="w-32"
              disabled={(currentStep === 1 && !productType) || (currentStep === 2 && !industry)}
            >
              Next <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => void handleSubmit("draft")} disabled={submitting} variant="secondary" className="w-32">
                Save Draft
              </Button>
              <Button
                onClick={() => void handleSubmit("marketplace")}
                disabled={submitting || !title || !description || !canPublish}
                className="w-40 bg-teal-600 hover:bg-teal-700"
              >
                Post to Market
              </Button>
              <Button
                onClick={() => void handleSubmit("invite")}
                disabled={submitting || !title || !description || !canPublish}
                className="w-48 bg-slate-900 hover:bg-slate-800"
              >
                <Check className="mr-2 h-4 w-4" />
                Find & Invite
              </Button>
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
