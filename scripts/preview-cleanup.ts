import { writeFileSync } from "node:fs";
import { setTimeout as wait } from "node:timers/promises";

const CLOUDFLARE_API = "https://api.cloudflare.com/client/v4";
const GITHUB_API = "https://api.github.com";
const GITHUB_PAGE_SIZE = 100;
const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 1000;
const MAX_CELL_LENGTH = 200;
const TABLE_BREAKING = /[\r\n|]+/gu;
const DIGITS = /^\d+$/u;

export interface CleanupConfig {
	accountId: string;
	apiToken: string;
	d1Prefix: string;
	githubToken: string;
	pagesProject: string;
	prNumber: number;
	repository: string;
	workerPrefix: string;
}

export interface CleanupDeps {
	fetch: (url: string, init: RequestInit) => Promise<Response>;
	log: (line: string) => void;
	sleep: (ms: number) => Promise<void>;
}

export type ResourceKind = "d1" | "orphan-worker" | "pages" | "worker";

export interface ResourceResult {
	detail: string;
	kind: ResourceKind;
	name: string;
	status: "absent" | "deleted" | "failed";
}

interface Context {
	config: CleanupConfig;
	deps: CleanupDeps;
}

type ApiResult<T> =
	| { ok: true; result: T | undefined }
	| { error: string; ok: false; status: number };

interface PagesDeployment {
	deployment_trigger?: { metadata?: { branch?: string } };
	id: string;
}

const KIND_LABELS: Record<ResourceKind, string> = {
	d1: "D1 database",
	"orphan-worker": "Worker of a closed PR",
	pages: "Pages deployment",
	worker: "Worker",
};

function isRetryable(response: Response | undefined): boolean {
	return (
		response === undefined || response.status === 429 || response.status >= 500
	);
}

async function request(
	deps: CleanupDeps,
	url: string,
	init: RequestInit,
	attempt = 1
): Promise<Response> {
	let response: Response | undefined;
	let failure: unknown;
	try {
		response = await deps.fetch(url, init);
	} catch (error) {
		failure = error;
	}
	if (!isRetryable(response) || attempt >= MAX_ATTEMPTS) {
		if (response) {
			return response;
		}
		throw failure;
	}
	const delay = BASE_DELAY_MS * 2 ** (attempt - 1);
	deps.log(
		`${init.method} ${url} returned ${response?.status ?? "a network error"}; retrying in ${delay} ms (attempt ${attempt + 1} of ${MAX_ATTEMPTS})`
	);
	await deps.sleep(delay);
	return request(deps, url, init, attempt + 1);
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

async function cloudflare<T>(
	{ config, deps }: Context,
	method: "DELETE" | "GET",
	path: string
): Promise<ApiResult<T>> {
	let response: Response;
	try {
		response = await request(
			deps,
			`${CLOUDFLARE_API}/accounts/${config.accountId}${path}`,
			{ headers: { Authorization: `Bearer ${config.apiToken}` }, method }
		);
	} catch (error) {
		return { error: errorMessage(error), ok: false, status: 0 };
	}
	const body = (await response.json().catch(() => null)) as {
		errors?: { code?: number; message?: string }[];
		result?: T;
	} | null;
	if (response.ok) {
		return { ok: true, result: body?.result };
	}
	const messages = (body?.errors ?? [])
		.map((error) => `${error.code ?? "?"} ${error.message ?? ""}`.trim())
		.join("; ");
	return {
		error: messages
			? `HTTP ${response.status}: ${messages}`
			: `HTTP ${response.status}`,
		ok: false,
		status: response.status,
	};
}

async function deleteResource(
	ctx: Context,
	kind: ResourceKind,
	name: string,
	path: string
): Promise<ResourceResult> {
	const outcome = await cloudflare<unknown>(ctx, "DELETE", path);
	if (outcome.ok) {
		return { detail: "deleted", kind, name, status: "deleted" };
	}
	if (outcome.status === 404) {
		return { detail: "already deleted", kind, name, status: "absent" };
	}
	return { detail: outcome.error, kind, name, status: "failed" };
}

async function deleteEach(
	ctx: Context,
	kind: ResourceKind,
	targets: { name: string; path: string }[]
): Promise<ResourceResult[]> {
	const results: ResourceResult[] = [];
	for (const target of targets) {
		results.push(
			// biome-ignore lint/performance/noAwaitInLoops: Delete one at a time so a burst does not trip the Cloudflare rate limit.
			await deleteResource(ctx, kind, target.name, target.path)
		);
	}
	return results;
}

async function listOpenPullRequests(
	{ config, deps }: Context,
	page = 1,
	found = new Set<number>()
): Promise<Set<number>> {
	const response = await request(
		deps,
		`${GITHUB_API}/repos/${config.repository}/pulls?state=open&per_page=${GITHUB_PAGE_SIZE}&page=${page}`,
		{
			headers: {
				Accept: "application/vnd.github+json",
				Authorization: `Bearer ${config.githubToken}`,
				"User-Agent": "preview-cleanup",
			},
			method: "GET",
		}
	);
	if (!response.ok) {
		throw new Error(`GitHub API HTTP ${response.status}`);
	}
	const pulls = (await response.json()) as { number: number }[];
	for (const pull of pulls) {
		found.add(pull.number);
	}
	if (pulls.length < GITHUB_PAGE_SIZE) {
		return found;
	}
	return listOpenPullRequests({ config, deps }, page + 1, found);
}

function prNumberOf(name: string, prefix: string): number | null {
	const suffix = name.startsWith(prefix) ? name.slice(prefix.length) : "";
	return DIGITS.test(suffix) ? Number(suffix) : null;
}

function deletePreviewWorker(ctx: Context): Promise<ResourceResult> {
	const name = `${ctx.config.workerPrefix}${ctx.config.prNumber}`;
	return deleteResource(
		ctx,
		"worker",
		name,
		`/workers/scripts/${name}?force=true`
	);
}

async function deleteOrphanWorkers(ctx: Context): Promise<ResourceResult[]> {
	const { prNumber, workerPrefix } = ctx.config;
	const name = `${workerPrefix}*`;
	let open: Set<number>;
	try {
		open = await listOpenPullRequests(ctx);
	} catch (error) {
		return [
			{
				detail: `could not list open PRs, so no Worker was swept: ${errorMessage(error)}`,
				kind: "orphan-worker",
				name,
				status: "failed",
			},
		];
	}
	const listed = await cloudflare<{ id: string }[]>(
		ctx,
		"GET",
		"/workers/scripts"
	);
	if (!listed.ok) {
		return [
			{
				detail: `could not list Workers: ${listed.error}`,
				kind: "orphan-worker",
				name,
				status: "failed",
			},
		];
	}
	const orphans = (listed.result ?? [])
		.map((script) => script.id)
		.filter((id) => {
			const pr = prNumberOf(id, workerPrefix);
			return pr !== null && pr !== prNumber && !open.has(pr);
		});
	if (orphans.length === 0) {
		return [
			{ detail: "none found", kind: "orphan-worker", name, status: "absent" },
		];
	}
	return deleteEach(
		ctx,
		"orphan-worker",
		orphans.map((id) => ({
			name: id,
			path: `/workers/scripts/${id}?force=true`,
		}))
	);
}

async function deletePagesDeployments(ctx: Context): Promise<ResourceResult[]> {
	const { pagesProject, prNumber } = ctx.config;
	const branch = `pr-${prNumber}`;
	const name = `${pagesProject} branch ${branch}`;
	const listed = await cloudflare<PagesDeployment[]>(
		ctx,
		"GET",
		`/pages/projects/${pagesProject}/deployments`
	);
	if (!listed.ok) {
		return [
			{
				detail: `could not list deployments: ${listed.error}`,
				kind: "pages",
				name,
				status: "failed",
			},
		];
	}
	const ids = (listed.result ?? [])
		.filter(
			(deployment) => deployment.deployment_trigger?.metadata?.branch === branch
		)
		.map((deployment) => deployment.id);
	if (ids.length === 0) {
		return [{ detail: "none found", kind: "pages", name, status: "absent" }];
	}
	return deleteEach(
		ctx,
		"pages",
		ids.map((id) => ({
			name: `${name} (${id})`,
			path: `/pages/projects/${pagesProject}/deployments/${id}?force=true`,
		}))
	);
}

async function deleteD1Database(ctx: Context): Promise<ResourceResult> {
	const name = `${ctx.config.d1Prefix}${ctx.config.prNumber}`;
	const listed = await cloudflare<{ name: string; uuid: string }[]>(
		ctx,
		"GET",
		"/d1/database"
	);
	if (!listed.ok) {
		return {
			detail: `could not list databases: ${listed.error}`,
			kind: "d1",
			name,
			status: "failed",
		};
	}
	const database = (listed.result ?? []).find((db) => db.name === name);
	if (!database) {
		return { detail: "none found", kind: "d1", name, status: "absent" };
	}
	return deleteResource(ctx, "d1", name, `/d1/database/${database.uuid}`);
}

export async function runCleanup(
	config: CleanupConfig,
	deps: CleanupDeps
): Promise<ResourceResult[]> {
	const ctx = { config, deps };
	const results = [
		await deletePreviewWorker(ctx),
		...(await deleteOrphanWorkers(ctx)),
		...(await deletePagesDeployments(ctx)),
		await deleteD1Database(ctx),
	];
	for (const result of results) {
		deps.log(
			`${result.status.toUpperCase()} ${KIND_LABELS[result.kind]} ${result.name}: ${result.detail}`
		);
	}
	return results;
}

function tableCell(text: string): string {
	const flat = text.replace(TABLE_BREAKING, " ").trim();
	return flat.length > MAX_CELL_LENGTH
		? `${flat.slice(0, MAX_CELL_LENGTH)}…`
		: flat;
}

export function renderComment(
	results: ResourceResult[],
	{ closedAt, runUrl }: { closedAt: string; runUrl: string }
): string {
	const failed = results.filter((result) => result.status === "failed");
	if (failed.length === 0) {
		return `## Preview Environment

~Preview environment has been cleaned up.~

_Cleaned up at: ${closedAt}_
`;
	}
	const rows = failed
		.map(
			(result) =>
				`| ${KIND_LABELS[result.kind]} | \`${tableCell(result.name)}\` | ${tableCell(result.detail)} |`
		)
		.join("\n");
	return `## Preview Environment

> [!WARNING]
> Preview cleanup failed. These preview resources may still exist.

| Resource | Name | Error |
|---|---|---|
${rows}

To retry, fix the cause, open [the cleanup run](${runUrl}) and choose **Re-run failed jobs**; this comment is updated when nothing is left. To delete the resources by hand instead, follow "Preview Cleanup Failure" in \`docs/deploy.md\`.
`;
}

export function readConfig(env: NodeJS.ProcessEnv): CleanupConfig {
	const names = [
		"CLOUDFLARE_ACCOUNT_ID",
		"CLOUDFLARE_API_TOKEN",
		"D1_PREFIX",
		"GH_TOKEN",
		"PR_NUMBER",
		"PROJECT_NAME",
		"REPO",
		"WORKER_PREFIX",
	] as const;
	const missing = names.filter((key) => !env[key]);
	if (missing.length > 0) {
		throw new Error(`missing environment variables: ${missing.join(", ")}`);
	}
	const value = (key: (typeof names)[number]) => env[key] ?? "";
	const prNumber = Number(value("PR_NUMBER"));
	if (!Number.isInteger(prNumber) || prNumber <= 0) {
		throw new Error(`PR_NUMBER is not a PR number: ${value("PR_NUMBER")}`);
	}
	return {
		accountId: value("CLOUDFLARE_ACCOUNT_ID"),
		apiToken: value("CLOUDFLARE_API_TOKEN"),
		d1Prefix: value("D1_PREFIX"),
		githubToken: value("GH_TOKEN"),
		pagesProject: value("PROJECT_NAME"),
		prNumber,
		repository: value("REPO"),
		workerPrefix: value("WORKER_PREFIX"),
	};
}

async function main(): Promise<number> {
	const reportPath = process.env.REPORT_PATH;
	if (!reportPath) {
		console.error("preview-cleanup: REPORT_PATH is not set");
		return 2;
	}
	const results = await runCleanup(readConfig(process.env), {
		fetch: (url, init) => fetch(url, init),
		log: (line) => console.log(line),
		sleep: async (ms) => {
			await wait(ms);
		},
	});
	writeFileSync(
		reportPath,
		renderComment(results, {
			closedAt: process.env.CLOSED_AT ?? "",
			runUrl: process.env.RUN_URL ?? "",
		})
	);
	const failed = results.filter((result) => result.status === "failed");
	if (failed.length > 0) {
		console.log(
			`::error::Preview cleanup could not delete ${failed.length} resource(s); they may still exist. See the PR comment and the log above.`
		);
		return 1;
	}
	return 0;
}

if (import.meta.main) {
	process.exit(await main());
}
