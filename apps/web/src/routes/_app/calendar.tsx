import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";

import { Page } from "@/components/app-shell/page";
import { WeekNavigation } from "@/components/app-shell/week-navigation";
import { WeekPlanner } from "@/components/calendar/week-planner";
import { useWeek, validateWeekSearch, weekSearch } from "@/hooks/use-week";
import { addDays, dayKey, formatWeekLabel } from "@/lib/calendar-time";

export const Route = createFileRoute("/_app/calendar")({
	validateSearch: validateWeekSearch,
	component: CalendarPage,
});

function CalendarPage() {
	const { week } = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const { isCurrentWeek, today, weekStart } = useWeek(week);
	const days = useMemo(
		() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
		[weekStart]
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
			className="desk:max-w-[1280px]"
			title={formatWeekLabel(weekStart)}
		>
			<WeekPlanner
				days={days}
				key={dayKey(weekStart)}
				today={today}
				weekStart={weekStart}
			/>
		</Page>
	);
}
