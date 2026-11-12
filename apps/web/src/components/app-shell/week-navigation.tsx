import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";

import { Button } from "@/components/ui/button/button";
import { IconButton } from "@/components/ui/icon-button/icon-button";
import { addDays } from "@/lib/calendar-time";

/**
 * 今週 (or 今月), previous and next: the header actions of a screen that
 * shows one period.
 */
export function PeriodNavigation({
	currentLabel,
	hideCurrentWhenShown = false,
	isCurrent,
	nextLabel,
	onCurrent,
	onNext,
	onPrevious,
	previousLabel,
}: {
	currentLabel: string;
	/** Leave the 今週 button out while it would do nothing, where room is short. */
	hideCurrentWhenShown?: boolean;
	isCurrent: boolean;
	nextLabel: string;
	onCurrent: () => void;
	onNext: () => void;
	onPrevious: () => void;
	previousLabel: string;
}) {
	return (
		<>
			{hideCurrentWhenShown && isCurrent ? null : (
				<Button
					disabled={isCurrent}
					onClick={onCurrent}
					size="sm"
					type="button"
					variant="outline"
				>
					{currentLabel}
				</Button>
			)}
			<IconButton label={previousLabel} onClick={onPrevious}>
				<IconChevronLeft aria-hidden />
			</IconButton>
			<IconButton label={nextLabel} onClick={onNext}>
				<IconChevronRight aria-hidden />
			</IconButton>
		</>
	);
}

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
		<PeriodNavigation
			currentLabel="今週"
			isCurrent={isCurrentWeek}
			nextLabel="次の週"
			onCurrent={() => onChange(null)}
			onNext={() => onChange(addDays(weekStart, 7))}
			onPrevious={() => onChange(addDays(weekStart, -7))}
			previousLabel="前の週"
		/>
	);
}
