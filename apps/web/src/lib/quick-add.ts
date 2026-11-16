/**
 * Suggestions for the task quick add: "#" offers projects and "@" labels,
 * the same way the timer offers projects after "#".
 */
import type { CaretToken } from "./caret-token";
import type { Label, Project } from "./tasks";

/** The symbols that open the suggestions. */
export const QUICK_ADD_TRIGGERS = ["#", "@"] as const;

export type QuickAddSuggestion =
	| { insert: string; key: string; kind: "project"; project: Project }
	| { insert: string; key: string; kind: "label"; label: Label };

const MAX_SUGGESTIONS = 7;
const AT = /^@/;

const lower = (value: string) => value.toLocaleLowerCase("ja");

/** How a label is typed: "@next", or its own name when that starts with @. */
export function labelToken(label: Label): string {
	return label.name.startsWith("@") ? label.name : `@${label.name}`;
}

/** The items whose name contains the query, those that start with it first. */
function matching<T>(items: T[], name: (item: T) => string, query: string) {
	const wanted = lower(query);
	const starts = (item: T) => lower(name(item)).startsWith(wanted);
	return items
		.filter((item) => lower(name(item)).includes(wanted))
		.sort((a, b) => Number(!starts(a)) - Number(!starts(b)))
		.slice(0, MAX_SUGGESTIONS);
}

/** The projects or labels to offer for the "#word" or "@word" being typed. */
export function suggestQuickAdd({
	labels,
	projects,
	token,
}: {
	labels: Label[];
	projects: Project[];
	token: CaretToken | null;
}): QuickAddSuggestion[] {
	if (token?.trigger === "#") {
		const open = projects.filter((item) => !item.archived);
		return matching(open, (item) => item.name, token.query).map((item) => ({
			insert: `#${item.name}`,
			key: `project:${item.id}`,
			kind: "project",
			project: item,
		}));
	}
	if (token?.trigger === "@") {
		// "@@外出" and "@外出" both name the label "@外出".
		const query = token.query.replace(AT, "");
		const name = (item: Label) => item.name.replace(AT, "");
		return matching(labels, name, query).map((item) => ({
			insert: labelToken(item),
			key: `label:${item.id}`,
			kind: "label",
			label: item,
		}));
	}
	return [];
}
