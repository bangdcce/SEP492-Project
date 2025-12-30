
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, CardContent, CardFooter, CardHeader, Progress, Spinner } from "@/shared/components/ui";
import { StepB1 } from "./components/StepB1";
import { StepB2 } from "./components/StepB2";
import { StepB3 } from "./components/StepB3";
import { StepB4 } from "./components/StepB4";
import { StepB5 } from "./components/StepB5";
import { wizardService } from "./services/wizardService";
import type { WizardQuestion, CreateProjectRequestDto } from "./services/wizardService";
import { ROUTES } from "@/constants";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";

export default function WizardPage() {
  const navigate = useNavigate();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [questions, setQuestions] = useState<WizardQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [productType, setProductType] = useState<string>("");
  const [industry, setIndustry] = useState<string>("");
  const [budget, setBudget] = useState<string>("");
  const [timeline, setTimeline] = useState<string>("");
  const [features, setFeatures] = useState<string[]>([]);
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [fileUrl, setFileUrl] = useState<string>("");

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const data = await wizardService.getQuestions();
        setQuestions(data);
      } catch (error) {
        toast.error("Lỗi tải dữ liệu", {
            description: "Không thể tải danh sách câu hỏi. Vui lòng thử lại sau.",
        });
      } finally {
        setLoading(false);
      }
    };
    fetchQuestions();
  }, []);

  const totalSteps = 5;
  const progress = (currentStep / totalSteps) * 100;

  const handleNext = () => {
    if (currentStep < totalSteps) setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
     try {
        setSubmitting(true);
        
        // Map questions to answers
        const payload: CreateProjectRequestDto = {
            title: title || "New Project Request",
            description: description + (fileUrl ? `\n\nAttachments: ${fileUrl}` : ""),
            budgetRange: budget,
            intendedTimeline: timeline,
            answers: []
        };

        // Find IDs for questions
        const typeQ = questions.find(q => q.code === 'PRODUCT_TYPE');
        const industryQ = questions.find(q => q.code === 'INDUSTRY');
        const featureQ = questions.find(q => q.code === 'FEATURES');

        // B1
        if (typeQ && productType) {
            payload.answers.push({
                questionId: typeQ.id,
                valueText: productType // Or find optionId if strict
            });
        }
        // B2
        if (industryQ && industry) {
            payload.answers.push({
                questionId: industryQ.id,
                valueText: industry
            });
        }
        // B4 - Multi select
        if (featureQ && features.length > 0) {
            features.forEach(feat => {
                payload.answers.push({
                    questionId: featureQ.id,
                    valueText: feat
                });
            });
        }

        await wizardService.submitRequest(payload);
        
        toast.success("Thành công!", {
            description: "Yêu cầu dự án của bạn đã được gửi. Broker sẽ liên hệ sớm.",
        });
        
        navigate(ROUTES.DASHBOARD);

     } catch (error) {
        toast.error("Gửi thất bại", {
            description: "Có lỗi xảy ra khi gửi yêu cầu. Vui lòng thử lại.",
        });
     } finally {
        setSubmitting(false);
     }
  };

  // Helper to get question object
  const getQuestion = (code: string) => questions.find(q => q.code === code);

  if (loading) {
      return <div className="min-h-screen flex items-center justify-center"><Spinner size="lg" /></div>;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center pt-10 pb-10 px-4">
      
      <div className="w-full max-w-4xl mb-8 space-y-2">
        <div className="flex justify-between text-sm font-medium text-muted-foreground">
            <span>Bước {currentStep} của {totalSteps}</span>
            <span>{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <Card className="w-full max-w-4xl border-none shadow-xl bg-card/50 backdrop-blur-sm">
        <CardHeader></CardHeader>
        <CardContent className="min-h-[400px] p-6 md:p-10">
            {currentStep === 1 && getQuestion('PRODUCT_TYPE') && (
                <StepB1 
                    question={getQuestion('PRODUCT_TYPE')!} 
                    value={productType}
                    onChange={setProductType}
                />
            )}
            {currentStep === 2 && getQuestion('INDUSTRY') && (
                <StepB2 
                    question={getQuestion('INDUSTRY')!}
                    value={industry}
                    onChange={setIndustry}
                />
            )}
            {currentStep === 3 && (
                <StepB3 
                    budget={budget}
                    setBudget={setBudget}
                    timeline={timeline}
                    setTimeline={setTimeline}
                />
            )}
            {currentStep === 4 && getQuestion('FEATURES') && (
                <StepB4 
                    question={getQuestion('FEATURES')!}
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
                    onFileUploaded={setFileUrl}
                />
            )}
        </CardContent>
        <CardFooter className="flex justify-between p-6 bg-muted/20 border-t rounded-b-xl">
            <Button 
                variant="outline" 
                onClick={handleBack} 
                disabled={currentStep === 1}
                className="w-32"
            >
                <ArrowLeft className="w-4 h-4 mr-2" /> Quay lại
            </Button>
            
            {currentStep < totalSteps ? (
                <Button onClick={handleNext} className="w-32" disabled={
                    // Basic validation
                    (currentStep === 1 && !productType) ||
                    (currentStep === 2 && !industry)
                }>
                    Tiếp tục <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
            ) : (
                <Button onClick={handleSubmit} disabled={submitting || !title || !description} className="w-40 bg-green-600 hover:bg-green-700">
                    {submitting ? <Spinner size="sm" className="mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                    Hoàn tất
                </Button>
            )}
        </CardFooter>
      </Card>
    </div>
  );
}
