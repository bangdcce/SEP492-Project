
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

  const [requestId, setRequestId] = useState<string | null>(null);
  const [matchingBrokers, setMatchingBrokers] = useState<any[]>([]);
  const [showMatches, setShowMatches] = useState(false);

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

  const handleSubmit = async (isDraft = false) => {
     try {
        setSubmitting(true);
        
        // Map questions to answers
        const payload: CreateProjectRequestDto = {
            title: title || (isDraft ? "Draft Project Request" : "New Project Request"),
            description: description + (fileUrl ? `\n\nAttachments: ${fileUrl}` : ""),
            budgetRange: budget,
            intendedTimeline: timeline,
            isDraft: isDraft,
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
        
        if (isDraft) {
            toast.success("Saved as Draft!", {
                description: "You can continue editing later.",
            });
        } else {
             toast.success("Submitted Successfully!", {
                description: "Finding best matching brokers for you...",
             });
             
             // Fetch matches
             const matches = await wizardService.getMatches(savedRequest.id);
             setMatchingBrokers(matches);
             setShowMatches(true);
             return; // Stop here, show matches UI instead of navigating
        }
        
        // If draft, maybe just stay here or go to dashboard? Let's stay to allow more edits
        // navigate(ROUTES.CLIENT_DASHBOARD); 

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

  if (showMatches) {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center pt-10 pb-10 px-4">
            <Card className="w-full max-w-4xl border-none shadow-xl bg-card/50 backdrop-blur-sm">
                <CardHeader>
                    <div className="text-center">
                        <h2 className="text-2xl font-bold text-primary">Best Matching Brokers</h2>
                        <p className="text-muted-foreground mt-2">Based on your project requirements, here are the top experts for you.</p>
                    </div>
                </CardHeader>
                <CardContent className="p-6 md:p-10 space-y-4">
                    {matchingBrokers.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground">
                            No direct matches found, but our brokers will review your request manually.
                        </div>
                    ) : (
                        matchingBrokers.map((match: any) => (
                            <div key={match.broker.id} className="flex items-center justify-between p-4 border rounded-lg bg-background hover:bg-muted/50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                                        {match.broker.fullName ? match.broker.fullName.charAt(0).toUpperCase() : 'B'}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-lg">{match.broker.fullName}</h3>
                                        <p className="text-sm text-muted-foreground">Match Score: {match.score}</p>
                                        <div className="flex gap-1 mt-1">
                                            {match.broker.profile?.skills?.slice(0, 3).map((skill: string) => (
                                                <span key={skill} className="text-xs bg-secondary px-2 py-0.5 rounded-full">{skill}</span>
                                            ))}
                                            {(match.broker.profile?.skills?.length || 0) > 3 && (
                                                <span className="text-xs text-muted-foreground px-2 py-0.5">+{match.broker.profile.skills.length - 3} more</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <Button size="sm" onClick={() => toast.success(`Invite sent to ${match.broker.fullName}`)}>
                                    Invite
                                </Button>
                            </div>
                        ))
                    )}
                </CardContent>
                <CardFooter className="flex justify-center p-6 bg-muted/20 border-t rounded-b-xl">
                    <Button onClick={() => navigate(ROUTES.CLIENT_DASHBOARD)} className="w-48">
                        Go to Dashboard
                    </Button>
                </CardFooter>
            </Card>
        </div>
      );
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
                        onClick={() => handleSubmit(true)} 
                        disabled={submitting} 
                        variant="secondary"
                        className="w-32"
                    >
                        Save Draft
                    </Button>
                    <Button 
                        onClick={() => handleSubmit(false)} 
                        disabled={submitting || !title || !description} 
                        className="w-40 bg-green-600 hover:bg-green-700"
                    >
                        {submitting ? <Spinner size="sm" className="mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                        Submit
                    </Button>
                </div>
            )}
        </CardFooter>
      </Card>
    </div>
  );
}
