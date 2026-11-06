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

import { Page } from "@/components/app-shell/page";
import {
	CalendarError,
	CalendarLoading,
} from "@/components/calendar/calendar-status";
import { EventList } from "@/components/calendar/event-list";
import { ComingSoon } from "@/components/placeholder/coming-soon";
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
import { Spinner } from "@/components/ui/spinner/spinner";
import {
	eventsOnDay,
	rangeOfDays,
	startOfDay,
	startOfWeek,
} from "@/lib/calendar-time";
import { groupTasks, todayKey } from "@/lib/tasks";
import { currentTimeZone, weekRange } from "@/lib/time";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/_app/")({ component: TodayPage });

function TodayPage() {
	return (
		<Page title="今日">
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
				<Card>
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
		</Page>
	);
}

function TodayEvents() {
	const today = useMemo(() => startOfDay(new Date()), []);
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
	const today = todayKey();
	const { labels, projects } = useTaskContext();
	const { editor, openEdit } = useTaskEditor({ labels, projects });
	const tasks = useQuery(trpc.task.list.queryOptions({ today, view: "today" }));

	if (tasks.isPending) {
		return (
			<div className="flex justify-center py-8 text-muted-foreground">
				<Spinner />
			</div>
		);
	}
	if (tasks.isError) {
		return (
			<ComingSoon
				description="タスクを読み込めませんでした"
				icon={IconAlertTriangle}
			/>
		);
	}
	const groups = groupTasks(tasks.data, "today", { projects, today });
	return (
		<>
			{groups.length === 0 ? (
				<ComingSoon
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

function TodayTimer() {
	const { projects } = useTaskContext();
	const { editor, openEdit } = useEntryEditor(projects);
	return (
		<>
			<TimerBar onEdit={openEdit} projects={projects} />
			{editor}
		</>
	);
}

function ThisWeek() {
	const weekStart = useMemo(() => startOfWeek(new Date()), []);
	const range = useMemo(() => weekRange(weekStart), [weekStart]);
	const { projects } = useTaskContext();
	const summary = useQuery(
		trpc.time.summary.queryOptions({ ...range, timeZone: currentTimeZone() })
	);
	if (summary.isPending) {
		return (
			<div className="flex justify-center py-8 text-muted-foreground">
				<Spinner />
			</div>
		);
	}
	if (summary.isError) {
		return (
			<ComingSoon
				description="集計を読み込めませんでした"
				icon={IconAlertTriangle}
			/>
		);
	}
	if (summary.data.durationMs === 0) {
		return (
			<ComingSoon
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
