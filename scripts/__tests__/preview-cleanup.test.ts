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
const LIST_D1 = "GET /d1/database?per_page=1000";
const FIND_D1 = "GET /d1/database?name=db-pr-12&per_page=1000";
const LIST_PAGES = "GET /pages/projects/web/deployments";
const LIST_WORKERS = "GET /workers/scripts";
const DELETE_WORKER = "DELETE /workers/scripts/api-pr-12?force=true";
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

function ok(result: unknown = null, resultInfo?: unknown): Reply {
	return {
		body: { errors: [], result, result_info: resultInfo, success: true },
		status: 200,
	};
}

function fail(status: number, message: string): Reply {
	return {
		body: { errors: [{ code: 10_000, message }], success: false },
		status,
	};
}

function pulls(...numbers: number[]): Reply {
	return { body: numbers.map((number) => ({ number })), status: 200 };
}

function deployment(id: string, branch: string) {
	return { deployment_trigger: { metadata: { branch } }, id };
}

function nothingListed(): Record<string, Reply[]> {
	return {
		[FIND_D1]: [ok([])],
		[LIST_D1]: [ok([])],
		[LIST_PAGES]: [ok([])],
		[LIST_WORKERS]: [ok([])],
		[OPEN_PULLS]: [pulls()],
	};
}

async function run(
	routes: Record<string, Reply[]>,
	prNumber: number | null = config.prNumber
) {
	const calls: string[] = [];
	const sleeps: number[] = [];
	const unexpected: string[] = [];
	const results = await runCleanup(
		{ ...config, prNumber },
		{
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
		}
	);
	expect(unexpected).toEqual([]);
	return {
		calls,
		comment: renderComment(results, {
			closedAt: "2026-11-26",
			prNumber,
			runUrl: RUN_URL,
		}),
		deletes: calls.filter((call) => call.startsWith("DELETE")),
		failed: results.filter((result) => result.status === "failed"),
		results,
		sleeps,
	};
}

function names(results: ResourceResult[]): string[] {
	return results.map((result) => result.name);
}

describe("runCleanup", () => {
	it("deletes this PR's preview and every preview of a PR that is no longer open", async () => {
		const { comment, deletes, failed } = await run({
			...nothingListed(),
			[OPEN_PULLS]: [pulls(5)],
			[LIST_WORKERS]: [
				ok([
					{ id: "api-pr-5" },
					{ id: "api-pr-6" },
					{ id: "api-pr-12" },
					{ id: "api-pr-main" },
					{ id: "sapphire2-api" },
				]),
			],
			[LIST_PAGES]: [
				ok([
					deployment("new", "pr-12"),
					deployment("open", "pr-5"),
					deployment("closed", "pr-6"),
					deployment("old", "pr-12"),
					deployment("dev", "dev"),
				]),
			],
			[LIST_D1]: [
				ok([
					{ name: "db-pr-5", uuid: "uuid-5" },
					{ name: "db-pr-6", uuid: "uuid-6" },
					{ name: "db-pr-12", uuid: "uuid-12" },
					{ name: "sapphire2-db", uuid: "uuid-prod" },
				]),
			],
			[FIND_D1]: [ok([{ name: "db-pr-12", uuid: "uuid-12" }])],
			[DELETE_WORKER]: [ok()],
			"DELETE /d1/database/uuid-6": [ok()],
			"DELETE /d1/database/uuid-12": [ok()],
			"DELETE /pages/projects/web/deployments/closed?force=true": [ok()],
			"DELETE /pages/projects/web/deployments/new?force=true": [ok()],
			"DELETE /pages/projects/web/deployments/old?force=true": [ok()],
			"DELETE /workers/scripts/api-pr-6?force=true": [ok()],
		});

		expect(failed).toEqual([]);
		expect(deletes).toEqual([
			DELETE_WORKER,
			"DELETE /pages/projects/web/deployments/new?force=true",
			"DELETE /pages/projects/web/deployments/old?force=true",
			"DELETE /d1/database/uuid-12",
			"DELETE /workers/scripts/api-pr-6?force=true",
			"DELETE /pages/projects/web/deployments/closed?force=true",
			"DELETE /d1/database/uuid-6",
		]);
		expect(comment).toContain("has been cleaned up");
	});

	it("follows every page of the Cloudflare lists and deletes a resource seen twice only once", async () => {
		const { deletes, failed } = await run({
			...nothingListed(),
			[LIST_PAGES]: [
				ok([deployment("p1", "pr-12"), deployment("shifted", "pr-7")], {
					page: 1,
					total_pages: 2,
				}),
			],
			"GET /pages/projects/web/deployments?page=2": [
				ok([deployment("shifted", "pr-7"), deployment("p2", "pr-12")], {
					page: 2,
					total_pages: 2,
				}),
			],
			[LIST_D1]: [
				ok([{ name: "db-pr-3", uuid: "uuid-3" }], {
					per_page: 1,
					total_count: 2,
				}),
			],
			"GET /d1/database?per_page=1000&page=2": [
				ok([{ name: "db-pr-4", uuid: "uuid-4" }], {
					per_page: 1,
					total_count: 2,
				}),
			],
			[DELETE_WORKER]: [ok()],
			"DELETE /d1/database/uuid-3": [ok()],
			"DELETE /d1/database/uuid-4": [ok()],
			"DELETE /pages/projects/web/deployments/p1?force=true": [ok()],
			"DELETE /pages/projects/web/deployments/p2?force=true": [ok()],
			"DELETE /pages/projects/web/deployments/shifted?force=true": [ok()],
		});

		expect(failed).toEqual([]);
		expect(deletes.toSorted()).toEqual(
			[
				DELETE_WORKER,
				"DELETE /pages/projects/web/deployments/p1?force=true",
				"DELETE /pages/projects/web/deployments/p2?force=true",
				"DELETE /pages/projects/web/deployments/shifted?force=true",
				"DELETE /d1/database/uuid-3",
				"DELETE /d1/database/uuid-4",
			].toSorted()
		);
	});

	it("sweeps only other PRs' previews when no PR is given, listing them before the open PRs", async () => {
		const { calls, comment, deletes, failed } = await run(
			{
				...nothingListed(),
				[LIST_WORKERS]: [ok([{ id: "api-pr-8" }])],
				"DELETE /workers/scripts/api-pr-8?force=true": [ok()],
			},
			null
		);

		expect(failed).toEqual([]);
		expect(deletes).toEqual(["DELETE /workers/scripts/api-pr-8?force=true"]);
		expect(calls).not.toContain(FIND_D1);
		expect(calls.indexOf(OPEN_PULLS)).toBeGreaterThan(
			Math.max(
				calls.indexOf(LIST_D1),
				calls.indexOf(LIST_PAGES),
				calls.indexOf(LIST_WORKERS)
			)
		);
		expect(comment).toContain("Preview Orphan Sweep");
	});

	it("treats resources that are already gone as cleaned up", async () => {
		const { comment, failed } = await run({
			...nothingListed(),
			[DELETE_WORKER]: [
				fail(404, "This Worker does not exist on your account."),
			],
		});

		expect(failed).toEqual([]);
		expect(comment).toContain("has been cleaned up");
	});

	it("reports every resource as possibly remaining when Cloudflare rejects the token, without retrying", async () => {
		const rejected = [fail(403, "Authentication error")];
		const { calls, comment, failed, sleeps } = await run({
			[DELETE_WORKER]: rejected,
			[FIND_D1]: rejected,
			[LIST_D1]: rejected,
			[LIST_PAGES]: rejected,
			[LIST_WORKERS]: rejected,
			[OPEN_PULLS]: [pulls()],
		});

		expect(failed.map((result) => result.kind)).toEqual([
			"worker",
			"pages",
			"d1",
			"orphan-worker",
			"orphan-pages",
			"orphan-d1",
		]);
		expect(sleeps).toEqual([]);
		expect(calls).toHaveLength(6);
		expect(comment).toContain("Preview Environment");
		expect(comment).not.toContain("has been cleaned up");
		for (const name of ["api-pr-12", "web branch pr-12", "db-pr-12"]) {
			expect(comment).toContain(name);
		}
		expect(comment).toContain(RUN_URL);
	});

	it("retries transient errors with backoff and still cleans the other resources after one keeps failing", async () => {
		const { comment, failed, results, sleeps } = await run({
			...nothingListed(),
			[DELETE_WORKER]: [fail(429, "Rate limited"), ok()],
			[LIST_PAGES]: [ok([deployment("dep", "pr-12")])],
			"DELETE /pages/projects/web/deployments/dep?force=true": [
				fail(503, "Service unavailable"),
			],
			[FIND_D1]: [ok([{ name: "db-pr-12", uuid: "uuid-12" }])],
			"DELETE /d1/database/uuid-12": [ok()],
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

	it("deletes nothing of another PR when the open PRs cannot be listed", async () => {
		const { deletes, failed } = await run({
			...nothingListed(),
			[OPEN_PULLS]: [{ body: { message: "Bad credentials" }, status: 401 }],
			[LIST_WORKERS]: [ok([{ id: "api-pr-5" }])],
			[LIST_PAGES]: [ok([deployment("open", "pr-5")])],
			[LIST_D1]: [ok([{ name: "db-pr-5", uuid: "uuid-5" }])],
			[DELETE_WORKER]: [ok()],
		});

		expect(failed.map((result) => result.kind)).toEqual([
			"orphan-worker",
			"orphan-pages",
			"orphan-d1",
		]);
		expect(deletes).toEqual([DELETE_WORKER]);
	});
});
