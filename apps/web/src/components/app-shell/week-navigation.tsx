import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";

import { Button } from "@/components/ui/button/button";
import { IconButton } from "@/components/ui/icon-button/icon-button";
import { addDays } from "@/lib/calendar-time";

/** 今週, previous and next: the header actions of a screen that shows a week. */
export function WeekNavigation({
	isCurrentWeek,
	onChange,
	weekStart,
}: {
	isCurrentWeek: boolean;
	/** Called with the Monday to show, or null for the current week. */
	onChange: (weekStart: Date | null) => void;
	weekStart: Date;
}) {
	return (
		<>
			<Button
				disabled={isCurrentWeek}
				onClick={() => onChange(null)}
				size="sm"
				type="button"
				variant="outline"
			>
				今週
			</Button>
			<IconButton
				label="前の週"
				onClick={() => onChange(addDays(weekStart, -7))}
			>
				<IconChevronLeft aria-hidden />
			</IconButton>
			<IconButton
				label="次の週"
				onClick={() => onChange(addDays(weekStart, 7))}
			>
				<IconChevronRight aria-hidden />
			</IconButton>
		</>
	);
}
