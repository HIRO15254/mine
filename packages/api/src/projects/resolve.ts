import { TRPCError } from "@trpc/server";

import { type ProjectNode, projectPath } from "./tree";

type NamedProject = ProjectNode & { archived: boolean };

const normalize = (value: string) =>
	value
		.toLowerCase()
		.replaceAll(/\s*\/\s*/g, "/")
		.trim();

/** Open projects the query names: by full path, otherwise by name alone. */
function matchProjects<T extends NamedProject>(
	projects: readonly T[],
	query: string
): T[] {
	const wanted = normalize(query);
	const open = projects.filter((item) => !item.archived);
	const byPath = open.filter(
		(item) => normalize(projectPath(projects, item.id) ?? "") === wanted
	);
	return byPath.length > 0
		? byPath
		: open.filter((item) => normalize(item.name) === wanted);
}

/**
 * The one open project a person named, for the surfaces that take names
 * instead of ids (`/v1` and MCP). An unknown name lists the projects there
 * are, and a name shared by several lists those, so the caller can retry
 * with a full path instead of landing on whichever came first.
 */
export function resolveProject<T extends NamedProject>(
	projects: readonly T[],
	query: string
): T {
	const matches = matchProjects(projects, query);
	const [match] = matches;
	if (match && matches.length === 1) {
		return match;
	}
	const paths = (list: readonly T[]) =>
		list.map((item) => projectPath(projects, item.id)).join(", ");
	const open = projects.filter((item) => !item.archived);
	throw new TRPCError({
		code: "BAD_REQUEST",
		message: match
			? `"${query}" matches several projects: ${paths(matches)}. Use the full path.`
			: `Unknown project "${query}". Projects: ${paths(open) || "(none)"}`,
	});
}
