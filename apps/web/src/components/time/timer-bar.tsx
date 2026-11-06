import {
	IconPlayerPlayFilled,
	IconPlayerStopFilled,
} from "@tabler/icons-react";
import { type FormEvent, useId, useState } from "react";

import { Button } from "@/components/ui/button/button";
import { Input } from "@/components/ui/input/input";
import { NativeSelect } from "@/components/ui/native-select/native-select";
import { Spinner } from "@/components/ui/spinner/spinner";
import { useIsDesk } from "@/hooks/use-media-query";
import {
	flattenProjects,
	PROJECT_COLOR_CLASS,
	type Project,
	projectPath,
} from "@/lib/tasks";
import { formatElapsed, type TimeEntry } from "@/lib/time";
import { cn } from "@/lib/utils";

import {
	useNow,
	useRunningEntry,
	useStartTimer,
	useStopTimer,
} from "./use-time";

/** The running entry with a stop button, or a form to start one. */
export function TimerBar({
	onEdit,
	projects,
}: {
	onEdit?: (entry: TimeEntry) => void;
	projects: Project[];
}) {
	const running = useRunningEntry();
	if (running.isPending) {
		return (
			<div className="flex justify-center py-3 text-muted-foreground">
				<Spinner />
			</div>
		);
	}
	return running.data ? (
		<RunningTimer entry={running.data} onEdit={onEdit} projects={projects} />
	) : (
		<StartTimer projects={projects} />
	);
}

export function RunningTimer({
	entry,
	onEdit,
	projects,
}: {
	entry: TimeEntry;
	onEdit?: (entry: TimeEntry) => void;
	projects: Project[];
}) {
	const now = useNow();
	const stop = useStopTimer();
	const isDesk = useIsDesk();
	const project = projects.find((p) => p.id === entry.projectId);
	const details = (
		<>
			<span className="truncate font-medium desk:text-sm text-[length:var(--m-text-body)]">
				{entry.description || "説明なし"}
			</span>
			<span className="flex items-center gap-1.5 text-muted-foreground text-xs">
				{project ? (
					<>
						<span
							aria-hidden
							className={cn(
								"size-2 shrink-0 rounded-full",
								PROJECT_COLOR_CLASS[project.color]
							)}
						/>
						{projectPath(projects, project.id)}
					</>
				) : (
					"プロジェクトなし"
				)}
			</span>
		</>
	);
	return (
		<div className="flex items-center gap-3">
			{onEdit ? (
				<button
					className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5 border-0 bg-transparent p-0 text-left text-foreground outline-none focus-visible:shadow-[0_0_0_2px_var(--ring)]"
					onClick={() => onEdit(entry)}
					type="button"
				>
					{details}
				</button>
			) : (
				<div className="flex min-w-0 flex-1 flex-col gap-0.5">{details}</div>
			)}
			<span
				aria-live="off"
				className="font-mono desk:text-base text-lg tabular-nums"
			>
				{formatElapsed(now - entry.startedAt)}
			</span>
			<Button
				aria-label="計測を止める"
				className={isDesk ? undefined : "w-[var(--m-control)] px-0"}
				disabled={stop.isPending}
				onClick={() => stop.mutate()}
				size={isDesk ? "icon" : "xl"}
				title="計測を止める"
				type="button"
				variant="destructive"
			>
				<IconPlayerStopFilled aria-hidden />
			</Button>
		</div>
	);
}

function StartTimer({ projects }: { projects: Project[] }) {
	const id = useId();
	const isDesk = useIsDesk();
	const size = isDesk ? "default" : "xl";
	const [description, setDescription] = useState("");
	const [projectId, setProjectId] = useState("");
	const start = useStartTimer();

	const submit = (event: FormEvent) => {
		event.preventDefault();
		start.mutate(
			{ description: description.trim(), projectId: projectId || null },
			{
				onSuccess: () => {
					setDescription("");
				},
			}
		);
	};

	return (
		<form className="flex flex-wrap items-center gap-1.5" onSubmit={submit}>
			<label className="sr-only" htmlFor={`${id}-description`}>
				何をしていますか
			</label>
			<Input
				autoComplete="off"
				className="min-w-0 flex-[1_1_220px]"
				id={`${id}-description`}
				onChange={(event) => setDescription(event.target.value)}
				placeholder="何をしていますか"
				size={size}
				value={description}
			/>
			<div className="flex min-w-0 flex-[1_1_180px] items-center gap-1.5">
				<div className="min-w-0 flex-1">
					<NativeSelect
						aria-label="プロジェクト"
						onChange={(event) => setProjectId(event.target.value)}
						size={size}
						value={projectId}
					>
						<option value="">プロジェクトなし</option>
						{flattenProjects(projects)
							.filter((project) => !project.archived)
							.map((project) => (
								<option key={project.id} value={project.id}>
									{"　".repeat(project.depth)}
									{project.name}
								</option>
							))}
					</NativeSelect>
				</div>
				<Button
					aria-label="計測を始める"
					className={isDesk ? undefined : "w-[var(--m-control)] px-0"}
					disabled={start.isPending}
					size={isDesk ? "icon" : "xl"}
					title="計測を始める"
					type="submit"
				>
					<IconPlayerPlayFilled aria-hidden />
				</Button>
			</div>
		</form>
	);
}
