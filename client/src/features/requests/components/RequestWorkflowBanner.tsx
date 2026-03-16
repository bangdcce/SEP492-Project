import { Sparkles } from "lucide-react";

import { Badge, Button, Card, CardContent } from "@/shared/components/ui";
import { formatHumanStatus } from "../requestFlow";
import type { RequestActionCard } from "../requestDetailActions";

type RequestWorkflowBannerProps = {
  action: RequestActionCard;
  currentPhase: number;
  requestStatus: string;
};

export function RequestWorkflowBanner({
  action,
  currentPhase,
  requestStatus,
}: RequestWorkflowBannerProps) {
  return (
    <Card className="border-blue-200 bg-blue-50/40">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 h-5 w-5 text-blue-600" />
          <div>
            <p className="font-semibold">{action.title}</p>
            <p className="text-sm text-muted-foreground">{action.description}</p>
            <div className="mt-2">
              <Badge variant="outline">{`Workflow phase ${currentPhase}/5`}</Badge>
              <Badge className="ml-2" variant="secondary">
                {formatHumanStatus(requestStatus)}
              </Badge>
            </div>
          </div>
        </div>
        <Button onClick={action.onClick}>{action.ctaLabel}</Button>
      </CardContent>
    </Card>
  );
}
