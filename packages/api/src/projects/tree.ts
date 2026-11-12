/**
 * The project tree, as plain functions over the rows `project.list` returns.
 * No database and no tRPC here, so the web app can use them too.
 */
export interface ProjectNode {
	id: string;
	name: string;
	parentId: string | null;
}

/** Deeper chains than this are treated as a loop and cut. */
const MAX_DEPTH = 20;

/** "大学 / 研究": the project's name after its ancestors', or null. */
export function projectPath(
	projects: readonly ProjectNode[],
	id: string | null
): string | null {
	const byId = new Map(projects.map((item) => [item.id, item]));
	const names: string[] = [];
	let current = id ? byId.get(id) : undefined;
	for (let depth = 0; current && depth < MAX_DEPTH; depth += 1) {
		names.unshift(current.name);
		current = current.parentId ? byId.get(current.parentId) : undefined;
	}
	return names.length > 0 ? names.join(" / ") : null;
}

/** The ids of a project and everything under it. */
export function descendants(
	projects: readonly ProjectNode[],
	rootId: string
): Set<string> {
	const ids = new Set([rootId]);
	let grew = true;
	while (grew) {
		grew = false;
		for (const item of projects) {
			if (item.parentId && ids.has(item.parentId) && !ids.has(item.id)) {
				ids.add(item.id);
				grew = true;
			}
		}
	}
	return ids;
}

/** Parents before their children, keeping the given order among siblings. */
export function treeOrder<T extends { id: string; parentId: string | null }>(
	items: readonly T[]
): T[] {
	const ids = new Set(items.map((item) => item.id));
	const children = new Map<string | null, T[]>();
	for (const item of items) {
		const parent =
			item.parentId && ids.has(item.parentId) ? item.parentId : null;
		children.set(parent, [...(children.get(parent) ?? []), item]);
	}
	const ordered: T[] = [];
	const visit = (parent: string | null) => {
		for (const item of children.get(parent) ?? []) {
			ordered.push(item);
			visit(item.id);
		}
	};
	visit(null);
	return ordered;
}
