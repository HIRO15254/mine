import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";

import { Page } from "@/components/app-shell/page";
import {
	CalendarError,
	CalendarLoading,
} from "@/components/calendar/calendar-status";
import { EventList } from "@/components/calendar/event-list";
import { Button } from "@/components/ui/button/button";
import { IconButton } from "@/components/ui/icon-button/icon-button";
import {
	addDays,
	type DisplayEvent,
	dayKey,
	eventsOnDay,
	formatDayLabel,
	formatWeekLabel,
	parseDayKey,
	rangeOfDays,
	startOfDay,
	startOfWeek,
} from "@/lib/calendar-time";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/_app/calendar")({
	validateSearch: (search: Record<string, unknown>): { week?: string } =>
		typeof search.week === "string" && parseDayKey(search.week)
			? { week: search.week }
			: {},
	component: CalendarPage,
});

function CalendarPage() {
	const { week } = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const today = startOfDay(new Date());
	const weekStart = useMemo(
		() => startOfWeek(parseDayKey(week) ?? new Date()),
		[week]
	);
	const days = useMemo(
		() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
		[weekStart]
	);
	const isCurrentWeek = dayKey(weekStart) === dayKey(startOfWeek(today));

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
			title={formatWeekLabel(weekStart)}
		>
			<WeekAgenda days={days} today={today} weekStart={weekStart} />
		</Page>
	);
}

function WeekAgenda({
	days,
	today,
	weekStart,
}: {
	days: Date[];
	today: Date;
	weekStart: Date;
}) {
	const query = useQuery({
		...trpc.calendar.events.queryOptions(rangeOfDays(weekStart, 7)),
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
		<div className="flex max-w-[720px] flex-col desk:gap-5 gap-4">
			{days.map((day) => (
				<DaySection
					day={day}
					events={query.data.events}
					isToday={dayKey(day) === dayKey(today)}
					key={dayKey(day)}
				/>
			))}
		</div>
	);
}

function DaySection({
	day,
	events,
	isToday,
}: {
	day: Date;
	events: DisplayEvent[];
	isToday: boolean;
}) {
	return (
		<section aria-label={formatDayLabel(day)} className="flex flex-col gap-1">
			<h2
				className={cn(
					"m-0 border-border-subtle border-b pb-1.5 font-semibold text-sm",
					isToday && "text-primary-text"
				)}
			>
				{formatDayLabel(day)}
				{isToday && <span className="ml-2 font-normal text-xs">今日</span>}
			</h2>
			<EventList
				className="-mx-2"
				day={day}
				events={eventsOnDay(events, day)}
			/>
		</section>
	);
}
