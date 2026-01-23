import { AlertCircle, Clock } from "lucide-react";

// This mirrors the backend 'ComplexityLevel' roughly
type ComplexityLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

interface DisputeComplexityBadgeProps {
  level: ComplexityLevel;
  estMinutes: number; // From backend
  confidence: number; // From backend
}

export const DisputeComplexityBadge = ({
  level,
  estMinutes,
}: DisputeComplexityBadgeProps) => {
  const styles = {
    LOW: "bg-green-100 text-green-800 border-green-200",
    MEDIUM: "bg-blue-100 text-blue-800 border-blue-200",
    HIGH: "bg-orange-100 text-orange-800 border-orange-200",
    CRITICAL: "bg-red-100 text-red-800 border-red-200",
  };

  return (
    <div
      className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full border text-xs font-medium ${styles[level]}`}
    >
      <div className="flex items-center gap-1">
        {level === "CRITICAL" && <AlertCircle className="w-3 h-3" />}
        <span>{level}</span>
      </div>
      <div className="w-px h-3 bg-current opacity-20 mx-0.5" />
      <div className="flex items-center gap-1 opacity-90">
        <Clock className="w-3 h-3" />
        <span>~{estMinutes}m</span>
      </div>
    </div>
  );
};
