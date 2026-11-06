import {
	IconAlertTriangle,
	IconChevronLeft,
	IconChevronRight,
	IconClockHour4,
	IconPlus,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";

import { Page } from "@/components/app-shell/page";
import { ComingSoon } from "@/components/placeholder/coming-soon";
import { useTaskContext } from "@/components/tasks/use-tasks";
import { useEntryEditor } from "@/components/time/entry-editor";
import { EntryList } from "@/components/time/entry-list";
import { TimerBar } from "@/components/time/timer-bar";
import { WeekSummary } from "@/components/time/week-summary";
import { Button } from "@/components/ui/button/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card/card";
import { IconButton } from "@/components/ui/icon-button/icon-button";
import { Spinner } from "@/components/ui/spinner/spinner";
import {
	addDays,
	dayKey,
	formatWeekLabel,
	parseDayKey,
	startOfWeek,
} from "@/lib/calendar-time";
import { currentTimeZone, weekRange } from "@/lib/time";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/_app/time")({
	validateSearch: (search: Record<string, unknown>): { week?: string } =>
		typeof search.week === "string" && parseDayKey(search.week)
			? { week: search.week }
			: {},
	component: TimePage,
});

function Loading() {
	return (
		<div className="flex justify-center py-8 text-muted-foreground">
			<Spinner />
		</div>
	);
}

function TimePage() {
	const { week } = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const weekStart = useMemo(
		() => startOfWeek(parseDayKey(week) ?? new Date()),
		[week]
	);
	const range = useMemo(() => weekRange(weekStart), [weekStart]);
	const isCurrentWeek = dayKey(weekStart) === dayKey(startOfWeek(new Date()));
	const { projects } = useTaskContext();
	const { editor, openEdit, openNew } = useEntryEditor(projects);
	const entries = useQuery(trpc.time.list.queryOptions(range));
	const summary = useQuery(
		trpc.time.summary.queryOptions({ ...range, timeZone: currentTimeZone() })
	);

	const goToWeek = (start: Date | null) =>
		navigate({ search: start ? { week: dayKey(start) } : {} });

	return (
		<Page
			actions={
				<>
					<Button
						disabled={isCurrentWeek}
						onClick={() => goToWeek(null)}
						size="sm"
						type="button"
						variant="outline"
					>
						今週
					</Button>
					<IconButton
						label="前の週"
						onClick={() => goToWeek(addDays(weekStart, -7))}
					>
						<IconChevronLeft aria-hidden />
					</IconButton>
					<IconButton
						label="次の週"
						onClick={() => goToWeek(addDays(weekStart, 7))}
					>
						<IconChevronRight aria-hidden />
					</IconButton>
				</>
			}
			title={`記録 ${formatWeekLabel(weekStart)}`}
		>
			<div className="flex flex-col gap-4">
				<div className="rounded-lg border border-border bg-card p-3">
					<TimerBar onEdit={openEdit} projects={projects} />
				</div>
				<div className="grid desk:grid-cols-[minmax(0,1fr)_300px] items-start gap-4">
					<Card className="desk:order-2">
						<CardHeader>
							<IconClockHour4 aria-hidden />
							<CardTitle>この週の合計</CardTitle>
						</CardHeader>
						<CardContent>
							{summary.isPending && <Loading />}
							{summary.isError && (
								<ComingSoon
									description="集計を読み込めませんでした"
									icon={IconAlertTriangle}
								/>
							)}
							{summary.isSuccess && (
								<WeekSummary
									projects={projects}
									summary={summary.data}
									weekStart={weekStart}
								/>
							)}
						</CardContent>
					</Card>
					<div className="desk:order-1 flex flex-col gap-3">
						<Button
							className="self-start"
							onClick={openNew}
							type="button"
							variant="secondary"
						>
							<IconPlus aria-hidden />
							記録を追加
						</Button>
						{entries.isPending && <Loading />}
						{entries.isError && (
							<ComingSoon
								description="記録を読み込めませんでした"
								icon={IconAlertTriangle}
							/>
						)}
						{entries.isSuccess && entries.data.length === 0 && (
							<ComingSoon
								description="この週の記録はありません"
								icon={IconClockHour4}
							/>
						)}
						{entries.isSuccess && entries.data.length > 0 && (
							<EntryList
								entries={entries.data}
								onOpen={openEdit}
								projects={projects}
							/>
						)}
					</div>
				</div>
			</div>
			{editor}
		</Page>
	);
}
