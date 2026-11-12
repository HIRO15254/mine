import { IconPlus } from "@tabler/icons-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";

import { Page } from "@/components/app-shell/page";
import { PeriodNavigation } from "@/components/app-shell/week-navigation";
import { useEventEditor } from "@/components/calendar/event-editor";
import {
	CalendarPlanner,
	type CalendarView,
} from "@/components/calendar/planner";
import { Button } from "@/components/ui/button/button";
import {
	ToggleGroup,
	ToggleGroupItem,
} from "@/components/ui/toggle-group/toggle-group";
import { useIsDesk } from "@/hooks/use-media-query";
import { useMonth, validMonth } from "@/hooks/use-month";
import { useWeek, validateWeekSearch } from "@/hooks/use-week";
import {
	addDays,
	addMonths,
	dayKey,
	formatMonthLabel,
	formatWeekLabel,
	monthGridDays,
	monthKey,
	startOfMonth,
	startOfWeek,
} from "@/lib/calendar-time";

interface CalendarSearch {
	month?: string;
	view?: "month";
	week?: string;
}

export const Route = createFileRoute("/_app/calendar")({
	validateSearch: (search: Record<string, unknown>): CalendarSearch => ({
		...validateWeekSearch(search),
		month: validMonth(search.month),
		view: search.view === "month" ? "month" : undefined,
	}),
	component: CalendarPage,
});

function CalendarPage() {
	const search = Route.useSearch();
	const view: CalendarView = search.view ?? "week";
	const navigate = useNavigate({ from: Route.fullPath });
	const isDesk = useIsDesk();
	const { isCurrentWeek, today, weekStart } = useWeek(search.week);
	const { isCurrentMonth, monthStart } = useMonth(search.month);
	const eventEditor = useEventEditor();
	const days = useMemo(
		() =>
			view === "month"
				? monthGridDays(monthStart)
				: Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
		[view, monthStart, weekStart]
	);

	const showWeek = (start: Date | null) =>
		navigate({ search: start ? { week: dayKey(start) } : {} });
	const showMonth = (start: Date | null) =>
		navigate({
			search: start
				? { month: monthKey(start), view: "month" as const }
				: { view: "month" as const },
		});
	const switchView = (next: string) => {
		if (next === "month") {
			// The month of the week on screen.
			showMonth(isCurrentWeek ? null : startOfMonth(weekStart));
		} else if (next === "week") {
			showWeek(isCurrentMonth ? null : startOfWeek(monthStart));
		}
	};
	const isCurrent = view === "month" ? isCurrentMonth : isCurrentWeek;
	// A new event from the header: today when it is on screen, at the next hour.
	const addEvent = () => {
		const todayKey = dayKey(today);
		const onScreen = days.some((day) => dayKey(day) === todayKey);
		const hour = Math.min(new Date().getHours() + 1, 23);
		eventEditor.openNew({
			allDay: false,
			day: onScreen
				? todayKey
				: dayKey(view === "month" ? monthStart : weekStart),
			minutes: hour * 60,
		});
	};

	return (
		<Page
			actions={
				<>
					<ToggleGroup
						aria-label="表示"
						onValueChange={switchView}
						type="single"
						value={view}
					>
						<ToggleGroupItem className="h-8 px-2.5 text-xs" value="week">
							週
						</ToggleGroupItem>
						<ToggleGroupItem className="h-8 px-2.5 text-xs" value="month">
							月
						</ToggleGroupItem>
					</ToggleGroup>
					<PeriodNavigation
						currentLabel={view === "month" ? "今月" : "今週"}
						hideCurrentWhenShown={!isDesk}
						isCurrent={isCurrent}
						nextLabel={view === "month" ? "次の月" : "次の週"}
						onCurrent={() =>
							view === "month" ? showMonth(null) : showWeek(null)
						}
						onNext={() =>
							view === "month"
								? showMonth(addMonths(monthStart, 1))
								: showWeek(addDays(weekStart, 7))
						}
						onPrevious={() =>
							view === "month"
								? showMonth(addMonths(monthStart, -1))
								: showWeek(addDays(weekStart, -7))
						}
						previousLabel={view === "month" ? "前の月" : "前の週"}
					/>
					{isDesk ? (
						<Button onClick={addEvent} size="sm" type="button">
							<IconPlus aria-hidden />
							予定を追加
						</Button>
					) : null}
				</>
			}
			className="desk:max-w-[1280px]"
			fill={view === "week"}
			title={
				view === "month"
					? formatMonthLabel(monthStart)
					: formatWeekLabel(weekStart)
			}
		>
			<CalendarPlanner
				days={days}
				eventEditor={eventEditor}
				key={`${view}:${dayKey(days[0] ?? today)}`}
				month={view === "month" ? monthStart : null}
				onPickDay={(day) => showWeek(startOfWeek(day))}
				today={today}
				view={view}
			/>
			{eventEditor.editor}
		</Page>
	);
}
