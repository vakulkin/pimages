"use client";

import Link from "next/link";
import { Generation, Attribute } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { inferAttributeType } from "@/lib/prompt";
import { ImagePairFull } from "./ImagePair";
import GenerationActions from "./GenerationActions";
import ColorSwatch from "./ColorSwatch";
import {
  useAcceptGeneration,
  useRejectGeneration,
  useRemoveGeneration,
} from "@/lib/hooks/useGenerationMutations";

function MetaItem({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
        {label}
      </dt>
      <dd
        className={`text-sm text-gray-800 dark:text-gray-200 truncate ${mono ? "font-mono text-xs" : ""}`}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}

function AttributeRow({ attr }: { attr: Attribute }) {
  const type = inferAttributeType(attr);

  return (
    <tr className="border-b border-gray-100 dark:border-gray-800">
      <td className="py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
        {attr.target}
      </td>
      <td className="py-2 px-3">
        <div className="flex items-center gap-1.5">
          {type === "hex" ? (
            <>
              {attr.from && (
                <>
                  <ColorSwatch color={attr.from} label={attr.from} />
                  <span className="text-gray-400 text-sm">→</span>
                </>
              )}
              <ColorSwatch color={attr.to} label={attr.to} />
            </>
          ) : (
            <>
              {attr.from && (
                <>
                  <span className="text-xs text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-md">
                    {attr.from}
                  </span>
                  <span className="text-gray-400 text-sm">→</span>
                </>
              )}
              <span className="text-xs text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-md">
                {attr.to}
              </span>
            </>
          )}
        </div>
      </td>
      <td className="py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
          {attr.material}
      </td>
    </tr>
  );
}

function GenerationCardItem({
  generation,
  isPending,
}: {
  generation: Generation;
  isPending: boolean;
}) {
  const acceptMutation = useAcceptGeneration();
  const rejectMutation = useRejectGeneration();
  const removeMutation = useRemoveGeneration();
  const itemPending = isPending || acceptMutation.isPending || rejectMutation.isPending || removeMutation.isPending;

  const handleAccept = () => acceptMutation.mutate(generation.id);
  const handleReject = () => rejectMutation.mutate(generation.id);
  const handleRemove = () => removeMutation.mutate(generation.id);

  return (
    <div
      className={`w-full bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden transition-opacity ${itemPending ? "opacity-60" : ""}`}
    >
      <ImagePairFull
        sourceUrl={generation.source_image_url}
        resultUrl={generation.image_url}
        status={generation.status}
      />

      {/* Body */}
      <div className="p-6 space-y-6">
        {/* Actions */}
        <div className="flex justify-end pb-6 border-b border-gray-100 dark:border-gray-800">
          <GenerationActions
            generation={generation}
            isPending={itemPending}
            onAccept={handleAccept}
            onReject={handleReject}
            onRemove={handleRemove}
          />
        </div>

        {/* Attributes */}
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Attributes
          </h3>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Target</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Change</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Material</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900">
                {generation.attributes.map((attr, i) => (
                  <AttributeRow key={i} attr={attr} />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Metadata grid */}
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Details
          </h3>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <MetaItem label="Product ID" value={String(generation.product_id)} />
            <MetaItem label="Status" value={generation.status} />
            <MetaItem
              label="Provider Status"
              value={generation.provider_status ?? "—"}
            />
            <MetaItem
              label="Retry Count"
              value={String(generation.retry_count)}
            />
            <MetaItem
              label="Created"
              value={formatDate(generation.created_at)}
            />
            <MetaItem
              label="Updated"
              value={formatDate(generation.updated_at)}
            />
          </dl>
        </div>
      </div>
    </div>
  );
}

export default function GenerationCard({
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
  const totalPages = Math.ceil(total / pageSize);

  if (total === 0 || generations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-56 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 text-gray-400 text-sm gap-2">
        <span className="text-3xl">✓</span>
        Nothing here right now.
      </div>
    );
  }

  const firstItem = page * pageSize + 1;
  const lastItem = Math.min(page * pageSize + generations.length, total);

  return (
    <div className="w-full space-y-4">
      {/* Pagination bar */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">
          {firstItem}–{lastItem} / {total}
        </span>
        <div className="flex gap-2">
          <Link
            href={`/protected/${tab}/${page - 1}`}
            aria-disabled={page === 0}
            className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${page === 0
                ? "opacity-30 pointer-events-none border-gray-200 dark:border-gray-800"
                : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
          >
            ← Prev
          </Link>
          <Link
            href={`/protected/${tab}/${page + 1}`}
            aria-disabled={page >= totalPages - 1}
            className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${page >= totalPages - 1
                ? "opacity-30 pointer-events-none border-gray-200 dark:border-gray-800"
                : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
          >
            Next →
          </Link>
        </div>
      </div>

      {/* Cards */}
      {generations.map((generation) => (
        <GenerationCardItem key={generation.id} generation={generation} isPending={false} />
      ))}
    </div>
  );
}
