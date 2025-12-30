
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";

interface StepB3Props {
  budget: string;
  setBudget: (val: string) => void;
  timeline: string;
  setTimeline: (val: string) => void;
}

export function StepB3({ budget, setBudget, timeline, setTimeline }: StepB3Props) {
  return (
    <div className="space-y-6 max-w-md mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-primary">Ngân sách & Thời gian</h2>
        <p className="text-muted-foreground mt-2">Giúp chúng tôi tìm giải pháp phù hợp nhất với bạn</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="budget">Ngân sách dự kiến (VNĐ)</Label>
          <Select value={budget} onValueChange={setBudget}>
            <SelectTrigger id="budget">
              <SelectValue placeholder="Chọn mức ngân sách" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="UNDER_10M">Dưới 10 triệu</SelectItem>
              <SelectItem value="10M_30M">10 - 30 triệu</SelectItem>
              <SelectItem value="30M_50M">30 - 50 triệu</SelectItem>
              <SelectItem value="50M_100M">50 - 100 triệu</SelectItem>
              <SelectItem value="ABOVE_100M">Trên 100 triệu</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
           <Label htmlFor="timeline">Thời gian mong muốn</Label>
           <Input 
             id="timeline" 
             placeholder="Ví dụ: 2 tháng, 20/12/2025..." 
             value={timeline}
             onChange={(e) => setTimeline(e.target.value)}
           />
        </div>
      </div>
    </div>
  );
}
