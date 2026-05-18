"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteGenerationStorage } from "../actions";

export default function TestStorageDeleteButton({ id }: { id: string }) {
  const [result, setResult] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    setResult(null);
    startTransition(async () => {
      const res = await deleteGenerationStorage(id);
      setResult(JSON.stringify(res));
    });
  };

  return (
    <div className="flex items-center gap-3 mb-4">
      <Button
        size="sm"
        variant="outline"
        disabled={isPending}
        className="border-orange-300 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/20"
        onClick={handleClick}
      >
        {isPending ? "Deleting…" : "Test Storage Delete"}
      </Button>
      {result && (
        <span className="text-xs font-mono text-gray-600 dark:text-gray-400">{result}</span>
      )}
    </div>
  );
}
