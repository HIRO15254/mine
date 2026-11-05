import type { DisplayEvent } from "@/lib/calendar-time";
import { formatEventTime } from "@/lib/calendar-time";
import { cn } from "@/lib/utils";

export function EventList({
	className,
	day,
	emptyLabel = "予定はありません",
	events,
}: {
	className?: string;
	day: Date;
	emptyLabel?: string;
	events: DisplayEvent[];
}) {
	if (events.length === 0) {
		return (
			<p
				className={cn(
					"m-0 px-2 py-2 desk:text-sm text-[length:var(--m-text-secondary)] text-muted-foreground",
					className
				)}
			>
				{emptyLabel}
			</p>
		);
	}
	return (
		<ul className={cn("m-0 flex list-none flex-col p-0", className)}>
			{events.map((event) => (
				<li key={`${event.calendarId}:${event.id}`}>
					<EventRow day={day} event={event} />
				</li>
			))}
		</ul>
	);
}

function EventRow({ day, event }: { day: Date; event: DisplayEvent }) {
	const content = (
		<>
			<span
				aria-hidden
				className="mt-[7px] size-2 shrink-0 rounded-full"
				style={{ backgroundColor: event.color }}
			/>
			<span className="w-[92px] shrink-0 pt-px font-mono text-muted-foreground text-xs tabular-nums leading-5">
				{formatEventTime(event, day)}
			</span>
			<span className="flex min-w-0 flex-1 flex-col">
				<span className="truncate leading-5">
					{event.title || "（タイトルなし）"}
				</span>
				{event.location && (
					<span className="truncate text-muted-foreground text-xs leading-5">
						{event.location}
					</span>
				)}
			</span>
		</>
	);
	const rowClass =
		"flex min-h-[var(--m-list-row)] items-start gap-2.5 rounded-md px-2 py-2.5 text-[length:var(--m-text-body)] text-foreground no-underline desk:min-h-0 desk:py-1.5 desk:text-sm";
	if (!event.htmlLink) {
		return <div className={rowClass}>{content}</div>;
	}
	return (
		<a
			className={cn(
				rowClass,
				"hover:layer-accent active:layer-accent-pressed outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--ring)]"
			)}
			href={event.htmlLink}
			rel="noopener"
			target="_blank"
		>
			{content}
		</a>
	);
}
