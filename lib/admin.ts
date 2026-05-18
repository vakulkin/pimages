export const CARD_TABS = ["completed", "accepted", "rejected"] as const;
export const TABLE_TABS = ["queued", "failed"] as const;
export type Tab = (typeof CARD_TABS)[number] | (typeof TABLE_TABS)[number];
export const ALL_TABS: Tab[] = [...CARD_TABS, ...TABLE_TABS];

export const TAB_LABELS: Record<Tab, string> = {
  completed: "Completed",
  accepted: "Accepted",
  rejected: "Rejected",
  queued: "Queue",
  failed: "Failed",
};

export function getStatusFilter(tab: Tab): string[] {
  if (tab === "queued") return ["queued", "processing"];
  return [tab];
}

