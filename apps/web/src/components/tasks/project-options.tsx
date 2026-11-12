import { flattenProjects, type Project } from "@/lib/tasks";

/**
 * The `<option>`s of a project picker, in tree order and indented by depth.
 * `include` leaves projects out; `openOr(id)` is the usual rule for editors.
 */
export function ProjectOptions({
	include = () => true,
	projects,
}: {
	include?: (project: Project) => boolean;
	projects: Project[];
}) {
	return flattenProjects(projects)
		.filter(include)
		.map((project) => (
			<option key={project.id} value={project.id}>
				{"　".repeat(project.depth)}
				{project.name}
			</option>
		));
}

/** Open projects, plus the one already chosen even if it was archived since. */
export const openOr =
	(currentId: string | null | undefined) => (project: Project) =>
		!project.archived || project.id === currentId;
