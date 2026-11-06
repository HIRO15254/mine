/** Fields an Android share or a home-screen shortcut can put in the URL. */
export interface ShareInput {
	add?: unknown;
	text?: unknown;
	title?: unknown;
	url?: unknown;
}

const SPACES = /\s+/g;

function clean(value: unknown): string {
	if (typeof value === "number") {
		return String(value);
	}
	return typeof value === "string" ? value.replace(SPACES, " ").trim() : "";
}

/**
 * The text to put in the quick-add box, or undefined when the URL carries
 * nothing for it. Shared pages often repeat the title in the text and the
 * link in both, so each part appears once.
 */
export function quickAddText(input: ShareInput): string | undefined {
	const shared = [clean(input.title), clean(input.text), clean(input.url)];
	let parts: string[] = [];
	for (const part of shared) {
		if (part && !parts.some((kept) => kept.includes(part))) {
			parts = [...parts.filter((kept) => !part.includes(kept)), part];
		}
	}
	if (parts.length > 0) {
		return parts.join(" ");
	}
	if (input.add === undefined || input.add === null) {
		return;
	}
	return clean(input.add);
}
