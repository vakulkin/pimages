"use client";

import { Button } from "@/components/ui/button";
import { Generation } from "@/lib/types";
import RegenerateDialog from "./RegenerateDialog";

export default function GenerationActions({
  generation,
  isPending,
  onAccept,
  onReject,
  onRemove,
  size = "default",
}: {
  generation: Pick<Generation, "id" | "status" | "image_url">;
  isPending: boolean;
  onAccept: () => void;
  onReject: () => void;
  onRemove: () => void;
  size?: "sm" | "default";
}) {
  const compact = size === "sm";
  const showActions = !!generation.image_url || generation.status === "failed";

  // Consistent sizing tokens — no manual className overrides for dimensions
  const btnSize = compact ? "sm" : "default";

  return (
    <div className={`flex flex-wrap ${compact ? "gap-1" : "gap-2"}`}>
      {showActions && (
        <>
          {generation.status !== "accepted" && (
            <Button
              size={btnSize}
              disabled={isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={onAccept}
            >
              Accept
            </Button>
          )}
          {generation.status !== "rejected" && (
            <Button
              size={btnSize}
              variant="outline"
              disabled={isPending}
              className="border-rose-300 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
              onClick={onReject}
            >
              Reject
            </Button>
          )}
          <RegenerateDialog id={generation.id} size={size} />
        </>
      )}
      <Button
        variant="destructive"
        size={btnSize}
        disabled={isPending}
        onClick={onRemove}
      >
        {isPending ? "…" : "Remove"}
      </Button>
    </div>
  );
}
