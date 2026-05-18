"use client";

import Link from "next/link";
import { Generation } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import ColorSwatch from "./ColorSwatch";
import StatusBadge from "./StatusBadge";
import { ImagePairCompact } from "./ImagePair";
import GenerationActions from "./GenerationActions";
import {
    useAcceptGeneration,
    useRejectGeneration,
    useRemoveGeneration,
} from "@/lib/hooks/useGenerationMutations";

function GenerationRow({ gen }: { gen: Generation }) {
    const acceptMutation = useAcceptGeneration();
    const rejectMutation = useRejectGeneration();
    const removeMutation = useRemoveGeneration();
    const isPending = acceptMutation.isPending || rejectMutation.isPending || removeMutation.isPending;

    return (
        <div
            className={`group bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-3 space-y-2 shadow-sm transition-opacity hover:border-gray-300 dark:hover:border-gray-700 ${isPending ? "opacity-50 pointer-events-none" : ""}`}
        >
            {/* Row 1: images · product · status · colors · date */}
            <div className="flex items-center gap-3 flex-wrap min-w-0">
                <ImagePairCompact sourceUrl={gen.source_image_url} resultUrl={gen.image_url} />
                <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                    {gen.attributes.map((attr, i) => (
                        <div key={i} className="flex items-center gap-0.5">
                            {attr.from && <ColorSwatch color={attr.from} />}
                            <ColorSwatch color={attr.to} />
                            <span className="text-[10px] text-gray-400 ml-0.5 hidden sm:inline">{attr.target}</span>
                        </div>
                    ))}
                </div>
                <span className="text-[11px] text-gray-400 whitespace-nowrap ml-auto shrink-0">{formatDate(gen.created_at)}</span>
                <div className="flex flex-col gap-0.5 shrink-0">
                    <span className="font-mono text-xs text-gray-700 dark:text-gray-300">{gen.product_id}</span>
                </div>
            </div>

            {/* Row 2: error · actions */}
            <div className="flex items-center gap-3 min-w-0">
                <StatusBadge status={gen.status} />
                <div className="flex-1 min-w-0">
                    {gen.error_message && (
                        <p className="text-xs text-red-500 truncate" title={gen.error_message}>
                            {gen.error_message}
                        </p>
                    )}
                </div>
                <GenerationActions
                    generation={gen}
                    isPending={isPending}
                    size="sm"
                    onAccept={() => acceptMutation.mutate(gen.id)}
                    onReject={() => rejectMutation.mutate(gen.id)}
                    onRemove={() => removeMutation.mutate(gen.id)}
                />
            </div>
        </div>
    );
}

function Pagination({
    tab,
    page,
    total,
    pageSize,
}: {
    tab: string;
    page: number;
    total: number;
    pageSize: number;
}) {
    const totalPages = Math.ceil(total / pageSize);
    if (totalPages <= 1) return null;

    const start = page * pageSize + 1;
    const end = Math.min((page + 1) * pageSize, total);

    return (
        <div className="flex items-center justify-between mt-4">
            <span className="text-sm text-gray-500">
                {start}–{end} of {total}
            </span>
            <div className="flex gap-2">
                <Link
                    href={`/protected/${tab}/${page - 1}`}
                    aria-disabled={page === 0}
                    className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${page === 0
                        ? "opacity-30 pointer-events-none border-gray-200 dark:border-gray-800 text-gray-400"
                        : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                        }`}
                >
                    ← Prev
                </Link>
                <Link
                    href={`/protected/${tab}/${page + 1}`}
                    aria-disabled={page >= totalPages - 1}
                    className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${page >= totalPages - 1
                        ? "opacity-30 pointer-events-none border-gray-200 dark:border-gray-800 text-gray-400"
                        : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                        }`}
                >
                    Next →
                </Link>
            </div>
        </div>
    );
}

export default function GenerationTable({
    generations,
    tab,
    page,
    total,
    pageSize,
}: {
    generations: Generation[];
    tab: string;
    page: number;
    total: number;
    pageSize: number;
}) {
    if (total === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-40 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 text-gray-400 text-sm gap-2">
                <span className="text-3xl">✓</span>
                Nothing here right now.
            </div>
        );
    }

    return (
        <div className="w-full">
            <div className="space-y-2">
                {generations.map((gen) => (
                    <GenerationRow key={gen.id} gen={gen} />
                ))}
            </div>
            <Pagination tab={tab} page={page} total={total} pageSize={pageSize} />
        </div>
    );
}

