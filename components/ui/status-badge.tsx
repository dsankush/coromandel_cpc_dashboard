import React from "react";
import { ApprovalStatus, ApprovalStatusCode } from "@/types/order";
import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, XCircle } from "lucide-react";

interface StatusBadgeProps {
  status: ApprovalStatus | ApprovalStatusCode | string;
  className?: string;
  showIcon?: boolean;
}

export function StatusBadge({ status, className, showIcon = true }: StatusBadgeProps) {
  let normalizedStatus: ApprovalStatus = ApprovalStatus.Pending;

  if (status === 1 || status === "1" || status === ApprovalStatus.Approved) {
    normalizedStatus = ApprovalStatus.Approved;
  } else if (status === 2 || status === "2" || status === ApprovalStatus.Rejected) {
    normalizedStatus = ApprovalStatus.Rejected;
  } else {
    normalizedStatus = ApprovalStatus.Pending;
  }

  const configs = {
    [ApprovalStatus.Approved]: {
      label: "Approved",
      icon: CheckCircle2,
      style: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    },
    [ApprovalStatus.Pending]: {
      label: "Pending",
      icon: Clock,
      style: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
    },
    [ApprovalStatus.Rejected]: {
      label: "Rejected",
      icon: XCircle,
      style: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
    },
  };

  const config = configs[normalizedStatus];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-all",
        config.style,
        className
      )}
    >
      {showIcon && <Icon className="w-3.5 h-3.5" />}
      {config.label}
    </span>
  );
}
