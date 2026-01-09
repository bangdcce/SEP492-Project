
import type { WizardQuestion } from "../services/wizardService";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Label } from "@/shared/components/ui/label";

interface StepB4Props {
  question: WizardQuestion;
  selectedValues: string[];
  onChange: (values: string[]) => void;
}

export function StepB4({ question, selectedValues, onChange }: StepB4Props) {
  const handleToggle = (optionValue: string) => {
    if (selectedValues.includes(optionValue)) {
      onChange(selectedValues.filter((v) => v !== optionValue));
    } else {
      onChange([...selectedValues, optionValue]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-primary">{question.label}</h2>
        {question.helpText && <p className="text-muted-foreground mt-2">{question.helpText}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {question.options.map((option) => (
          <div 
            key={option.id} 
            className={`flex items-start space-x-3 p-4 border rounded-md transition-colors ${selectedValues.includes(option.value) ? 'border-primary bg-primary/5' : 'border-muted'}`}
            onClick={() => handleToggle(option.value)}
          >
            <Checkbox 
                id={option.id} 
                checked={selectedValues.includes(option.value)}
                onCheckedChange={() => handleToggle(option.value)}
            />
            <div className="grid gap-1.5 leading-none cursor-pointer w-full">
              <Label htmlFor={option.id} className="cursor-pointer font-medium text-base">
                {option.label}
              </Label>
              {/* If we had description for features, put it here */}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
