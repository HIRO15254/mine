/**
 * The "#word" or "@word" being typed in a one-line entry, and the text with
 * that word completed. The timer and quick add both offer suggestions this
 * way.
 */

const SPACE = /\s/;
const LEADING_SPACE = /^\s+/;

export interface CaretToken {
	/** Where the word ends, which can be past the caret. */
	end: number;
	/** What was typed between the trigger and the caret. */
	query: string;
	start: number;
	/** The symbol the word starts with. */
	trigger: string;
}

/**
 * The word the caret is in or right after, when it starts with one of
 * `triggers`; null anywhere else.
 */
export function tokenAtCaret(
	text: string,
	caret: number,
	triggers: readonly string[]
): CaretToken | null {
	let start = caret;
	while (start > 0 && !SPACE.test(text[start - 1] ?? "")) {
		start -= 1;
	}
	const trigger = text[start];
	if (trigger === undefined || !triggers.includes(trigger)) {
		return null;
	}
	let end = caret;
	while (end < text.length && !SPACE.test(text[end] ?? "")) {
		end += 1;
	}
	return { end, query: text.slice(start + 1, caret), start, trigger };
}

/**
 * Puts `inserted` and one space in place of the word, and returns the caret
 * after the space.
 */
export function replaceToken(
	text: string,
	token: { end: number; start: number },
	inserted: string
): { caret: number; text: string } {
	const word = `${inserted} `;
	const rest = text.slice(token.end).replace(LEADING_SPACE, "");
	return {
		caret: token.start + word.length,
		text: text.slice(0, token.start) + word + rest,
	};
}

/**
 * The suggestion highlighted after an arrow key. A list placed above the box
 * grows upward, so there the up arrow walks into it.
 */
export function moveActive(
	key: "ArrowDown" | "ArrowUp",
	current: number,
	count: number,
	placement: "bottom" | "top" = "bottom"
): number {
	const towardList = placement === "top" ? "ArrowUp" : "ArrowDown";
	const delta = key === towardList ? 1 : -1;
	if (current < 0) {
		return delta > 0 ? 0 : count - 1;
	}
	return (current + delta + count) % count;
}
