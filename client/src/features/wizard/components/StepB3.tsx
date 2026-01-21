import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

interface StepB3Props {
  budget: string;
  setBudget: (val: string) => void;
  timeline: string;
  setTimeline: (val: string) => void;
}

export function StepB3({
  budget,
  setBudget,
  timeline,
  setTimeline,
}: StepB3Props) {
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
          <Label htmlFor="budget">Estimated Budget (VND)</Label>
          <Select value={budget} onValueChange={setBudget}>
            <SelectTrigger id="budget" className="w-full">
              <SelectValue placeholder="Select Budget Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="UNDER_10M">Under 10 Million</SelectItem>
              <SelectItem value="10M_30M">10 - 30 Million</SelectItem>
              <SelectItem value="30M_50M">30 - 50 Million</SelectItem>
              <SelectItem value="50M_100M">50 - 100 Million</SelectItem>
              <SelectItem value="ABOVE_100M">Above 100 Million</SelectItem>
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
            className="w-full block"
          />
        </div>
      </div>
    </div>
  );
}
