export default function ColorSwatch({
  color,
  label,
}: {
  color: string;
  label?: string;
}) {
  const raw = color.trim();
  const hexCandidate = /^#?[0-9a-f]{3}([0-9a-f]{3})?$/i.test(raw)
    ? `#${raw.replace("#", "")}`
    : raw;

  const canRenderColor =
    typeof CSS !== "undefined" && CSS.supports("color", hexCandidate);

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div
        className={`w-7 h-7 rounded border border-gray-200 dark:border-gray-700 shadow-sm flex-shrink-0 ${canRenderColor ? "" : "bg-gray-100 dark:bg-gray-800"}`}
        style={canRenderColor ? { backgroundColor: hexCandidate } : undefined}
        title={color}
      />
      {label && (
        <span className="text-[10px] text-gray-400 max-w-[64px] truncate text-center leading-tight">
          {label}
        </span>
      )}
    </div>
  );
}
