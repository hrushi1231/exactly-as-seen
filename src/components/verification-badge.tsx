import { ShieldCheck, CircleDashed, AlertTriangle } from "lucide-react";
import { VERIFICATION_LABEL, type VerificationStatus } from "@/lib/syllabus";
import { cn } from "@/lib/utils";

export function VerificationBadge({
  status,
  compact = false,
}: {
  status: VerificationStatus | null | undefined;
  compact?: boolean | undefined;
}) {
  const s: VerificationStatus = status ?? "unverified";
  const Icon = s === "verified" ? ShieldCheck : s === "needs_review" ? AlertTriangle : CircleDashed;
  const label = compact ? (s === "verified" ? "Verified" : VERIFICATION_LABEL[s]) : VERIFICATION_LABEL[s];
  return (
    <span
      title={VERIFICATION_LABEL[s]}
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium",
        s === "verified" && "border-primary/30 bg-primary/5 text-primary",
        s === "needs_review" && "border-destructive/30 bg-destructive/5 text-destructive",
        s === "unverified" && "border-border text-muted-foreground",
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
