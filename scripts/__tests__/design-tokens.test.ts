import path from "node:path";
import { describe, expect, it } from "vitest";

import { checkRepository, compareTokens, normalize } from "../design-tokens";

const design = `
/* Cryst */
:root, [data-theme="light"] {
  --background: #fcfcfd;
  --primary: #1961d2;
  --muted: rgba(40,42,48,0.05);
  --shadow-popover: 0 0 0 1px #e4e5e9,0 8px 24px rgba(0,0,0,0.18);
}
[data-theme="dark"] {
  --background: #08090a;
  --primary: #4593f8;
  --muted: rgba(247,248,248,0.06);
  --shadow-popover: 0 0 0 1px #26282d,0 12px 32px rgba(0,0,0,0.55);
}
:root {
  --space-1: 4px;
  --radius: 8px;
  --font-sans: 'Noto Sans JP',sans-serif;
}
`;

const app = `
@import "tailwindcss";
@custom-variant dark (&:is(.dark *));

:root {
	--background: #fcfcfd;
	--primary: #1961d2;
	--muted: rgba(40, 42, 48, 0.050);
	--border: #e4e5e9;
	--shadow-popover: 0 0 0 1px var(--border), 0 8px 24px rgba(0, 0, 0, 0.18);
	--radius: 8px;
	--font-sans: "Noto Sans JP Variable", sans-serif;
}

.dark {
	--background: #08090a;
	--primary: #4593f8;
	--muted: rgba(247, 248, 248, 0.06);
	--border: #26282d;
	--shadow-popover: 0 0 0 1px var(--border), 0 12px 32px rgba(0, 0, 0, 0.55);
}
`;

describe("design token check", () => {
	it("treats spacing and padded numbers as the same value", () => {
		expect(normalize("rgba(40, 42, 48, 0.050)")).toBe(
			normalize("rgba(40,42,48,0.05)")
		);
		expect(normalize("0 1px  2px")).toBe("0 1px 2px");
		expect(normalize("#007C4C")).toBe("#007c4c");
	});

	it("accepts an app that matches after resolving var() in each theme", () => {
		expect(compareTokens(design, app)).toEqual({
			absent: ["--space-1"],
			changed: [],
			missing: [],
		});
	});

	it("reports a changed color in the theme it changed in", () => {
		const drifted = app.replace("--primary: #4593f8;", "--primary: #5ea1f9;");
		expect(compareTokens(design, drifted).changed).toEqual([
			"dark --primary: #4593f8 → #5ea1f9",
		]);
	});

	it("reports a color the app does not declare", () => {
		const added = design.replace(
			"--primary: #1961d2;",
			"--primary: #1961d2;\n  --info-soft: rgba(25,97,210,0.12);"
		);
		expect(compareTokens(added, app).missing).toEqual(["--info-soft"]);
	});

	it("keeps the app in step with the Cryst snapshot", async () => {
		const drift = await checkRepository(
			path.resolve(import.meta.dirname, "../..")
		);
		expect(drift.missing).toEqual([]);
		expect(drift.changed).toEqual([]);
	});
});
