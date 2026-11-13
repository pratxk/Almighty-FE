/**
 * Colour-coded confidence badge.
 * >= 0.75 green, >= 0.5 amber, otherwise red.
 */
export default function ConfidenceBadge({
  confidence,
}: {
  confidence: number;
}) {
  const pct = Math.round(confidence * 100);
  const label =
    confidence >= 0.75 ? "High" : confidence >= 0.5 ? "Medium" : "Low";
  const tone =
    confidence >= 0.75
      ? "border-success/40 bg-success/10 text-success"
      : confidence >= 0.5
        ? "border-warn/40 bg-warn/10 text-warn"
        : "border-danger/40 bg-danger/10 text-danger";
  const dot =
    confidence >= 0.75
      ? "bg-success"
      : confidence >= 0.5
        ? "bg-warn"
        : "bg-danger";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide ${tone}`}
      title={`Model-reported answer confidence: ${pct}%`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label} confidence
      <span className="font-mono font-medium opacity-90">{pct}%</span>
    </span>
  );
}
