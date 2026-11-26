import { writeFileSync } from "node:fs";
import { setTimeout as wait } from "node:timers/promises";

const CLOUDFLARE_API = "https://api.cloudflare.com/client/v4";
const GITHUB_API = "https://api.github.com";
const GITHUB_PAGE_SIZE = 100;
const D1_PAGE_SIZE = 1000;
const MAX_PAGES = 1000;
const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 1000;
const MAX_CELL_LENGTH = 200;
const MAX_TABLE_ROWS = 30;
const TABLE_BREAKING = /[\r\n|]+/gu;
const DIGITS = /^\d+$/u;
const PAGES_BRANCH_PREFIX = "pr-";

export interface CleanupConfig {
	accountId: string;
	apiToken: string;
	d1Prefix: string;
	githubToken: string;
	pagesProject: string;
	prNumber: number | null;
	repository: string;
	workerPrefix: string;
}

export interface CleanupDeps {
	fetch: (url: string, init: RequestInit) => Promise<Response>;
	log: (line: string) => void;
	sleep: (ms: number) => Promise<void>;
}

export type ResourceKind =
	| "d1"
	| "orphan-d1"
	| "orphan-pages"
	| "orphan-worker"
	| "pages"
	| "worker";

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

interface ResultInfo {
	per_page?: number;
	total_count?: number;
	total_pages?: number;
}

type ApiResult<T> =
	| { info: ResultInfo | undefined; ok: true; result: T | undefined }
	| { error: string; ok: false; status: number };

type Listing<T> = { items: T[]; ok: true } | { error: string; ok: false };

interface PagesDeployment {
	deployment_trigger?: { metadata?: { branch?: string } };
	id: string;
}

interface D1Database {
	name: string;
	uuid: string;
}

interface Inventory {
	databases: Listing<D1Database>;
	deployments: Listing<PagesDeployment>;
	workers: Listing<{ id: string }>;
}

interface Target {
	name: string;
	path: string;
}

const KIND_LABELS: Record<ResourceKind, string> = {
	d1: "D1 database",
	"orphan-d1": "D1 database of a closed PR",
	"orphan-pages": "Pages deployment of a closed PR",
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
		result_info?: ResultInfo;
	} | null;
	if (response.ok) {
		return { info: body?.result_info, ok: true, result: body?.result };
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

function hasMorePages(
	info: ResultInfo | undefined,
	page: number,
	received: number
): boolean {
	if (info?.total_pages !== undefined) {
		return page < info.total_pages;
	}
	if (info?.total_count !== undefined && info.per_page) {
		return page * info.per_page < info.total_count;
	}
	return info?.per_page !== undefined && received >= info.per_page;
}

async function listAll<T>(
	ctx: Context,
	path: string,
	query: string,
	key: (item: T) => string,
	page = 1,
	found = new Map<string, T>()
): Promise<Listing<T>> {
	const params = [query, page > 1 ? `page=${page}` : ""]
		.filter(Boolean)
		.join("&");
	const listed = await cloudflare<T[]>(
		ctx,
		"GET",
		params ? `${path}?${params}` : path
	);
	if (!listed.ok) {
		return { error: listed.error, ok: false };
	}
	const items = listed.result ?? [];
	let added = 0;
	for (const item of items) {
		if (!found.has(key(item))) {
			found.set(key(item), item);
			added += 1;
		}
	}
	if (added === 0 || !hasMorePages(listed.info, page, items.length)) {
		return { items: [...found.values()], ok: true };
	}
	if (page >= MAX_PAGES) {
		return { error: `stopped after ${MAX_PAGES} pages`, ok: false };
	}
	return listAll(ctx, path, query, key, page + 1, found);
}

async function deleteResource(
	ctx: Context,
	kind: ResourceKind,
	{ name, path }: Target
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
	targets: Target[],
	label: string
): Promise<ResourceResult[]> {
	if (targets.length === 0) {
		return [{ detail: "none found", kind, name: label, status: "absent" }];
	}
	const results: ResourceResult[] = [];
	for (const target of targets) {
		// biome-ignore lint/performance/noAwaitInLoops: Delete one at a time so a burst does not trip the Cloudflare rate limit.
		results.push(await deleteResource(ctx, kind, target));
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

function prNumberOf(name: string | undefined, prefix: string): number | null {
	const suffix = name?.startsWith(prefix) ? name.slice(prefix.length) : "";
	return DIGITS.test(suffix) ? Number(suffix) : null;
}

function pagesTarget(
	{ pagesProject }: CleanupConfig,
	deployment: PagesDeployment
): Target {
	return {
		name: `${pagesProject} branch ${deployment.deployment_trigger?.metadata?.branch} (${deployment.id})`,
		path: `/pages/projects/${pagesProject}/deployments/${deployment.id}?force=true`,
	};
}

async function takeInventory(ctx: Context): Promise<Inventory> {
	const { pagesProject } = ctx.config;
	return {
		databases: await listAll<D1Database>(
			ctx,
			"/d1/database",
			`per_page=${D1_PAGE_SIZE}`,
			(db) => db.uuid
		),
		deployments: await listAll<PagesDeployment>(
			ctx,
			`/pages/projects/${pagesProject}/deployments`,
			"",
			(deployment) => deployment.id
		),
		workers: await listAll<{ id: string }>(
			ctx,
			"/workers/scripts",
			"",
			(script) => script.id
		),
	};
}

async function deletePreview(
	ctx: Context,
	prNumber: number,
	{ deployments }: Inventory
): Promise<ResourceResult[]> {
	const { d1Prefix, pagesProject, workerPrefix } = ctx.config;
	const workerName = `${workerPrefix}${prNumber}`;
	const pagesLabel = `${pagesProject} branch ${PAGES_BRANCH_PREFIX}${prNumber}`;
	const databaseName = `${d1Prefix}${prNumber}`;
	const results = [
		await deleteResource(ctx, "worker", {
			name: workerName,
			path: `/workers/scripts/${workerName}?force=true`,
		}),
	];
	if (deployments.ok) {
		const own = deployments.items.filter(
			(deployment) =>
				prNumberOf(
					deployment.deployment_trigger?.metadata?.branch,
					PAGES_BRANCH_PREFIX
				) === prNumber
		);
		results.push(
			...(await deleteEach(
				ctx,
				"pages",
				own.map((deployment) => pagesTarget(ctx.config, deployment)),
				pagesLabel
			))
		);
	} else {
		results.push({
			detail: `could not list deployments: ${deployments.error}`,
			kind: "pages",
			name: pagesLabel,
			status: "failed",
		});
	}
	const named = await listAll<D1Database>(
		ctx,
		"/d1/database",
		`name=${encodeURIComponent(databaseName)}&per_page=${D1_PAGE_SIZE}`,
		(db) => db.uuid
	);
	if (named.ok) {
		const database = named.items.find((db) => db.name === databaseName);
		results.push(
			...(await deleteEach(
				ctx,
				"d1",
				database
					? [{ name: databaseName, path: `/d1/database/${database.uuid}` }]
					: [],
				databaseName
			))
		);
	} else {
		results.push({
			detail: `could not list databases: ${named.error}`,
			kind: "d1",
			name: databaseName,
			status: "failed",
		});
	}
	return results;
}

function sweepKind<T>(
	ctx: Context,
	kind: ResourceKind,
	label: string,
	listing: Listing<T>,
	prOf: (item: T) => number | null,
	isKept: (pr: number) => boolean,
	target: (item: T) => Target
): Promise<ResourceResult[]> {
	if (!listing.ok) {
		return Promise.resolve([
			{
				detail: `could not list them: ${listing.error}`,
				kind,
				name: label,
				status: "failed",
			},
		]);
	}
	const orphans = listing.items.filter((item) => {
		const pr = prOf(item);
		return pr !== null && !isKept(pr);
	});
	return deleteEach(ctx, kind, orphans.map(target), label);
}

async function sweepOrphans(
	ctx: Context,
	inventory: Inventory,
	open: Set<number> | Error
): Promise<ResourceResult[]> {
	const { d1Prefix, pagesProject, prNumber, workerPrefix } = ctx.config;
	const labels: [ResourceKind, string][] = [
		["orphan-worker", `${workerPrefix}*`],
		["orphan-pages", `${pagesProject} branches ${PAGES_BRANCH_PREFIX}*`],
		["orphan-d1", `${d1Prefix}*`],
	];
	if (open instanceof Error) {
		return labels.map(([kind, name]) => ({
			detail: `could not list open PRs, so none was deleted: ${open.message}`,
			kind,
			name,
			status: "failed",
		}));
	}
	const isKept = (pr: number) => pr === prNumber || open.has(pr);
	return [
		...(await sweepKind(
			ctx,
			"orphan-worker",
			`${workerPrefix}*`,
			inventory.workers,
			(script) => prNumberOf(script.id, workerPrefix),
			isKept,
			(script) => ({
				name: script.id,
				path: `/workers/scripts/${script.id}?force=true`,
			})
		)),
		...(await sweepKind(
			ctx,
			"orphan-pages",
			`${pagesProject} branches ${PAGES_BRANCH_PREFIX}*`,
			inventory.deployments,
			(deployment) =>
				prNumberOf(
					deployment.deployment_trigger?.metadata?.branch,
					PAGES_BRANCH_PREFIX
				),
			isKept,
			(deployment) => pagesTarget(ctx.config, deployment)
		)),
		...(await sweepKind(
			ctx,
			"orphan-d1",
			`${d1Prefix}*`,
			inventory.databases,
			(db) => prNumberOf(db.name, d1Prefix),
			isKept,
			(db) => ({ name: db.name, path: `/d1/database/${db.uuid}` })
		)),
	];
}

export async function runCleanup(
	config: CleanupConfig,
	deps: CleanupDeps
): Promise<ResourceResult[]> {
	const ctx = { config, deps };
	const inventory = await takeInventory(ctx);
	const open = await listOpenPullRequests(ctx).catch(
		(error: unknown) => new Error(errorMessage(error))
	);
	const results = [
		...(config.prNumber === null
			? []
			: await deletePreview(ctx, config.prNumber, inventory)),
		...(await sweepOrphans(ctx, inventory, open)),
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
	{
		closedAt,
		prNumber,
		runUrl,
	}: { closedAt: string; prNumber: number | null; runUrl: string }
): string {
	const heading =
		prNumber === null ? "## Preview Orphan Sweep" : "## Preview Environment";
	const failed = results.filter((result) => result.status === "failed");
	if (failed.length === 0) {
		return prNumber === null
			? `${heading}

No preview resource of a PR that is not open is left.
`
			: `${heading}

~Preview environment has been cleaned up.~

_Cleaned up at: ${closedAt}_
`;
	}
	const rows = failed
		.slice(0, MAX_TABLE_ROWS)
		.map(
			(result) =>
				`| ${KIND_LABELS[result.kind]} | \`${tableCell(result.name)}\` | ${tableCell(result.detail)} |`
		);
	if (failed.length > MAX_TABLE_ROWS) {
		rows.push(
			`| … | ${failed.length - MAX_TABLE_ROWS} more | see the run log |`
		);
	}
	return `${heading}

> [!WARNING]
> Preview cleanup failed. These preview resources may still exist.

| Resource | Name | Error |
|---|---|---|
${rows.join("\n")}

To retry, fix the cause, open [the cleanup run](${runUrl}) and choose **Re-run failed jobs**; this comment is updated when nothing is left. To delete the resources by hand instead, follow "Preview Cleanup Failure" in \`docs/deploy.md\`.
`;
}

export function readConfig(env: NodeJS.ProcessEnv): CleanupConfig {
	const names = [
		"CLOUDFLARE_ACCOUNT_ID",
		"CLOUDFLARE_API_TOKEN",
		"D1_PREFIX",
		"GH_TOKEN",
		"PROJECT_NAME",
		"REPO",
		"WORKER_PREFIX",
	] as const;
	const missing = names.filter((key) => !env[key]);
	if (missing.length > 0) {
		throw new Error(`missing environment variables: ${missing.join(", ")}`);
	}
	const value = (key: (typeof names)[number]) => env[key] ?? "";
	const rawPr = env.PR_NUMBER ?? "";
	if (rawPr !== "" && !DIGITS.test(rawPr)) {
		throw new Error(`PR_NUMBER is not a PR number: ${rawPr}`);
	}
	return {
		accountId: value("CLOUDFLARE_ACCOUNT_ID"),
		apiToken: value("CLOUDFLARE_API_TOKEN"),
		d1Prefix: value("D1_PREFIX"),
		githubToken: value("GH_TOKEN"),
		pagesProject: value("PROJECT_NAME"),
		prNumber: rawPr === "" ? null : Number(rawPr),
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
	const config = readConfig(process.env);
	const results = await runCleanup(config, {
		fetch: (url, init) => fetch(url, init),
		log: (line) => console.log(line),
		sleep: async (ms) => {
			await wait(ms);
		},
	});
	writeFileSync(
		reportPath,
		renderComment(results, {
			closedAt: process.env.CLOSED_AT || new Date().toISOString(),
			prNumber: config.prNumber,
			runUrl: process.env.RUN_URL ?? "",
		})
	);
	const failed = results.filter((result) => result.status === "failed");
	if (failed.length > 0) {
		console.log(
			`::error::Preview cleanup could not delete ${failed.length} resource(s); they may still exist. See the report and the log above.`
		);
		return 1;
	}
	return 0;
}

if (import.meta.main) {
	process.exit(await main());
}
