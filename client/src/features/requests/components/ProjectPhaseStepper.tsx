
import { Check } from "lucide-react";

interface Step {
  id: number;
  label: string;
  status: 'completed' | 'current' | 'upcoming';
}

interface ProjectPhaseStepperProps {
  currentPhase: number; // 1-based index
}

export function ProjectPhaseStepper({ currentPhase }: ProjectPhaseStepperProps) {
  const steps: Step[] = [
    { id: 1, label: 'Pending Broker', status: currentPhase > 1 ? 'completed' : currentPhase === 1 ? 'current' : 'upcoming' },
    { id: 2, label: 'Spec Review', status: currentPhase > 2 ? 'completed' : currentPhase === 2 ? 'current' : 'upcoming' },
    { id: 3, label: 'Hiring', status: currentPhase > 3 ? 'completed' : currentPhase === 3 ? 'current' : 'upcoming' },
    { id: 4, label: 'In Progress', status: currentPhase > 4 ? 'completed' : currentPhase === 4 ? 'current' : 'upcoming' },
  ];

  return (
    <div className="w-full py-4">
      <div className="flex items-center justify-between relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-muted -z-10" />
        
        {steps.map((step, index) => (
          <div key={step.id} className="flex flex-col items-center gap-2 bg-background px-2">
            <div 
              className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors
                ${step.status === 'completed' ? 'bg-primary border-primary text-primary-foreground' : 
                  step.status === 'current' ? 'border-primary text-primary' : 'border-muted text-muted-foreground bg-background'}
              `}
            >
              {step.status === 'completed' ? <Check className="w-4 h-4" /> : step.id}
            </div>
            <span className={`text-xs font-medium ${step.status === 'current' ? 'text-primary' : 'text-muted-foreground'}`}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
