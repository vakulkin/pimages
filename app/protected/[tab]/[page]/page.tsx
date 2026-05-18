import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Generation } from "@/lib/types";
import { ALL_TABS, TABLE_TABS, Tab, getStatusFilter } from "@/lib/admin";
import AdminTabs from "../../_components/AdminTabs";
import GenerationCard from "../../_components/GenerationCard";
import GenerationTable from "../../_components/GenerationTable";
import LogoutButton from "../../_components/LogoutButton";
// import TestStorageDeleteButton from "../../_components/TestStorageDeleteButton";

const TABLE_PAGE_SIZE = 25;
const SINGLE_PAGE_SIZE = 5;

async function AdminContent({
    params,
}: {
    params: Promise<{ tab: string; page: string }>;
}) {
    const { tab: tabParam, page: pageParam } = await params;
    if (!(ALL_TABS as readonly string[]).includes(tabParam)) notFound();

    const tab = tabParam as Tab;
    const pageNum = parseInt(pageParam, 10);
    const page = Number.isFinite(pageNum) ? Math.max(0, pageNum) : 0;

    const supabase = await createClient();

    const { data: statusRows } = await supabase
        .from("generations")
        .select("status")
        .in("status", ["queued", "processing", "completed", "accepted", "rejected", "failed"]);

    const statusTotals: Record<string, number> = {};
    for (const row of statusRows ?? []) {
        statusTotals[row.status] = (statusTotals[row.status] ?? 0) + 1;
    }

    const counts: Record<Tab, number> = {
        queued: (statusTotals["queued"] ?? 0) + (statusTotals["processing"] ?? 0),
        completed: statusTotals["completed"] ?? 0,
        accepted: statusTotals["accepted"] ?? 0,
        rejected: statusTotals["rejected"] ?? 0,
        failed: statusTotals["failed"] ?? 0,
    };

    const isTable = (TABLE_TABS as readonly string[]).includes(tab);
    const statusFilter = getStatusFilter(tab);

    let generations: Generation[] = [];
    let total = 0;

    if (isTable) {
        const from = page * TABLE_PAGE_SIZE;
        const to = from + TABLE_PAGE_SIZE - 1;
        const { data, count } = await supabase
            .from("generations")
            .select("*", { count: "exact" })
            .in("status", statusFilter)
            .order("created_at", { ascending: true })
            .range(from, to);
        generations = (data as Generation[]) ?? [];
        total = count ?? 0;
    } else {
        const from = page * SINGLE_PAGE_SIZE;
        const to = from + SINGLE_PAGE_SIZE - 1;
        const { data, count } = await supabase
            .from("generations")
            .select("*", { count: "exact" })
            .in("status", statusFilter)
            .order("created_at", { ascending: true })
            .range(from, to);
        generations = (data as Generation[]) ?? [];
        total = count ?? 0;
    }

    return (
        <>
            <AdminTabs tab={tab} counts={counts} />
            {/* <TestStorageDeleteButton id="123" /> */}
            {isTable ? (
                <GenerationTable
                    generations={generations}
                    tab={tab}
                    page={page}
                    total={total}
                    pageSize={TABLE_PAGE_SIZE}
                />
            ) : (
                <GenerationCard
                    generations={generations}
                    tab={tab}
                    page={page}
                    total={total}
                    pageSize={SINGLE_PAGE_SIZE}
                />
            )}
        </>
    );
}

export default function TabPage({
    params,
}: {
    params: Promise<{ tab: string; page: string }>;
}) {
    return (
        <div className="w-full max-w-5xl px-4 py-8">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    Generation Admin
                </h1>
                <LogoutButton />
            </div>
            <Suspense
                fallback={
                    <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
                        Loading…
                    </div>
                }
            >
                <AdminContent params={params} />
            </Suspense>
        </div>
    );
}
