import {
	IconAlertTriangle,
	IconChecklist,
	IconCircleCheck,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";

import { Page } from "@/components/app-shell/page";
import { QuickAdd } from "@/components/tasks/quick-add";
import type { DraftDefaults } from "@/components/tasks/task-draft";
import { useTaskEditor } from "@/components/tasks/task-editor";
import { TaskList } from "@/components/tasks/task-list";
import { useTaskContext } from "@/components/tasks/use-tasks";
import { Button } from "@/components/ui/button/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty/empty";
import { NativeSelect } from "@/components/ui/native-select/native-select";
import { Spinner } from "@/components/ui/spinner/spinner";
import {
	ToggleGroup,
	ToggleGroupItem,
} from "@/components/ui/toggle-group/toggle-group";
import { useIsDesk } from "@/hooks/use-media-query";
import { quickAddText } from "@/lib/share";
import {
	flattenProjects,
	groupTasks,
	TASK_VIEW_OPTIONS,
	type TaskView,
	todayKey,
} from "@/lib/tasks";
import { trpc } from "@/utils/trpc";

interface TasksSearch {
	/** Text to start the quick-add box with, from a shortcut or a share. */
	add?: string;
	project?: string;
	view?: TaskView;
}

const VIEWS = new Set<string>(TASK_VIEW_OPTIONS.map((option) => option.value));

export const Route = createFileRoute("/_app/tasks")({
	validateSearch: (search: Record<string, unknown>): TasksSearch => {
		const add = quickAddText(search);
		return {
			...(add === undefined ? {} : { add }),
			...(typeof search.view === "string" && VIEWS.has(search.view)
				? { view: search.view as TaskView }
				: {}),
			...(typeof search.project === "string" && search.project
				? { project: search.project }
				: {}),
		};
	},
	component: TasksPage,
});

const EMPTY_MESSAGE: Record<TaskView, string> = {
	today: "今日やることはありません",
	upcoming: "2週間以内の予定はありません",
	inbox: "インボックスは空です",
	open: "未完了のタスクはありません",
};

/** The project and everything nested under it. */
function descendantIds(
	projects: Array<{ id: string; parentId: string | null }>,
	rootId: string
): Set<string> {
	const ids = new Set([rootId]);
	let grew = true;
	while (grew) {
		grew = false;
		for (const project of projects) {
			if (
				project.parentId &&
				ids.has(project.parentId) &&
				!ids.has(project.id)
			) {
				ids.add(project.id);
				grew = true;
			}
		}
	}
	return ids;
}

function TasksPage() {
	const search = Route.useSearch();
	const view = search.view ?? "today";
	const navigate = useNavigate({ from: Route.fullPath });
	const isDesk = useIsDesk();
	const today = todayKey();
	const { labels, projects } = useTaskContext();
	const { editor, openEdit, openNew } = useTaskEditor({ labels, projects });
	const tasks = useQuery(trpc.task.list.queryOptions({ today, view }));

	const projectFilter =
		view === "open" && search.project ? search.project : undefined;
	const defaults = useMemo<DraftDefaults>(() => {
		if (projectFilter) {
			return { projectId: projectFilter };
		}
		return view === "today" ? { scheduledDate: today } : {};
	}, [projectFilter, today, view]);

	const groups = useMemo(() => {
		let items = tasks.data ?? [];
		if (projectFilter) {
			const ids = descendantIds(projects, projectFilter);
			items = items.filter((task) => task.projectId && ids.has(task.projectId));
		}
		return groupTasks(items, view, { projects, today });
	}, [projectFilter, projects, tasks.data, today, view]);

	return (
		<Page title="タスク">
			<div className="mx-auto flex w-full max-w-[720px] flex-col gap-3.5">
				<ToggleGroup
					aria-label="表示"
					onValueChange={(value) => {
						if (value) {
							navigate({
								search: value === "today" ? {} : { view: value as TaskView },
							});
						}
					}}
					type="single"
					value={view}
				>
					{TASK_VIEW_OPTIONS.map((option) => (
						<ToggleGroupItem
							className="px-1"
							key={option.value}
							value={option.value}
						>
							{option.label}
						</ToggleGroupItem>
					))}
				</ToggleGroup>
				{view === "open" && projects.length > 0 && (
					<NativeSelect
						aria-label="プロジェクト"
						onChange={(event) =>
							navigate({
								search: {
									view: "open",
									...(event.target.value
										? { project: event.target.value }
										: {}),
								},
							})
						}
						size={isDesk ? "default" : "xl"}
						value={projectFilter ?? ""}
					>
						<option value="">すべてのプロジェクト</option>
						{flattenProjects(projects).map((project) => (
							<option key={project.id} value={project.id}>
								{"　".repeat(project.depth)}
								{project.name}
							</option>
						))}
					</NativeSelect>
				)}
				<QuickAdd
					autoFocus={search.add !== undefined}
					defaults={defaults}
					initialText={search.add}
					key={search.add ?? ""}
					labels={labels}
					onAdded={() => {
						if (search.add !== undefined) {
							navigate({
								replace: true,
								search: ({ add: _add, ...rest }) => rest,
							});
						}
					}}
					onOpenEditor={() => openNew(defaults)}
					projects={projects}
				/>
				{tasks.isPending && (
					<div className="flex justify-center py-8 text-muted-foreground">
						<Spinner />
					</div>
				)}
				{tasks.isError && (
					<Empty className="py-8">
						<EmptyHeader>
							<EmptyMedia>
								<IconAlertTriangle aria-hidden />
							</EmptyMedia>
							<EmptyTitle>タスクを読み込めませんでした</EmptyTitle>
						</EmptyHeader>
						<EmptyContent>
							<Button
								onClick={() => tasks.refetch()}
								type="button"
								variant="secondary"
							>
								再読み込み
							</Button>
						</EmptyContent>
					</Empty>
				)}
				{tasks.isSuccess && groups.length === 0 && (
					<Empty className="py-10">
						<EmptyHeader>
							<EmptyMedia>
								{view === "today" ? (
									<IconCircleCheck aria-hidden />
								) : (
									<IconChecklist aria-hidden />
								)}
							</EmptyMedia>
							<EmptyDescription>{EMPTY_MESSAGE[view]}</EmptyDescription>
						</EmptyHeader>
					</Empty>
				)}
				{tasks.isSuccess && groups.length > 0 && (
					<TaskList
						groups={groups}
						onOpen={openEdit}
						projects={projects}
						showProject={view !== "open"}
						today={today}
					/>
				)}
			</div>
			{editor}
		</Page>
	);
}
