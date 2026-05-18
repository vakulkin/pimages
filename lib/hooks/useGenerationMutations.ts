"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  acceptGeneration,
  rejectGeneration,
  removeGeneration,
  regenerateGeneration,
} from "@/app/protected/actions";

export function useAcceptGeneration() {
  const router = useRouter();
  return useMutation({
    mutationFn: (id: string) => acceptGeneration(id),
    onSuccess: () => router.refresh(),
  });
}

export function useRejectGeneration() {
  const router = useRouter();
  return useMutation({
    mutationFn: (id: string) => rejectGeneration(id),
    onSuccess: () => router.refresh(),
  });
}

export function useRemoveGeneration() {
  const router = useRouter();
  return useMutation({
    mutationFn: (id: string) => removeGeneration(id),
    onSuccess: () => router.refresh(),
  });
}

export function useRegenerateGeneration(onSuccess?: () => void) {
  const router = useRouter();
  return useMutation({
    mutationFn: ({ id, extraPrompt }: { id: string; extraPrompt?: string }) =>
      regenerateGeneration(id, extraPrompt),
    onSuccess: () => {
      onSuccess?.();
      router.refresh();
      router.push("/protected/queued/0");
    },
  });
}
