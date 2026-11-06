/**
 * Compares the Cryst tokens the app ships (apps/web/src/index.css) with the
 * snapshot of the design system's tokens.css (design/cryst/tokens.css).
 *
 * A token both define must resolve to the same value in each theme, and every
 * color the design system defines must exist in the app. Scale tokens the app
 * leaves to Tailwind (spacing, weights, leading) are listed but not required.
 *
 *   bun run check:design-tokens
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

export type Theme = "dark" | "light";
export type Tokens = Map<string, string>;

/** Tokens the app sets differently on purpose (the fonts are self-hosted). */
export const IGNORED = new Set(["--font-sans", "--font-mono"]);

const BLOCK = /([^{}]+)\{([^{}]*)\}/g;
const DECLARATION = /(--[\w-]+)\s*:\s*([^;]+);/g;
const VAR = /var\((--[\w-]+)\)/g;

/** Custom properties declared in each rule, keyed by its selector. */
export function parseBlocks(
	css: string
): Array<{ selector: string; tokens: Tokens }> {
	const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
	const blocks: Array<{ selector: string; tokens: Tokens }> = [];
	for (const [, selector = "", body = ""] of withoutComments.matchAll(BLOCK)) {
		const tokens: Tokens = new Map();
		for (const [, name = "", value = ""] of body.matchAll(DECLARATION)) {
			tokens.set(name, value.trim());
		}
		// At-rules such as @import end with ";" and run into the next selector.
		blocks.push({ selector: selector.split(";").at(-1)?.trim() ?? "", tokens });
	}
	return blocks;
}

function merge(...maps: Tokens[]): Tokens {
	const merged: Tokens = new Map();
	for (const map of maps) {
		for (const [name, value] of map) {
			merged.set(name, value);
		}
	}
	return merged;
}

function collect(
	blocks: Array<{ selector: string; tokens: Tokens }>,
	match: (selector: string) => boolean
): Tokens {
	return merge(
		...blocks
			.filter((block) => match(block.selector))
			.map((block) => block.tokens)
	);
}

/** Writes a value one way: lower case, single spaces, numbers without padding zeros. */
export function normalize(value: string): string {
	return value
		.toLowerCase()
		.replace(/\s*([,()])\s*/g, "$1")
		.replace(/\s+/g, " ")
		.trim()
		.replace(/(?<![#\w.])\d*\.?\d+/g, (number) => String(Number(number)));
}

/** Replaces var() references with the values they point to. */
export function resolve(tokens: Tokens): Tokens {
	const resolved: Tokens = new Map();
	const lookup = (name: string, seen: Set<string>): string => {
		const value = tokens.get(name);
		if (value === undefined || seen.has(name)) {
			return `var(${name})`;
		}
		const next = new Set(seen).add(name);
		return value.replace(VAR, (_match, ref: string) => lookup(ref, next));
	};
	for (const name of tokens.keys()) {
		resolved.set(name, normalize(lookup(name, new Set())));
	}
	return resolved;
}

/** The design system's tokens.css: light on `:root, [data-theme="light"]`, dark on `[data-theme="dark"]`. */
export function designTokens(css: string): Record<Theme, Tokens> {
	const blocks = parseBlocks(css);
	const shared = collect(blocks, (selector) => selector === ":root");
	const light = collect(blocks, (selector) =>
		selector.includes('[data-theme="light"]')
	);
	const dark = collect(
		blocks,
		(selector) => selector === '[data-theme="dark"]'
	);
	return {
		dark: resolve(merge(shared, light, dark)),
		light: resolve(merge(shared, light)),
	};
}

/** The app's index.css: light and the scale on `:root`, dark on `.dark` (both on <html>). */
export function appTokens(css: string): Record<Theme, Tokens> {
	const blocks = parseBlocks(css);
	const root = collect(blocks, (selector) => selector === ":root");
	const dark = collect(blocks, (selector) => selector === ".dark");
	return { dark: resolve(merge(root, dark)), light: resolve(root) };
}

/** Whether the design system declares the token in a theme block (a color, shadow or overlay). */
function themed(css: string): Set<string> {
	const names = new Set<string>();
	for (const block of parseBlocks(css)) {
		if (block.selector.includes("data-theme")) {
			for (const name of block.tokens.keys()) {
				names.add(name);
			}
		}
	}
	return names;
}

export interface Drift {
	/** Scale tokens of the design system that the app does not declare. */
	absent: string[];
	/** Tokens whose values differ: `theme name: design → app`. */
	changed: string[];
	/** Theme tokens of the design system that the app does not declare. */
	missing: string[];
}

export function compareTokens(designCss: string, appCss: string): Drift {
	const design = designTokens(designCss);
	const app = appTokens(appCss);
	const colors = themed(designCss);
	const drift: Drift = { absent: [], changed: [], missing: [] };
	for (const theme of ["light", "dark"] as const) {
		for (const [name, value] of design[theme]) {
			const actual = app[theme].get(name);
			if (IGNORED.has(name) || actual === value) {
				continue;
			}
			if (actual !== undefined) {
				drift.changed.push(`${theme} ${name}: ${value} → ${actual}`);
			} else if (theme === "light") {
				(colors.has(name) ? drift.missing : drift.absent).push(name);
			}
		}
	}
	return drift;
}

export const DESIGN_TOKENS = "design/cryst/tokens.css";
export const APP_TOKENS = "apps/web/src/index.css";

export async function checkRepository(root: string): Promise<Drift> {
	const [designCss, appCss] = await Promise.all([
		readFile(path.join(root, DESIGN_TOKENS), "utf8"),
		readFile(path.join(root, APP_TOKENS), "utf8"),
	]);
	return compareTokens(designCss, appCss);
}

if (import.meta.main) {
	const drift = await checkRepository(path.resolve(import.meta.dirname, ".."));
	if (drift.absent.length > 0) {
		console.log(
			`Left to Tailwind (not declared in ${APP_TOKENS}):\n  ${drift.absent.join(", ")}\n`
		);
	}
	if (drift.missing.length + drift.changed.length === 0) {
		console.log(`${APP_TOKENS} matches ${DESIGN_TOKENS}.`);
	} else {
		for (const name of drift.missing) {
			console.error(`missing ${name}`);
		}
		for (const line of drift.changed) {
			console.error(`changed ${line}`);
		}
		console.error(`\nUpdate ${APP_TOKENS} to match ${DESIGN_TOKENS}.`);
		process.exitCode = 1;
	}
}
