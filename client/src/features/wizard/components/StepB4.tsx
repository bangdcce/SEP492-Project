
import type { WizardQuestion } from "../services/wizardService";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Label } from "@/shared/components/ui/label";
import { getProductTypeLabel, normalizeProductTypeCode } from "@/shared/utils/productType";

interface StepB4Props {
  question: WizardQuestion;
  productType?: string;
  selectedValues: string[];
  onChange: (values: string[]) => void;
}

export function StepB4({ question, productType, selectedValues, onChange }: StepB4Props) {
  const handleToggle = (optionValue: string) => {
    if (selectedValues.includes(optionValue)) {
      onChange(selectedValues.filter((v) => v !== optionValue));
    } else {
      onChange([...selectedValues, optionValue]);
    }
  };

  const normalizedProductType = normalizeProductTypeCode(productType);
  const groupedOptions = question.options.reduce<{
    recommended: typeof question.options;
    common: typeof question.options;
    optional: typeof question.options;
  }>(
    (accumulator, option) => {
      const recommendedProductTypes = option.recommendedProductTypes || [];

      if (
        normalizedProductType &&
        recommendedProductTypes.includes(normalizedProductType)
      ) {
        accumulator.recommended.push(option);
        return accumulator;
      }

      if (option.group === "COMMON" || recommendedProductTypes.length === 0) {
        accumulator.common.push(option);
        return accumulator;
      }

      accumulator.optional.push(option);
      return accumulator;
    },
    { recommended: [], common: [], optional: [] },
  );

  const sections = [
    {
      key: "recommended",
      title: normalizedProductType
        ? `Recommended for ${getProductTypeLabel(normalizedProductType)}`
        : "Recommended",
      options: groupedOptions.recommended,
    },
    {
      key: "common",
      title: "Common foundations",
      options: groupedOptions.common,
    },
    {
      key: "optional",
      title: "Optional add-ons",
      options: groupedOptions.optional,
    },
  ].filter((section) => section.options.length > 0);

  return (
    <div className="space-y-4">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-primary">{question.label}</h2>
        {question.helpText && <p className="text-muted-foreground mt-2">{question.helpText}</p>}
      </div>

      <div className="space-y-6">
        {sections.map((section) => (
          <div key={section.key} className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                {section.title}
              </h3>
              {section.key === "recommended" && normalizedProductType ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  These suggestions match the selected product type and will keep the later spec flow more consistent.
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {section.options.map((option) => (
                <div
                  key={option.id}
                  className={`flex items-start space-x-3 rounded-md border p-4 transition-colors ${
                    selectedValues.includes(option.value)
                      ? "border-primary bg-primary/5"
                      : "border-muted"
                  }`}
                  onClick={() => handleToggle(option.value)}
                >
                  <Checkbox
                    id={String(option.id)}
                    checked={selectedValues.includes(option.value)}
                    onCheckedChange={() => handleToggle(option.value)}
                  />
                  <div className="grid w-full cursor-pointer gap-1.5 leading-none">
                    <Label htmlFor={String(option.id)} className="cursor-pointer font-medium text-base">
                      {option.label}
                    </Label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
