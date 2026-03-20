import { useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { CalendarDays, ChevronDown, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/shared/components/ui/button";
import { Calendar } from "@/shared/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";

type WorkspaceDatePickerProps = {
  value?: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
  tone?: "default" | "danger";
  align?: "start" | "center" | "end";
};

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parsePickerDate(value?: string | null): Date | undefined {
  if (!value) {
    return undefined;
  }

  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return undefined;
  }

  if (DATE_ONLY_PATTERN.test(normalizedValue)) {
    const [year, month, day] = normalizedValue.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  const parsedDate = new Date(normalizedValue);
  return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate;
}

function toPickerValue(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

const QUICK_DATE_PRESETS = [
  {
    key: "today",
    label: "Today",
    resolveDate: () => new Date(),
  },
  {
    key: "tomorrow",
    label: "Tomorrow",
    resolveDate: () => addDays(new Date(), 1),
  },
  {
    key: "next-week",
    label: "Next Week",
    resolveDate: () => addDays(new Date(), 7),
  },
] as const;

export function WorkspaceDatePicker({
  value,
  onChange,
  placeholder = "Set date",
  disabled = false,
  className,
  contentClassName,
  tone = "default",
  align = "start",
}: WorkspaceDatePickerProps) {
  const [open, setOpen] = useState(false);
  const selectedDate = useMemo(() => parsePickerDate(value), [value]);
  const hasValue = Boolean(selectedDate);

  const handleSelect = (nextDate?: Date) => {
    onChange(nextDate ? toPickerValue(nextDate) : null);
    setOpen(false);
  };

  const handlePresetClick = (resolveDate: () => Date) => {
    const nextDate = resolveDate();
    onChange(toPickerValue(nextDate));
    setOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "group inline-flex w-full items-center justify-between gap-2.5 rounded-xl border px-3 py-2 text-left text-sm shadow-sm transition-all",
            tone === "danger"
              ? "border-red-300 bg-red-50/80 text-red-700 hover:border-red-400 hover:bg-red-100/70"
              : "border-slate-200 bg-white text-slate-700 hover:border-teal-300 hover:bg-teal-50/60",
            disabled && "cursor-not-allowed opacity-60",
            className,
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border",
                tone === "danger"
                  ? "border-red-200 bg-red-100/80 text-red-600"
                  : "border-teal-100 bg-teal-50 text-teal-700",
              )}
            >
              <CalendarDays className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-medium">
                {selectedDate ? format(selectedDate, "PPP") : placeholder}
              </span>
              <span className="block text-[11px] text-slate-500">
                {selectedDate ? "Click to adjust or clear" : "Use calendar or quick presets"}
              </span>
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-data-[state=open]:rotate-180" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align={align}
        className={cn(
          "w-[284px] border-slate-200 p-0 shadow-xl",
          contentClassName,
        )}
      >
        <div className="flex flex-wrap gap-1.5 border-b border-slate-200 px-2.5 py-2">
          {QUICK_DATE_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => handlePresetClick(preset.resolveDate)}
              className="inline-flex h-8 items-center justify-center rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700"
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="px-1.5 pb-1.5 pt-2">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
            initialFocus
            className="w-full rounded-xl border border-slate-200 bg-white"
          />
        </div>

        <div className="flex justify-end border-t border-slate-200 bg-slate-50/80 px-2.5 py-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={!hasValue}
            className="text-slate-500 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
            Clear
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default WorkspaceDatePicker;
