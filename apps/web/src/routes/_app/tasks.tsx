import { descendants } from "@mine/api/projects/tree";
import {
	IconAlertTriangle,
	IconChecklist,
	IconCircleCheck,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { LoadingBlock } from "@/components/app-shell/loading-block";

import { Page } from "@/components/app-shell/page";
import { ProjectOptions } from "@/components/tasks/project-options";
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
import {
	ToggleGroup,
	ToggleGroupItem,
} from "@/components/ui/toggle-group/toggle-group";
import { useControlSize } from "@/hooks/use-media-query";
import { useToday } from "@/hooks/use-today";
import { quickAddText } from "@/lib/share";
import { groupTasks, TASK_VIEW_OPTIONS, type TaskView } from "@/lib/tasks";
import { trpc } from "@/lib/trpc";

interface TasksSearch {
	/** Text to start the quick-add box with, from a shortcut or a share. */
	add?: string;
	project?: string;
	view?: TaskView;
}

const VIEWS = new Set<string>(TASK_VIEW_OPTIONS.map((option) => option.value));
/** The view an address without one opens on. */
const DEFAULT_VIEW: TaskView = "upcoming";

export const Route = createFileRoute("/_app/tasks")({
	// Every key is answered, even with undefined: the router lays the result
	// over the raw search, so a key left out would keep its unchecked value.
	validateSearch: (search: Record<string, unknown>): TasksSearch => ({
		add: quickAddText(search),
		project:
			typeof search.project === "string" && search.project
				? search.project
				: undefined,
		view:
			typeof search.view === "string" && VIEWS.has(search.view)
				? (search.view as TaskView)
				: undefined,
	}),
	component: TasksPage,
});

const EMPTY_MESSAGE: Record<TaskView, string> = {
	today: "今日やることはありません",
	upcoming: "2週間以内の予定はありません",
	inbox: "インボックスは空です",
	open: "未完了のタスクはありません",
};

function TasksPage() {
	const search = Route.useSearch();
	const view = search.view ?? DEFAULT_VIEW;
	const navigate = useNavigate({ from: Route.fullPath });
	const size = useControlSize();
	const today = useToday();
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
			const ids = descendants(projects, projectFilter);
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
								search:
									value === DEFAULT_VIEW ? {} : { view: value as TaskView },
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
						size={size}
						value={projectFilter ?? ""}
					>
						<option value="">すべてのプロジェクト</option>
						<ProjectOptions projects={projects} />
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
				{tasks.isPending && <LoadingBlock />}
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
