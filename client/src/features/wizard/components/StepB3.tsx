import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { getTodayDateInputValue } from "../utils/timelineDate";

interface StepB3Props {
  budget: string;
  setBudget: (val: string) => void;
  timeline: string;
  setTimeline: (val: string) => void;
  timelineError?: string | null;
}

export function StepB3({
  budget,
  setBudget,
  timeline,
  setTimeline,
  timelineError,
}: StepB3Props) {
  const minimumTimelineDate = getTodayDateInputValue();

  return (
    <div className="space-y-6 max-w-md mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-primary">Budget & Timeline</h2>
        <p className="text-muted-foreground mt-2">
          Helping us find the best solution for you
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="budget">Estimated Budget (USD)</Label>
          <Select value={budget} onValueChange={setBudget}>
            <SelectTrigger id="budget" className="w-full">
              <SelectValue placeholder="Select Budget Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="UNDER_1K">Under $1,000</SelectItem>
              <SelectItem value="1K_5K">$1,000 - $5,000</SelectItem>
              <SelectItem value="5K_10K">$5,000 - $10,000</SelectItem>
              <SelectItem value="10K_25K">$10,000 - $25,000</SelectItem>
              <SelectItem value="ABOVE_25K">Above $25,000</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="timeline">Expected Completion Date</Label>
          <Input
            id="timeline"
            type="date"
            value={timeline}
            onChange={(e) => setTimeline(e.target.value)}
            min={minimumTimelineDate}
            aria-invalid={Boolean(timelineError)}
            className={`w-full block ${timelineError ? "border-rose-300 focus-visible:ring-rose-400" : ""}`}
          />
          <p className={`text-xs ${timelineError ? "text-rose-600" : "text-slate-500"}`}>
            {timelineError || "Choose today or a future date. Past dates are not allowed."}
          </p>
        </div>
      </div>
    </div>
  );
}
