import { describe, expect, it } from "vitest";

import {
	type CleanupConfig,
	type ResourceResult,
	renderComment,
	runCleanup,
} from "../preview-cleanup";

const CLOUDFLARE = "https://api.cloudflare.com/client/v4/accounts/acc";
const GITHUB = "https://api.github.com";
const OPEN_PULLS = "GET github:/repos/o/r/pulls?state=open&per_page=100&page=1";
const RUN_URL = "https://github.com/o/r/actions/runs/1";

const config: CleanupConfig = {
	accountId: "acc",
	apiToken: "cf-token",
	d1Prefix: "db-pr-",
	githubToken: "gh-token",
	pagesProject: "web",
	prNumber: 12,
	repository: "o/r",
	workerPrefix: "api-pr-",
};

interface Reply {
	body?: unknown;
	status: number;
}

function ok(result: unknown = null): Reply {
	return { body: { errors: [], result, success: true }, status: 200 };
}

function fail(status: number, message: string): Reply {
	return {
		body: { errors: [{ code: 10_000, message }], success: false },
		status,
	};
}

function deployment(id: string, branch: string) {
	return { deployment_trigger: { metadata: { branch } }, id };
}

async function run(routes: Record<string, Reply[]>) {
	const calls: string[] = [];
	const sleeps: number[] = [];
	const unexpected: string[] = [];
	const results = await runCleanup(config, {
		fetch: (url, init) => {
			const key = `${init.method} ${url.replace(CLOUDFLARE, "").replace(GITHUB, "github:")}`;
			calls.push(key);
			const queue = routes[key];
			if (!queue) {
				unexpected.push(key);
				return Promise.resolve(new Response("{}", { status: 418 }));
			}
			const reply = (queue.length > 1 ? queue.shift() : queue[0]) as Reply;
			return Promise.resolve(
				new Response(JSON.stringify(reply.body ?? {}), {
					status: reply.status,
				})
			);
		},
		log: () => undefined,
		sleep: (ms) => {
			sleeps.push(ms);
			return Promise.resolve();
		},
	});
	expect(unexpected).toEqual([]);
	return {
		calls,
		comment: renderComment(results, {
			closedAt: "2026-11-26",
			runUrl: RUN_URL,
		}),
		failed: results.filter((result) => result.status === "failed"),
		results,
		sleeps,
	};
}

function names(results: ResourceResult[]): string[] {
	return results.map((result) => result.name);
}

describe("runCleanup", () => {
	it("deletes this PR's resources and sweeps only Workers of PRs that are no longer open", async () => {
		const { calls, comment, failed } = await run({
			"DELETE /workers/scripts/api-pr-12?force=true": [ok()],
			[OPEN_PULLS]: [{ body: [{ number: 5 }], status: 200 }],
			"DELETE /d1/database/uuid-12": [ok()],
			"DELETE /pages/projects/web/deployments/new?force=true": [ok()],
			"DELETE /pages/projects/web/deployments/old?force=true": [ok()],
			"DELETE /workers/scripts/api-pr-6?force=true": [ok()],
			"GET /d1/database": [
				ok([
					{ name: "db-pr-5", uuid: "uuid-5" },
					{ name: "db-pr-12", uuid: "uuid-12" },
				]),
			],
			"GET /pages/projects/web/deployments": [
				ok([
					deployment("new", "pr-12"),
					deployment("other", "pr-5"),
					deployment("old", "pr-12"),
				]),
			],
			"GET /workers/scripts": [
				ok([
					{ id: "api-pr-5" },
					{ id: "api-pr-6" },
					{ id: "api-pr-12" },
					{ id: "api-pr-main" },
					{ id: "sapphire2-api" },
				]),
			],
		});

		expect(failed).toEqual([]);
		expect(calls.filter((call) => call.startsWith("DELETE"))).toEqual([
			"DELETE /workers/scripts/api-pr-12?force=true",
			"DELETE /workers/scripts/api-pr-6?force=true",
			"DELETE /pages/projects/web/deployments/new?force=true",
			"DELETE /pages/projects/web/deployments/old?force=true",
			"DELETE /d1/database/uuid-12",
		]);
		expect(comment).toContain("has been cleaned up");
	});

	it("treats resources that are already gone as cleaned up", async () => {
		const { comment, results } = await run({
			"DELETE /workers/scripts/api-pr-12?force=true": [
				fail(404, "This Worker does not exist on your account."),
			],
			[OPEN_PULLS]: [{ body: [], status: 200 }],
			"GET /d1/database": [ok([])],
			"GET /pages/projects/web/deployments": [ok([])],
			"GET /workers/scripts": [ok([])],
		});

		expect(results.map((result) => result.status)).toEqual([
			"absent",
			"absent",
			"absent",
			"absent",
		]);
		expect(comment).toContain("has been cleaned up");
	});

	it("reports every resource as possibly remaining when Cloudflare rejects the token, without retrying", async () => {
		const rejected = [fail(403, "Authentication error")];
		const { calls, comment, failed, sleeps } = await run({
			"DELETE /workers/scripts/api-pr-12?force=true": rejected,
			[OPEN_PULLS]: [{ body: [], status: 200 }],
			"GET /d1/database": rejected,
			"GET /pages/projects/web/deployments": rejected,
			"GET /workers/scripts": rejected,
		});

		expect(failed.map((result) => result.kind)).toEqual([
			"worker",
			"orphan-worker",
			"pages",
			"d1",
		]);
		expect(sleeps).toEqual([]);
		expect(calls).toHaveLength(5);
		expect(comment).toContain("Preview Environment");
		expect(comment).not.toContain("has been cleaned up");
		for (const name of ["api-pr-12", "web branch pr-12", "db-pr-12"]) {
			expect(comment).toContain(name);
		}
		expect(comment).toContain(RUN_URL);
	});

	it("retries transient errors with backoff and still cleans the other resources after one keeps failing", async () => {
		const { comment, failed, results, sleeps } = await run({
			"DELETE /workers/scripts/api-pr-12?force=true": [
				fail(429, "Rate limited"),
				ok(),
			],
			[OPEN_PULLS]: [{ body: [], status: 200 }],
			"DELETE /d1/database/uuid-12": [ok()],
			"DELETE /pages/projects/web/deployments/dep?force=true": [
				fail(503, "Service unavailable"),
			],
			"GET /d1/database": [ok([{ name: "db-pr-12", uuid: "uuid-12" }])],
			"GET /pages/projects/web/deployments": [ok([deployment("dep", "pr-12")])],
			"GET /workers/scripts": [ok([])],
		});

		expect(sleeps).toEqual([1000, 1000, 2000, 4000]);
		expect(names(failed)).toEqual(["web branch pr-12 (dep)"]);
		expect(results.find((result) => result.kind === "worker")?.status).toBe(
			"deleted"
		);
		expect(results.find((result) => result.kind === "d1")?.status).toBe(
			"deleted"
		);
		expect(comment).toContain("web branch pr-12 (dep)");
		expect(comment).not.toContain("db-pr-12");
	});

	it("deletes no other PR's Worker when the open PRs cannot be listed", async () => {
		const { calls, failed } = await run({
			"DELETE /workers/scripts/api-pr-12?force=true": [ok()],
			[OPEN_PULLS]: [{ body: { message: "Bad credentials" }, status: 401 }],
			"GET /d1/database": [ok([])],
			"GET /pages/projects/web/deployments": [ok([])],
		});

		expect(failed.map((result) => result.kind)).toEqual(["orphan-worker"]);
		expect(calls).not.toContain("GET /workers/scripts");
	});
});
