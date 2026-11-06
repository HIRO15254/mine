import type { Project, Task, TaskGroup } from "@/lib/tasks";

import { TaskRow } from "./task-row";
import { completeInput, useCompleteTask } from "./use-tasks";

export function TaskList({
	groups,
	onOpen,
	projects,
	showProject = true,
	today,
}: {
	groups: TaskGroup[];
	onOpen: (task: Task) => void;
	projects: Project[];
	showProject?: boolean;
	today: string;
}) {
	const complete = useCompleteTask();
	return (
		<div className="flex flex-col gap-4">
			{groups.map((group) => (
				<section
					aria-label={group.title || undefined}
					className="flex flex-col"
					key={group.key}
				>
					{group.title && (
						<h2 className="m-0 flex items-baseline gap-2 border-border border-b px-2 pb-1.5 font-semibold text-sm">
							{group.title}
							<span className="font-normal text-muted-foreground text-xs">
								{group.tasks.length}
							</span>
						</h2>
					)}
					<ul className="m-0 flex list-none flex-col divide-y divide-border p-0">
						{group.tasks.map((task) => (
							<li key={task.id}>
								<TaskRow
									isCompleting={
										complete.isPending && complete.variables?.id === task.id
									}
									onComplete={(item) => complete.mutate(completeInput(item.id))}
									onOpen={onOpen}
									projects={projects}
									showProject={showProject}
									task={task}
									today={today}
								/>
							</li>
						))}
					</ul>
				</section>
			))}
		</div>
	);
}
