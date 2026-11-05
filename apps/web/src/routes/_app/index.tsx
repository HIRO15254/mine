import {
	IconCalendarTime,
	IconChartBar,
	IconChecklist,
	IconChevronRight,
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
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card/card";
import { eventsOnDay, rangeOfDays, startOfDay } from "@/lib/calendar-time";
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
						<CardTitle>計測中</CardTitle>
					</CardHeader>
					<CardContent>
						<ComingSoon description="計測していません" icon={IconPlayerPlay} />
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<IconChecklist aria-hidden />
						<CardTitle>今日やるタスク</CardTitle>
					</CardHeader>
					<CardContent>
						<ComingSoon
							description="タスクはまだありません"
							icon={IconChecklist}
						/>
					</CardContent>
				</Card>
				<Card className="desk:col-span-3">
					<CardHeader>
						<IconChartBar aria-hidden />
						<CardTitle>今週の時間配分</CardTitle>
					</CardHeader>
					<CardContent>
						<ComingSoon
							description="記録がまだありません"
							icon={IconChartBar}
						/>
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
