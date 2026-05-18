import Image from "next/image";
import StatusBadge from "./StatusBadge";

/** Full-width side-by-side panel used in GenerationCard */
export function ImagePairFull({
  sourceUrl,
  resultUrl,
  status,
}: {
  sourceUrl: string;
  resultUrl?: string | null;
  status: string;
}) {
  return (
    <div className="flex border-b border-gray-100 dark:border-gray-800">
      <div className="w-1/2 relative bg-gray-50 dark:bg-gray-800 border-r border-gray-100 dark:border-gray-800">
        <div className="absolute top-2 left-2 z-10 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
          Source
        </div>
        <div className="relative w-full aspect-square">
          <Image src={sourceUrl} alt="Source" fill className="object-contain" sizes="(max-width: 768px) 50vw, 400px" />
        </div>
      </div>

      <div className="w-1/2 relative bg-gray-50 dark:bg-gray-800">
        {resultUrl ? (
          <>
            <div className="absolute top-2 left-2 z-10 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
              Result
            </div>
            <div className="relative w-full aspect-square">
              <Image src={resultUrl} alt="Result" fill className="object-contain" sizes="(max-width: 768px) 50vw, 400px" />
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center aspect-square text-gray-400 text-sm flex-col gap-2">
            <span className="text-4xl opacity-30">🖼</span>
            <span>No result yet</span>
            <StatusBadge status={status} />
          </div>
        )}
      </div>
    </div>
  );
}

/** Compact thumbnails used in GenerationTable rows */
export function ImagePairCompact({
  sourceUrl,
  resultUrl,
}: {
  sourceUrl: string;
  resultUrl?: string | null;
}) {
  const imgCls =
    "object-contain rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800";

  return (
    <div className="flex gap-2 shrink-0">
      <Image src={sourceUrl} alt="Source" width={48} height={48} className={imgCls} />
      {resultUrl ? (
        <Image src={resultUrl} alt="Result" width={48} height={48} className={imgCls} />
      ) : (
        <div className="w-12 h-12 rounded border border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-300 dark:text-gray-700 text-lg">
          ?
        </div>
      )}
    </div>
  );
}

