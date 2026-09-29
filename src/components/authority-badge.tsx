import { AUTHORITY_LABEL, authorityClass } from "@/lib/documents";
import { cn } from "@/lib/utils";

export function AuthorityBadge({ level }: { level: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        authorityClass(level),
      )}
    >
      {AUTHORITY_LABEL[level] ?? level}
    </span>
  );
}

export function StatusPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
      {children}
    </span>
  );
}
