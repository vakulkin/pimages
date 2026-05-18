export default function ColorSwatch({
  color,
  label,
}: {
  color: string;
  label?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div
        className="w-7 h-7 rounded border border-gray-200 dark:border-gray-700 shadow-sm flex-shrink-0"
        style={{ backgroundColor: `#${color.replace("#", "")}` }}
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
