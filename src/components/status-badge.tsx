import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Sparkles,
} from "lucide-react";
import { trackingTone, type StatusTone } from "@/lib/ui-data";
export default function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: StatusTone;
}) {
  const Icon =
    tone === "success"
      ? CheckCircle2
      : tone === "danger"
        ? AlertCircle
        : tone === "warning"
          ? AlertTriangle
          : tone === "info"
            ? Sparkles
            : Circle;
  return (
    <span className={`status-badge tone-${tone}`}>
      <Icon size={13} aria-hidden="true" />
      {children}
    </span>
  );
}
export function TrackingBadge({ value }: { value?: string }) {
  return (
    <StatusBadge tone={trackingTone(value || "")}>
      {value || "Chưa đánh giá"}
    </StatusBadge>
  );
}
