"use client";

import Link from "next/link";
import { ALL_TABS, TAB_LABELS, Tab } from "@/lib/admin";

export default function AdminTabs({
  tab,
  counts,
}: {
  tab: string;
  counts: Record<string, number>;
}) {
  return (
    <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800 mb-6 overflow-x-auto">
      {ALL_TABS.map((key: Tab) => {
        const active = tab === key;
        const count = counts[key] ?? 0;
        return (
          <Link
            key={key}
            href={`/protected/${key}/0`}
            className={[
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors",
              active
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200",
            ].join(" ")}
          >
            {TAB_LABELS[key]}
            {count > 0 && (
              <span
                className={[
                  "rounded-full px-1.5 py-0.5 text-xs font-medium",
                  active
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
                ].join(" ")}
              >
                {count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
