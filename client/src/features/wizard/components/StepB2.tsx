
import type { WizardQuestion } from "../services/wizardService";
import { Label } from "@/shared/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";

interface StepB2Props {
  question: WizardQuestion;
  value: string;
  onChange: (value: string) => void;
}

export function StepB2({ question, value, onChange }: StepB2Props) {
  return (
    <div className="space-y-4">
       <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-primary">{question.label}</h2>
        {question.helpText && <p className="text-muted-foreground mt-2">{question.helpText}</p>}
      </div>

      <RadioGroup value={value} onValueChange={onChange} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {question.options.map((option) => (
          <div key={option.id}>
             <RadioGroupItem value={option.value} id={option.id} className="peer sr-only" />
            <Label
              htmlFor={option.id}
               className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-6 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary transition-all h-32 cursor-pointer"
            >
              <div className="mb-2 text-2xl">
                 {option.value === 'FNB' && '🍔'}
                 {option.value === 'FASHION' && '👗'}
                 {option.value === 'RETAIL' && '🏪'}
                 {option.value === 'REAL_ESTATE' && '🏠'}
                 {option.value === 'EDUCATION' && '🎓'}
                 {option.value === 'HEALTHCARE' && '🏥'}
                 {option.value === 'LOGISTICS' && '🚚'}
                 {option.value === 'SERVICE' && '🔧'}
              </div>
              <span className="font-medium">{option.label}</span>
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}
