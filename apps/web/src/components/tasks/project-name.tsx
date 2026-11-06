import type { CSSProperties } from "react";

import { type Project, projectPath } from "@/lib/tasks";
import { cn } from "@/lib/utils";

/** A project's name after a dot in its prism hue. */
export function ProjectName({
	className,
	project,
	projects,
}: {
	className?: string;
	project: Project;
	projects: Project[];
}) {
	return (
		<span
			className={cn("inline-flex min-w-0 items-center gap-1", className)}
			style={{ "--c": `var(--${project.color})` } as CSSProperties}
		>
			<span
				aria-hidden
				className="size-2 shrink-0 rounded-full bg-[var(--c)]"
			/>
			<span className="truncate">{projectPath(projects, project.id)}</span>
		</span>
	);
}
