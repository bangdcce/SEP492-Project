import {
  DISPUTE_DISCLAIMER_COPY,
} from "@/features/disputes/constants/disputeLegal";

interface DisputeDisclaimerCheckboxProps {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  testId?: string;
  leadInText?: string;
  className?: string;
}

export const DisputeDisclaimerCheckbox = ({
  id,
  checked,
  onCheckedChange,
  disabled = false,
  testId,
  leadInText,
  className,
}: DisputeDisclaimerCheckboxProps) => {
  return (
    <label
      htmlFor={id}
      className={`group flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 transition-colors focus-within:border-teal-300 focus-within:bg-teal-50/40 ${
        disabled
          ? "cursor-not-allowed opacity-70"
          : "cursor-pointer hover:border-slate-300"
      } ${className ?? ""}`.trim()}
    >
      <input
        id={id}
        data-testid={testId}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onCheckedChange(event.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 accent-teal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/60"
      />
      <span className="min-w-0 wrap-anywhere text-[13px] leading-6">
        {leadInText ? (
          <>
            <span className="font-semibold text-slate-900">{leadInText} </span>
            {DISPUTE_DISCLAIMER_COPY}
          </>
        ) : (
          DISPUTE_DISCLAIMER_COPY
        )}
      </span>
    </label>
  );
};
