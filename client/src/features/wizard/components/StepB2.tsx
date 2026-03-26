
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

      <div className="max-h-80 overflow-y-auto pr-1">
        <RadioGroup
          value={value}
          onValueChange={onChange}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          {question.options.map((option) => (
            <div key={option.id}>
              <RadioGroupItem value={option.value} id={String(option.id)} className="peer sr-only" />
              <Label
                htmlFor={String(option.id)}
                className="flex h-32 cursor-pointer flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-6 text-center transition-all hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary"
              >
                <span className="font-medium">{option.label}</span>
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>
    </div>
  );
}
