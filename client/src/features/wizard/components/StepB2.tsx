
import type { WizardQuestion } from "../services/wizardService";
import { Label } from "@/shared/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";

import { Utensils, Shirt, Store, Home, GraduationCap, Hospital, Truck, Wrench } from "lucide-react";

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
              <div className="mb-2 text-primary">
                 {option.value === 'FNB' && <Utensils className="w-8 h-8" />}
                 {option.value === 'FASHION' && <Shirt className="w-8 h-8" />}
                 {option.value === 'RETAIL' && <Store className="w-8 h-8" />}
                 {option.value === 'REAL_ESTATE' && <Home className="w-8 h-8" />}
                 {option.value === 'EDUCATION' && <GraduationCap className="w-8 h-8" />}
                 {option.value === 'HEALTHCARE' && <Hospital className="w-8 h-8" />}
                 {option.value === 'LOGISTICS' && <Truck className="w-8 h-8" />}
                 {option.value === 'SERVICE' && <Wrench className="w-8 h-8" />}
              </div>
              <span className="font-medium">{option.label}</span>
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}
