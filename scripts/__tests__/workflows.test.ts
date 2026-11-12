import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");

function readWorkflow(name: string): Promise<string> {
	return readFile(path.join(root, ".github/workflows", name), "utf8");
}

describe("production deploy workflow", () => {
	it("checks and builds everything before it deploys anything", async () => {
		const workflow = await readWorkflow("production-deploy.yml");
		expect(workflow).toContain("run: bun run verify");
		expect(workflow.indexOf("run: bun run verify")).toBeLessThan(
			workflow.indexOf("bun run db:migrate:remote")
		);
		expect(workflow).toContain("if: github.ref == 'refs/heads/master'");
	});

	it("gives the Cloudflare token only to the steps that deploy", async () => {
		const workflow = await readWorkflow("production-deploy.yml");
		const beforeJobs = workflow.slice(0, workflow.indexOf("\njobs:"));
		expect(beforeJobs).not.toContain("CLOUDFLARE_API_TOKEN");
		expect(beforeJobs).toContain("contents: read");
		const ci = workflow.slice(
			workflow.indexOf("\n  ci:"),
			workflow.indexOf("\n  db-migrate:")
		);
		expect(ci).not.toContain("CLOUDFLARE_API_TOKEN");
	});
});
