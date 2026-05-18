"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useRegenerateGeneration } from "@/lib/hooks/useGenerationMutations";

export default function RegenerateDialog({ id, size }: { id: string; size?: "sm" | "default" }) {
  const [open, setOpen] = useState(false);
  const [extraPrompt, setExtraPrompt] = useState("");

  const mutation = useRegenerateGeneration(() => {
    setOpen(false);
    setExtraPrompt("");
  });

  const handleSubmit = () => {
    mutation.mutate({ id, extraPrompt: extraPrompt.trim() || undefined });
  };

  return (
    <>
      <Button variant="outline" size={size ?? "default"} onClick={() => setOpen(true)}>
        Regenerate
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !mutation.isPending && setOpen(false)}
          />
          <div className="relative z-10 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 w-full max-w-md border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold mb-1">Regenerate</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Optionally add extra instructions to the prompt. Leave blank to
              use the original prompt.
            </p>
            <Textarea
              placeholder="e.g. Make the leather texture more realistic, increase contrast…"
              value={extraPrompt}
              onChange={(e) => setExtraPrompt(e.target.value)}
              rows={4}
              className="mb-4"
              disabled={mutation.isPending}
            />
            {mutation.isError && (
              <p className="text-sm text-red-600 mb-3">
                {mutation.error instanceof Error ? mutation.error.message : "Failed to regenerate"}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={mutation.isPending}
              >
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={mutation.isPending}>
                {mutation.isPending ? "Submitting…" : "Regenerate"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
