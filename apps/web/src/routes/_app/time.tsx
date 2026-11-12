import {
	IconAlertTriangle,
	IconClockHour4,
	IconPlus,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { EmptyState } from "@/components/app-shell/empty-state";
import { LoadingBlock } from "@/components/app-shell/loading-block";
import { Page } from "@/components/app-shell/page";
import { WeekNavigation } from "@/components/app-shell/week-navigation";
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
import { useWeek, validateWeekSearch, weekSearch } from "@/hooks/use-week";
import { formatWeekLabel } from "@/lib/calendar-time";
import { currentTimeZone, weekRange } from "@/lib/time";
import { trpc } from "@/lib/trpc";

export const Route = createFileRoute("/_app/time")({
	validateSearch: validateWeekSearch,
	component: TimePage,
});

function TimePage() {
	const { week } = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const { isCurrentWeek, weekStart } = useWeek(week);
	const range = useMemo(() => weekRange(weekStart), [weekStart]);
	const { projects } = useTaskContext();
	const { editor, openEdit, openNew } = useEntryEditor(projects);
	const entries = useQuery(trpc.time.list.queryOptions(range));
	const summary = useQuery(
		trpc.time.summary.queryOptions({ ...range, timeZone: currentTimeZone() })
	);

	return (
		<Page
			actions={
				<WeekNavigation
					isCurrentWeek={isCurrentWeek}
					onChange={(start) => navigate({ search: weekSearch(start) })}
					weekStart={weekStart}
				/>
			}
			title={`記録 ${formatWeekLabel(weekStart)}`}
		>
			<div className="flex flex-col gap-4">
				<div className="has-[[data-running]]:prism-edge rounded-lg border border-border bg-card p-3 has-[[data-running]]:shadow-[var(--glow)]">
					<TimerBar onEdit={openEdit} projects={projects} />
				</div>
				<div className="grid desk:grid-cols-[minmax(0,1fr)_300px] items-start gap-4">
					<Card className="desk:order-2">
						<CardHeader>
							<IconClockHour4 aria-hidden />
							<CardTitle>この週の合計</CardTitle>
						</CardHeader>
						<CardContent>
							{summary.isPending && <LoadingBlock />}
							{summary.isError && (
								<EmptyState
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
						{entries.isPending && <LoadingBlock />}
						{entries.isError && (
							<EmptyState
								description="記録を読み込めませんでした"
								icon={IconAlertTriangle}
							/>
						)}
						{entries.isSuccess && entries.data.length === 0 && (
							<EmptyState
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
