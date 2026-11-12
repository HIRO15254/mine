import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
 * The package boundaries from AGENTS.md, as a test. Imports are read from the
 * source text, which is enough for the two things checked here: which
 * workspace a file reaches into, and what the browser bundle pulls in.
 */

const root = path.resolve(import.meta.dirname, "../..");

/** Workspaces and the workspaces each may import. */
const ALLOWED: Record<string, string[]> = {
	"apps/server": ["api", "auth", "db"],
	"apps/web": ["api", "env"],
	"packages/api": ["db"],
	"packages/auth": ["db"],
	"packages/db": [],
	"packages/env": [],
};

/** What must never end up in the browser, however it is reached. */
const SERVER_ONLY = ["@mine/db", "@mine/auth", "drizzle-orm", "@trpc/server"];

const IMPORT =
	/(?:^|\n)\s*(?:import|export)\s+(type\s+)?(?:[^"';]*?\sfrom\s+)?["']([^"']+)["']/g;
const SOURCE = /\.tsx?$/;
const TEST_FILE = /\.test\.tsx?$/;
const TEST_SUPPORT = /(^|\/)(__tests__|screens)\/|(^|\/)testing\.ts$/;

interface Import {
	specifier: string;
	typeOnly: boolean;
}

function sourceFiles(directory: string): string[] {
	return readdirSync(directory).flatMap((name) => {
		const file = path.join(directory, name);
		if (name === "node_modules" || name === "dist") {
			return [];
		}
		if (statSync(file).isDirectory()) {
			return sourceFiles(file);
		}
		return SOURCE.test(name) ? [file] : [];
	});
}

function importsOf(file: string): Import[] {
	const text = readFileSync(file, "utf8");
	return [...text.matchAll(IMPORT)].map((match) => ({
		specifier: match[2] ?? "",
		// `import { type A }` still loads the module; only `import type` does not.
		typeOnly: match[1] !== undefined,
	}));
}

/** The file a specifier names, when it is inside this repository. */
function resolve(from: string, specifier: string): string | null {
	let base: string;
	if (specifier.startsWith(".")) {
		base = path.resolve(path.dirname(from), specifier);
	} else if (specifier.startsWith("@/")) {
		base = path.join(root, "apps/web/src", specifier.slice(2));
	} else if (specifier.startsWith("@mine/")) {
		const [, name = "", ...rest] = specifier.split("/");
		base = path.join(root, "packages", name, "src", rest.join("/") || "index");
	} else {
		return null;
	}
	const candidates = [
		base,
		`${base}.ts`,
		`${base}.tsx`,
		path.join(base, "index.ts"),
	];
	return (
		candidates.find(
			(candidate) => existsSync(candidate) && statSync(candidate).isFile()
		) ?? null
	);
}

const relative = (file: string) =>
	path.relative(root, file).replaceAll("\\", "/");

describe("package boundaries", () => {
	it.each(
		Object.entries(ALLOWED)
	)("%s imports only the workspaces it may", (workspace, allowed) => {
		const own = workspace.split("/")[1];
		const crossings = sourceFiles(path.join(root, workspace)).flatMap((file) =>
			importsOf(file)
				.filter(({ specifier }) => specifier.startsWith("@mine/"))
				.map(({ specifier }) => specifier.split("/")[1] ?? "")
				.filter(
					(name) => name !== own && name !== "config" && !allowed.includes(name)
				)
				.map((name) => `${relative(file)} imports @mine/${name}`)
		);

		expect(crossings).toEqual([]);
	});

	it("keeps server code out of the browser bundle", () => {
		const entry = path.join(root, "apps/web/src/main.tsx");
		const seen = new Set<string>([entry]);
		const queue = [entry];
		const reached: string[] = [];

		// Routes are loaded by the generated tree, not by an import the scan sees.
		for (const file of sourceFiles(path.join(root, "apps/web/src/routes"))) {
			if (!seen.has(file)) {
				seen.add(file);
				queue.push(file);
			}
		}

		for (let file = queue.pop(); file; file = queue.pop()) {
			if (TEST_FILE.test(file) || TEST_SUPPORT.test(relative(file))) {
				continue;
			}
			for (const { specifier, typeOnly } of importsOf(file)) {
				if (typeOnly) {
					continue;
				}
				const banned = SERVER_ONLY.find(
					(name) => specifier === name || specifier.startsWith(`${name}/`)
				);
				if (banned) {
					reached.push(`${relative(file)} loads ${specifier}`);
					continue;
				}
				const target = resolve(file, specifier);
				if (target && !seen.has(target)) {
					seen.add(target);
					queue.push(target);
				}
			}
		}

		// The scan must have followed the app; a handful of files means it broke.
		expect(seen.size).toBeGreaterThan(80);
		expect(reached).toEqual([]);
	});
});
