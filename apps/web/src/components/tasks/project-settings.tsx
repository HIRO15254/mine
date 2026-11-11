import { IconChevronRight, IconPlus } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useId, useState } from "react";

import { FormSheet } from "@/components/form-sheet/form-sheet";
import { ProjectRates } from "@/components/time/project-rates";
import { Button } from "@/components/ui/button/button";
import { Field, FieldError } from "@/components/ui/field/field";
import { Input } from "@/components/ui/input/input";
import { NativeSelect } from "@/components/ui/native-select/native-select";
import { Switch } from "@/components/ui/switch/switch";
import {
	ToggleGroup,
	ToggleGroupItem,
} from "@/components/ui/toggle-group/toggle-group";
import { useIsDesk } from "@/hooks/use-media-query";
import {
	flattenProjects,
	PROJECT_COLOR_CLASS,
	PROJECT_COLOR_LABEL,
	PROJECT_COLORS,
	type Project,
	type ProjectColor,
} from "@/lib/tasks";
import { cn } from "@/lib/utils";
import { isConflict, trpc } from "@/utils/trpc";

import { ConfirmDeleteButton } from "./confirm-delete-button";
import { useInvalidateTasks, useTaskContext } from "./use-tasks";

/** IDs of the project and its subprojects, which cannot become its parent. */
function selfAndDescendants(projects: Project[], id: string): Set<string> {
	const ids = new Set([id]);
	for (const item of flattenProjects(projects)) {
		if (item.parentId && ids.has(item.parentId)) {
			ids.add(item.id);
		}
	}
	return ids;
}

export function ProjectSettings() {
	const { isPending, projects } = useTaskContext();
	const [editor, setEditor] = useState<{
		key: number;
		open: boolean;
		project: Project | null;
	}>({ key: 0, open: false, project: null });
	const open = (project: Project | null) =>
		setEditor((current) => ({ key: current.key + 1, open: true, project }));

	return (
		<div className="flex flex-col gap-2">
			{!isPending && projects.length === 0 && (
				<p className="m-0 text-muted-foreground text-sm">
					プロジェクトはまだありません
				</p>
			)}
			{projects.length > 0 && (
				<ul className="m-0 flex list-none flex-col divide-y divide-border rounded-lg border border-border bg-card p-0">
					{flattenProjects(projects).map((project) => (
						<li key={project.id}>
							<button
								className="flex min-h-[var(--m-list-row)] w-full cursor-pointer items-center gap-2.5 border-0 bg-transparent py-2 pr-3 text-left text-foreground text-sm outline-none hover:bg-accent focus-visible:shadow-[inset_0_0_0_2px_var(--ring)]"
								onClick={() => open(project)}
								style={{ paddingLeft: `${12 + project.depth * 20}px` }}
								type="button"
							>
								<span
									aria-hidden
									className={cn(
										"size-2.5 shrink-0 rounded-full",
										PROJECT_COLOR_CLASS[project.color]
									)}
								/>
								<span
									className={cn(
										"min-w-0 flex-1 truncate",
										project.archived && "text-muted-foreground line-through"
									)}
								>
									{project.name}
								</span>
								<IconChevronRight
									aria-hidden
									className="size-4 text-muted-foreground"
								/>
							</button>
						</li>
					))}
				</ul>
			)}
			<Button
				className="self-start"
				onClick={() => open(null)}
				type="button"
				variant="secondary"
			>
				<IconPlus aria-hidden />
				プロジェクトを追加
			</Button>
			<ProjectEditor
				key={editor.key}
				onOpenChange={(value) =>
					setEditor((current) => ({ ...current, open: value }))
				}
				open={editor.open}
				project={editor.project}
				projects={projects}
			/>
		</div>
	);
}

function ProjectEditor({
	onOpenChange,
	open,
	project,
	projects,
}: {
	onOpenChange: (open: boolean) => void;
	open: boolean;
	project: Project | null;
	projects: Project[];
}) {
	const formId = useId();
	const size = useIsDesk() ? "default" : "xl";
	const invalidate = useInvalidateTasks();
	const [name, setName] = useState(project?.name ?? "");
	const [parentId, setParentId] = useState(project?.parentId ?? "");
	const [color, setColor] = useState<ProjectColor>(project?.color ?? "chart-1");
	const [archived, setArchived] = useState(project?.archived ?? false);
	const [error, setError] = useState<string | null>(null);

	const close = () => onOpenChange(false);
	const options = {
		onSettled: invalidate,
		onSuccess: close,
		onError: () => setError("保存できませんでした"),
	};
	const create = useMutation(trpc.project.create.mutationOptions(options));
	const update = useMutation(trpc.project.update.mutationOptions(options));
	const remove = useMutation(
		trpc.project.delete.mutationOptions({
			...options,
			onError: (cause) =>
				setError(
					isConflict(cause)
						? "記録があるので削除できません。アーカイブしてください"
						: "削除できませんでした"
				),
		})
	);

	const blocked = project
		? selfAndDescendants(projects, project.id)
		: new Set<string>();

	const submit = (event: FormEvent) => {
		event.preventDefault();
		if (!name.trim()) {
			setError("名前を入力してください");
			return;
		}
		const input = { color, name: name.trim(), parentId: parentId || null };
		if (project) {
			update.mutate({ ...input, archived, id: project.id });
		} else {
			create.mutate(input);
		}
	};

	return (
		<FormSheet
			extraActions={
				project && (
					<ConfirmDeleteButton
						disabled={remove.isPending}
						onConfirm={() => remove.mutate({ id: project.id })}
					/>
				)
			}
			formId={formId}
			isSaving={create.isPending || update.isPending}
			onOpenChange={onOpenChange}
			open={open}
			title={project ? "プロジェクトを編集" : "プロジェクトを追加"}
		>
			<form className="flex flex-col gap-4" id={formId} onSubmit={submit}>
				<Field htmlFor={`${formId}-name`} label="名前" required>
					<Input
						autoComplete="off"
						id={`${formId}-name`}
						onChange={(event) => setName(event.target.value)}
						size={size}
						value={name}
					/>
				</Field>
				<Field htmlFor={`${formId}-parent`} label="親プロジェクト">
					<NativeSelect
						id={`${formId}-parent`}
						onChange={(event) => setParentId(event.target.value)}
						size={size}
						value={parentId}
					>
						<option value="">なし</option>
						{flattenProjects(projects)
							.filter((item) => !blocked.has(item.id))
							.map((item) => (
								<option key={item.id} value={item.id}>
									{"　".repeat(item.depth)}
									{item.name}
								</option>
							))}
					</NativeSelect>
				</Field>
				<fieldset className="m-0 flex flex-col border-0 p-0">
					<legend className="mb-1.5 p-0 font-medium text-sm">色</legend>
					<ToggleGroup
						aria-label="色"
						onValueChange={(value) => {
							if (value) {
								setColor(value as ProjectColor);
							}
						}}
						type="single"
						value={color}
					>
						{PROJECT_COLORS.map((item) => (
							<ToggleGroupItem className="px-0" key={item} value={item}>
								<span
									aria-hidden
									className={cn(
										"size-2.5 rounded-full",
										PROJECT_COLOR_CLASS[item]
									)}
								/>
								{PROJECT_COLOR_LABEL[item]}
							</ToggleGroupItem>
						))}
					</ToggleGroup>
				</fieldset>
				{project && (
					<div className="flex items-center justify-between gap-3">
						<label className="text-sm" htmlFor={`${formId}-archived`}>
							アーカイブする
						</label>
						<Switch
							checked={archived}
							id={`${formId}-archived`}
							onCheckedChange={setArchived}
						/>
					</div>
				)}
				{project && (
					<p className="m-0 text-muted-foreground text-xs">
						削除するとサブプロジェクトも消え、タスクはインボックスに移ります。記録があるプロジェクトは削除できません。
					</p>
				)}
				{error && <FieldError>{error}</FieldError>}
			</form>
			{project && (
				<ProjectRates hasParent={Boolean(parentId)} projectId={project.id} />
			)}
		</FormSheet>
	);
}
