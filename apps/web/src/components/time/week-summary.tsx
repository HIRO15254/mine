import { addDays, dayKey, formatDayLabel } from "@/lib/calendar-time";
import { PROJECT_COLOR_CLASS, type Project, projectPath } from "@/lib/tasks";
import {
	formatDuration,
	formatHours,
	formatYen,
	type TimeSummary,
} from "@/lib/time";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["月", "火", "水", "木", "金", "土", "日"];

/**
 * Week totals: a headline, one column per day (single series), and one bar
 * per project. Every bar carries its own text label, so color is never the
 * only cue.
 */
export function WeekSummary({
	projects,
	summary,
	weekStart,
}: {
	projects: Project[];
	summary: TimeSummary;
	weekStart: Date;
}) {
	const byDay = new Map(summary.days.map((day) => [day.day, day.durationMs]));
	const days = WEEKDAYS.map((label, index) => {
		const date = addDays(weekStart, index);
		return {
			date,
			label,
			ms: byDay.get(dayKey(date)) ?? 0,
		};
	});
	const maxDay = Math.max(...days.map((day) => day.ms), 1);
	const maxProject = Math.max(...summary.projects.map((p) => p.durationMs), 1);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-baseline gap-3">
				<span className="font-semibold text-2xl tabular-nums">
					{formatDuration(summary.durationMs)}
				</span>
				{summary.amount > 0 && (
					<span className="text-muted-foreground text-sm tabular-nums">
						{formatYen(summary.amount)}
					</span>
				)}
			</div>
			<ol
				aria-label="日ごとの時間"
				className="m-0 grid h-28 list-none grid-cols-7 items-end gap-0.5 border-border border-b p-0"
			>
				{days.map((day) => {
					const label = `${formatDayLabel(day.date)} ${formatDuration(day.ms)}`;
					return (
						<li
							aria-label={label}
							className="group/day flex h-full flex-col items-center justify-end gap-1"
							key={day.label}
							title={label}
						>
							<span className="text-[10px] text-muted-foreground tabular-nums opacity-0 transition-opacity group-hover/day:opacity-100">
								{day.ms > 0 ? formatHours(day.ms) : ""}
							</span>
							<span
								className="w-full max-w-7 rounded-t-[4px] bg-chart-1 transition-opacity group-hover/day:opacity-80"
								style={{
									height:
										day.ms > 0 ? `${Math.max(4, (day.ms / maxDay) * 80)}px` : 0,
								}}
							/>
						</li>
					);
				})}
			</ol>
			<div aria-hidden className="-mt-3 grid grid-cols-7 gap-0.5 text-center">
				{days.map((day) => (
					<span className="text-muted-foreground text-xs" key={day.label}>
						{day.label}
					</span>
				))}
			</div>
			{summary.projects.length > 0 && (
				<ul className="m-0 flex list-none flex-col gap-2.5 p-0">
					{summary.projects.map((total) => {
						const project = projects.find((p) => p.id === total.projectId);
						const name = project
							? projectPath(projects, project.id)
							: "プロジェクトなし";
						return (
							<li
								className="flex flex-col gap-1"
								key={total.projectId ?? "none"}
							>
								<span className="flex items-baseline gap-2 text-sm">
									<span className="min-w-0 flex-1 truncate">{name}</span>
									{total.amount !== null && total.amount > 0 && (
										<span className="text-muted-foreground text-xs tabular-nums">
											{formatYen(total.amount)}
										</span>
									)}
									<span className="tabular-nums">
										{formatDuration(total.durationMs)}
									</span>
								</span>
								<span
									aria-hidden
									className="h-1.5 overflow-hidden rounded-full bg-muted"
								>
									<span
										className={cn(
											"block h-full rounded-full",
											project
												? PROJECT_COLOR_CLASS[project.color]
												: "bg-muted-foreground/50"
										)}
										style={{
											width: `${(total.durationMs / maxProject) * 100}%`,
										}}
									/>
								</span>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}
