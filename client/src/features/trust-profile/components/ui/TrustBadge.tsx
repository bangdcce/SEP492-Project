import {
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  Sprout,
  Shield,
} from "lucide-react";
import type { BadgeType } from "../../types";

interface TrustBadgeProps {
  type: BadgeType;
}

export function TrustBadge({ type }: TrustBadgeProps) {
  const badgeConfig = {
    TRUSTED: {
      icon: ShieldCheck,
      label: "Trusted",
      bgColor: "bg-yellow-50",
      textColor: "text-yellow-700",
      borderColor: "border-yellow-200",
    },

    VERIFIED: {
      icon: CheckCircle,
      label: "Verified",
      bgColor: "bg-teal-50",
      textColor: "text-teal-700",
      borderColor: "border-teal-200",
    },
    WARNING: {
      icon: AlertTriangle,
      label: "Warning",
      bgColor: "bg-red-50",
      textColor: "text-red-700",
      borderColor: "border-red-200",
    },
    NEW: {
      icon: Sprout,
      label: "New",
      bgColor: "bg-gray-50",
      textColor: "text-gray-700",
      borderColor: "border-gray-200",
    },
    NORMAL: {
      icon: Shield,
      label: "Normal",
      bgColor: "bg-slate-50",
      textColor: "text-slate-700",
      borderColor: "border-slate-200",
    },
  };

  const config = badgeConfig[type];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border ${config.bgColor} ${config.textColor} ${config.borderColor}`}
    >
      <Icon className="w-4  h-4" />
      <span className="text-sm">{config.label}</span>
    </span>
  );
}
