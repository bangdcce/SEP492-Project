
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
import { ROUTES, API_CONFIG } from "@/constants";
import { ArrowLeft, ArrowRight, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { getStoredItem } from "@/shared/utils/storage";

export default function WizardPage() {
  const navigate = useNavigate();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [questions, setQuestions] = useState<WizardQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [kycStatus, setKycStatus] = useState<string | null>(null);

  const [requestId, setRequestId] = useState<string | null>(null);
  
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

    const checkKycStatus = async () => {
      try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/kyc/me`, {
          headers: {
            'Authorization': `Bearer ${getStoredItem('access_token')}`,
          },
        });
        const data = await response.json();
        setKycStatus(data.status || 'NOT_STARTED');
      } catch (error) {
        console.error('Error checking KYC:', error);
      }
    };

    fetchQuestions();
    checkKycStatus();
  }, []);

  const totalSteps = 5;
  const progress = (currentStep / totalSteps) * 100;

  const handleNext = () => {
    if (currentStep < totalSteps) setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async (mode: 'draft' | 'marketplace' | 'invite') => {
     try {
        const isDraftMode = mode === 'draft';
        setSubmitting(true);

        // Check KYC before submitting project (if not draft)
        if (!isDraftMode && kycStatus !== 'APPROVED') {
          if (kycStatus === 'NOT_STARTED' || kycStatus === 'REJECTED') {
            toast.error('KYC verification required', {
              description: 'Please complete KYC verification before posting a project.',
            });
            setTimeout(() => {
              navigate('/kyc');
            }, 2000);
            return;
          }
          
          if (kycStatus === 'PENDING') {
            toast.warning('KYC verification pending', {
              description: 'Your KYC is being reviewed. You can save as draft or wait for approval.',
            });
            return;
          }
        }
        
        // Map questions to answers
        const payload: CreateProjectRequestDto = {
            title: title || (isDraftMode ? "Draft Project Request" : "New Project Request"),
            description: description + (fileUrl ? `\n\nAttachments: ${fileUrl}` : ""),
            budgetRange: budget,
            intendedTimeline: timeline,
            isDraft: isDraftMode,
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
                valueText: productType
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

        let savedRequest;
        if (requestId) {
            // Update existing
            savedRequest = await wizardService.updateRequest(requestId, payload);
        } else {
            // Create new
            savedRequest = await wizardService.submitRequest(payload);
            setRequestId(savedRequest.id);
        }
        
        if (mode === 'draft') {
            toast.success("Saved as Draft!", {
                description: "You can continue editing later.",
            });
            // Stay on page or navigate to drafts?
            // navigate(ROUTES.CLIENT_DASHBOARD);
        } else if (mode === 'marketplace') {
             toast.success("Posted to Marketplace!", {
                description: "Your request is now visible to brokers.",
             });
             navigate(ROUTES.CLIENT_DASHBOARD);
        } else if (mode === 'invite') {
             toast.success("Project Created!", {
                description: "Redirecting to find brokers...",
             });
             // Redirect to detail page with recruitment tab active and 'find' action
             navigate(`/client/requests/${savedRequest.id}?tab=recruitment&action=find`);
        } 

     } catch (error) {
        toast.error("Submission Failed", {
            description: "An error occurred. Please try again.",
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
            <span>Step {currentStep} of {totalSteps}</span>
            <span>{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* KYC Warning Banner */}
      {kycStatus && kycStatus !== 'APPROVED' && (
        <div className={`w-full max-w-4xl rounded-lg border p-4 mb-6 ${
          kycStatus === 'PENDING' 
            ? 'bg-yellow-50 border-yellow-200' 
            : 'bg-blue-50 border-blue-200'
        }`}>
          <div className="flex items-start gap-3">
            <AlertCircle className={`w-5 h-5 mt-0.5 ${
              kycStatus === 'PENDING' ? 'text-yellow-600' : 'text-blue-600'
            }`} />
            <div className="flex-1">
              <h3 className={`font-semibold ${
                kycStatus === 'PENDING' ? 'text-yellow-800' : 'text-blue-800'
              }`}>
                {kycStatus === 'PENDING' 
                  ? 'KYC Verification Pending' 
                  : 'KYC Verification Required'}
              </h3>
              <p className={`text-sm mt-1 ${
                kycStatus === 'PENDING' ? 'text-yellow-700' : 'text-blue-700'
              }`}>
                {kycStatus === 'PENDING' 
                  ? 'Your KYC is being reviewed. You can save as draft or wait for approval to submit.' 
                  : 'Please complete KYC verification to post projects.'}
              </p>
              {kycStatus !== 'PENDING' && (
                <button
                  onClick={() => navigate('/kyc')}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 mt-2 underline"
                >
                  Complete KYC Now →
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>
            
            {currentStep < totalSteps ? (
                <Button onClick={() => handleNext()} className="w-32" disabled={
                    // Basic validation
                    (currentStep === 1 && !productType) ||
                    (currentStep === 2 && !industry)
                }>
                    Next <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
            ) : (
                <div className="flex gap-4">
                    <Button 
                        onClick={() => handleSubmit('draft')} 
                        disabled={submitting} 
                        variant="secondary"
                        className="w-32"
                    >
                        Save Draft
                    </Button>
                    <Button 
                        onClick={() => handleSubmit('marketplace')} 
                        disabled={submitting || !title || !description} 
                        className="w-40 bg-blue-600 hover:bg-blue-700"
                    >
                        Post to Market
                    </Button>
                    <Button 
                        onClick={() => handleSubmit('invite')} 
                        disabled={submitting || !title || !description} 
                        className="w-48 bg-green-600 hover:bg-green-700"
                    >
                        <Check className="w-4 h-4 mr-2" />
                        Find & Invite
                    </Button>
                </div>
            )}
        </CardFooter>
      </Card>
    </div>
  );
}
