import {
	IconAlertTriangle,
	IconCalendarTime,
	IconChartBar,
	IconChecklist,
	IconChevronRight,
	IconCircleCheck,
	IconMessages,
	IconPlayerPlay,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { EmptyState } from "@/components/app-shell/empty-state";
import { LoadingBlock } from "@/components/app-shell/loading-block";
import { Page } from "@/components/app-shell/page";
import {
	CalendarError,
	CalendarLoading,
} from "@/components/calendar/calendar-status";
import { EventList } from "@/components/calendar/event-list";
import { useTaskEditor } from "@/components/tasks/task-editor";
import { TaskList } from "@/components/tasks/task-list";
import { useTaskContext } from "@/components/tasks/use-tasks";
import { ThreadList } from "@/components/threads/thread-list";
import { useEntryEditor } from "@/components/time/entry-editor";
import { TimerBar } from "@/components/time/timer-bar";
import { WeekSummary } from "@/components/time/week-summary";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card/card";
import { useIsDesk } from "@/hooks/use-media-query";
import { useToday, useTodayDate } from "@/hooks/use-today";
import { eventsOnDay, rangeOfDays, startOfWeek } from "@/lib/calendar-time";
import { groupTasks } from "@/lib/tasks";
import { currentTimeZone, type TimeEntry, weekRange } from "@/lib/time";
import { trpc } from "@/lib/trpc";

export const Route = createFileRoute("/_app/")({ component: TodayPage });

function TodayPage() {
	const isDesk = useIsDesk();
	return (
		<Page className="flex flex-col gap-3.5" title="今日">
			<div className="grid desk:grid-cols-3 desk:gap-4 gap-3.5">
				<Card className="desk:col-span-2 desk:row-span-2">
					<CardHeader>
						<IconCalendarTime aria-hidden />
						<CardTitle>今日の予定</CardTitle>
						<Link
							className="inline-flex items-center gap-0.5 text-primary-text text-xs no-underline hover:underline"
							to="/calendar"
						>
							カレンダー
							<IconChevronRight aria-hidden className="size-3.5" />
						</Link>
					</CardHeader>
					<CardContent>
						<TodayEvents />
					</CardContent>
				</Card>
				{isDesk ? (
					<Card className="has-[[data-running]]:prism-edge has-[[data-running]]:shadow-[var(--glow)]">
						<CardHeader>
							<IconPlayerPlay aria-hidden />
							<CardTitle>計測</CardTitle>
							<Link
								className="inline-flex items-center gap-0.5 text-primary-text text-xs no-underline hover:underline"
								to="/time"
							>
								記録
								<IconChevronRight aria-hidden className="size-3.5" />
							</Link>
						</CardHeader>
						<CardContent>
							<TodayTimer />
						</CardContent>
					</Card>
				) : null}
				<Card>
					<CardHeader>
						<IconChecklist aria-hidden />
						<CardTitle>今日やるタスク</CardTitle>
						<Link
							className="inline-flex items-center gap-0.5 text-primary-text text-xs no-underline hover:underline"
							to="/tasks"
						>
							タスク
							<IconChevronRight aria-hidden className="size-3.5" />
						</Link>
					</CardHeader>
					<CardContent>
						<TodayTasks />
					</CardContent>
				</Card>
				<Card className="desk:col-span-3">
					<CardHeader>
						<IconMessages aria-hidden />
						<CardTitle>Claude のスレッド</CardTitle>
					</CardHeader>
					<CardContent>
						<ThreadList />
					</CardContent>
				</Card>
				<Card className="desk:col-span-3">
					<CardHeader>
						<IconChartBar aria-hidden />
						<CardTitle>今週の時間配分</CardTitle>
					</CardHeader>
					<CardContent>
						<ThisWeek />
					</CardContent>
				</Card>
			</div>
			{isDesk ? null : <FloatingTimer />}
		</Page>
	);
}

function TodayEvents() {
	const today = useTodayDate();
	const query = useQuery({
		...trpc.calendar.events.queryOptions(rangeOfDays(today, 1)),
		staleTime: 60_000,
	});

	if (query.isPending) {
		return <CalendarLoading />;
	}
	if (query.isError) {
		return (
			<CalendarError error={query.error} onRetry={() => query.refetch()} />
		);
	}
	return (
		<EventList
			className="-mx-2"
			day={today}
			emptyLabel="今日の予定はありません"
			events={eventsOnDay(query.data.events, today)}
		/>
	);
}

function TodayTasks() {
	const today = useToday();
	const { labels, projects } = useTaskContext();
	const { editor, openEdit } = useTaskEditor({ labels, projects });
	const tasks = useQuery(trpc.task.list.queryOptions({ today, view: "today" }));

	if (tasks.isPending) {
		return <LoadingBlock />;
	}
	if (tasks.isError) {
		return (
			<EmptyState
				description="タスクを読み込めませんでした"
				icon={IconAlertTriangle}
			/>
		);
	}
	const groups = groupTasks(tasks.data, "today", { projects, today });
	return (
		<>
			{groups.length === 0 ? (
				<EmptyState
					description="今日やることはありません"
					icon={IconCircleCheck}
				/>
			) : (
				<div className="-mx-2">
					<TaskList
						groups={groups}
						onOpen={openEdit}
						projects={projects}
						today={today}
					/>
				</div>
			)}
			{editor}
		</>
	);
}

/**
 * On the phone the timer floats at the bottom of Today, above the tab bar,
 * so it stays in reach while the page scrolls. The desk layout keeps it as a
 * card beside the schedule.
 */
function FloatingTimer() {
	return (
		<section
			aria-label="計測"
			className="has-[[data-running]]:prism-edge sticky bottom-3 z-10 mt-auto rounded-xl border border-border bg-card p-3 text-card-foreground shadow-[var(--shadow-lg)] has-[[data-running]]:shadow-[var(--glow),var(--shadow-lg)]"
			data-slot="floating-timer"
		>
			<TodayTimer menuPlacement="top" />
		</section>
	);
}

function TodayTimer({ menuPlacement }: { menuPlacement?: "bottom" | "top" }) {
	const { projects } = useTaskContext();
	const { editor, openEdit } = useEntryEditor(projects);
	// Same query as TodayTasks, so the estimate comes from the cache.
	const today = useToday();
	const tasks = useQuery(trpc.task.list.queryOptions({ today, view: "today" }));
	const estimateOf = (entry: TimeEntry) =>
		tasks.data?.find((task) => task.id === entry.taskId)?.estimateMinutes ??
		null;
	return (
		<>
			<TimerBar
				estimateOf={estimateOf}
				menuPlacement={menuPlacement}
				onEdit={openEdit}
				projects={projects}
			/>
			{editor}
		</>
	);
}

function ThisWeek() {
	const today = useTodayDate();
	const weekStart = useMemo(() => startOfWeek(today), [today]);
	const range = useMemo(() => weekRange(weekStart), [weekStart]);
	const { projects } = useTaskContext();
	const summary = useQuery(
		trpc.time.summary.queryOptions({ ...range, timeZone: currentTimeZone() })
	);
	if (summary.isPending) {
		return <LoadingBlock />;
	}
	if (summary.isError) {
		return (
			<EmptyState
				description="集計を読み込めませんでした"
				icon={IconAlertTriangle}
			/>
		);
	}
	if (summary.data.durationMs === 0) {
		return (
			<EmptyState
				description="今週の記録はまだありません"
				icon={IconChartBar}
			/>
		);
	}
	return (
		<div className="desk:max-w-[560px]">
			<WeekSummary
				projects={projects}
				summary={summary.data}
				weekStart={weekStart}
			/>
		</div>
	);
}
