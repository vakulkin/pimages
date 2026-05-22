export default function ColorSwatch({
  color,
  label,
}: {
  color: string;
  label?: string;
}) {
  const raw = color.trim().replace(/;+$/, "");
  const hexMatch = raw.match(/^#?([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  const cssColor = hexMatch ? `#${hexMatch[1]}` : raw;

  // For valid hex tokens, render directly without depending on CSS.supports.
  const canRenderColor =
    hexMatch != null || (typeof CSS !== "undefined" && CSS.supports("color", cssColor));

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div
        className={`w-7 h-7 rounded border border-gray-200 dark:border-gray-700 shadow-sm flex-shrink-0 ${canRenderColor ? "" : "bg-gray-100 dark:bg-gray-800"}`}
        style={canRenderColor ? { backgroundColor: cssColor } : undefined}
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
