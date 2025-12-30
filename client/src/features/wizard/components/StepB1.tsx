
import type { WizardQuestion } from "../services/wizardService";
import { Label } from "@/shared/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";

interface StepB1Props {
  question: WizardQuestion;
  value: string;
  onChange: (value: string) => void;
}

export function StepB1({ question, value, onChange }: StepB1Props) {
  return (
    <div className="space-y-4">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-primary">{question.label}</h2>
        {question.helpText && <p className="text-muted-foreground mt-2">{question.helpText}</p>}
      </div>

      <RadioGroup value={value} onValueChange={onChange} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {question.options.map((option) => (
          <div key={option.id}>
            <RadioGroupItem value={option.value} id={option.id} className="peer sr-only" />
            <Label
              htmlFor={option.id}
              className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-all h-full"
            >
              <div className="mb-2 text-3xl">
                {/* Icons placeholder based on value if needed */}
                {option.value === 'LANDING_PAGE' && '📄'}
                {option.value === 'CORP_WEBSITE' && '🏢'}
                {option.value === 'ECOMMERCE' && '🛒'}
                {option.value === 'MOBILE_APP' && '📱'}
                {option.value === 'WEB_APP' && '💻'}
                {option.value === 'SYSTEM' && '⚙️'}
              </div>
              <span className="font-semibold text-lg">{option.label}</span>
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}
