import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { ArrowLeft, ArrowRight, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/shared/api/client";
import {
  getTodayDateInputValue,
  isPastDateInputValue,
} from "./utils/timelineDate";
import { normalizeProductTypeCode } from "@/shared/utils/productType";

const TOTAL_STEPS = 5;

type SubmitMode = "marketplace" | "invite";

type KycProfileResponse = {
  status?: string | null;
};

export default function WizardPage() {
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(1);
  const [questions, setQuestions] = useState<WizardQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [kycStatus, setKycStatus] = useState<string | null>(null);

  const [productType, setProductType] = useState("");
  const [industry, setIndustry] = useState("");
  const [budget, setBudget] = useState("");
  const [timeline, setTimeline] = useState("");
  const [features, setFeatures] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [attachments, setAttachments] = useState<ProjectRequestAttachment[]>([]);

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
    const featureQuestion = questions.find((question) => question.code === "FEATURES");
    const normalizedProductType = normalizeProductTypeCode(productType);

    if (!featureQuestion || !normalizedProductType || features.length === 0) {
      return;
    }

    const allowedValues = new Set(
      featureQuestion.options
        .filter((option) => {
          const recommendedProductTypes = option.recommendedProductTypes || [];
          return (
            option.group === "COMMON" ||
            recommendedProductTypes.length === 0 ||
            recommendedProductTypes.includes(normalizedProductType)
          );
        })
        .map((option) => option.value),
    );

    setFeatures((previous) => {
      const next = previous.filter((value) => allowedValues.has(value));
      return next.length === previous.length ? previous : next;
    });
  }, [features.length, productType, questions]);

  const progress = (currentStep / TOTAL_STEPS) * 100;
  const canPublish = kycStatus === "APPROVED";
  const minimumTimelineDate = getTodayDateInputValue();
  const timelineError = timeline && isPastDateInputValue(timeline, minimumTimelineDate)
    ? "Expected completion date cannot be earlier than today."
    : null;

  const getQuestion = (code: string) => questions.find((question) => question.code === code);
  const featureQuestion = getQuestion("FEATURES");

  const buildPayload = (mode: SubmitMode): CreateProjectRequestDto => {
    const answers: CreateProjectRequestDto["answers"] = [];
    const productTypeQuestion = getQuestion("PRODUCT_TYPE");
    const industryQuestion = getQuestion("INDUSTRY");
    const featuresQuestion = getQuestion("FEATURES");

    if (productTypeQuestion && productType) {
      answers.push({ questionId: String(productTypeQuestion.id), valueText: productType });
    }
    if (industryQuestion && industry) {
      answers.push({ questionId: String(industryQuestion.id), valueText: industry });
    }
    if (featuresQuestion && features.length > 0) {
      features.forEach((feature) => {
        answers.push({ questionId: String(featuresQuestion.id), valueText: feature });
      });
    }

    return {
      title: title.trim() || "New Project Request",
      description: description.trim() || "Project description",
      budgetRange: budget || undefined,
      requestedDeadline: timeline || undefined,
      intendedTimeline: timeline || undefined,
      status:
        mode === "marketplace"
          ? "PUBLIC_DRAFT"
          : "PRIVATE_DRAFT",
      wizardProgressStep: currentStep,
      attachments,
      answers,
    };
  };

  const handleNext = () => {
    if (currentStep === 3 && timelineError) {
      toast.error(timelineError);
      return;
    }

    if (currentStep === 4 && featureQuestion && features.length === 0) {
      toast.error("Please select at least one feature before moving to the final step.");
      return;
    }

    if (currentStep < TOTAL_STEPS) setCurrentStep((previous) => previous + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep((previous) => previous - 1);
  };

  const handleSubmit = async (mode: SubmitMode) => {
    try {
      setSubmitting(true);

      if (!canPublish) {
        toast.error("KYC approval is required before posting or inviting.");
        return;
      }

      if (timelineError) {
        toast.error(timelineError);
        return;
      }

      const payload = buildPayload(mode);

      if (mode === "marketplace") {
        await wizardService.submitRequest(payload);
        toast.success("Request posted to the broker marketplace.");
        navigate(ROUTES.CLIENT_DASHBOARD);
        return;
      }

      // "invite" mode — create as PRIVATE_DRAFT
      const savedRequest = await wizardService.submitRequest(payload);
      toast.success("Request created. Find & invite brokers now.");
      navigate(`/client/requests/${savedRequest.id}?tab=phase1`);
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

  return (
    <div className="flex min-h-screen flex-col items-center bg-background px-4 pb-10 pt-10">
      <div className="mb-6 flex w-full max-w-4xl items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 shadow-sm backdrop-blur">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-600">Guided Intake</p>
          <h1 className="text-xl font-semibold text-slate-900">Project Request Wizard</h1>
          <p className="text-sm text-slate-500">Complete all steps to submit your project request.</p>
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
                You can fill out the wizard, but marketplace posting and broker invites remain locked until KYC is approved.
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
        <CardContent className="min-h-100 p-6 md:p-10">
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
              timelineError={timelineError}
            />
          )}
          {currentStep === 4 && featureQuestion && (
            <StepB4
              question={featureQuestion}
              productType={productType}
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
              disabled={
                (currentStep === 1 && !productType) ||
                (currentStep === 2 && !industry) ||
                (currentStep === 3 && Boolean(timelineError)) ||
                (currentStep === 4 && Boolean(featureQuestion) && features.length === 0)
              }
            >
              Next <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => void handleSubmit("marketplace")}
                disabled={submitting || !title || !description || !canPublish || Boolean(timelineError)}
                className="w-40 bg-teal-600 hover:bg-teal-700"
              >
                Post to Market
              </Button>
              <Button
                onClick={() => void handleSubmit("invite")}
                disabled={submitting || !title || !description || !canPublish || Boolean(timelineError)}
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
