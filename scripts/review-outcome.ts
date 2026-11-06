export interface ReviewTrailer {
	important: number;
	unverified: number;
	verdict: string;
}

export interface LinearIssue {
	id: string;
	identifier: string;
	labels: { name: string; parent: string | null }[];
	state: string;
	team: string;
}

export interface OutcomeInput {
	baseRef: string;
	changedFiles: string[];
	ciState: string;
	draft: boolean;
	event: string;
	forkPr: boolean;
	headSha: string;
	issue: LinearIssue | null;
	maxAutoRounds: number;
	prHeadSha: string;
	round: number;
	trailer: ReviewTrailer | null;
	unresolvedThreads: number;
}

export type TargetStatus = "In Progress" | "Needs Input" | "Ready to Merge";

export interface OutcomeDecision {
	blockers: string[];
	merge: boolean;
	status: TargetStatus | null;
}

const BRANCH_PATTERN = /^feature\/sa2-(\d+)$/iu;
const TITLE_PATTERN = /\(SA2-(\d+)\)/giu;
const TEAM_KEY = "SA2";
const LEVEL_GROUP = "level";
const AUTO_MERGE_LEVEL = "auto-merge";
const REVIEW_LABEL_EVENT = "labeled";
const RED_CI_STATES = new Set(["failure", "timed_out"]);
const MOVABLE_STATES = new Set(["AI Review", "In Progress"]);
const CLOSED_STATES = new Set(["Done", "Released", "Canceled", "Duplicate"]);
const EXCLUDED_PATHS = [
	/^packages\/db\/src\/migrations\//u,
	/^packages\/auth\//u,
	/^apps\/server\/wrangler\.toml$/u,
	/^\.github\//u,
	/^\.claude\//u,
	/^\.gemini\//u,
	/^\.husky\//u,
	/^AGENTS\.md$/u,
	/^CLAUDE\.md$/u,
	/^scripts\/review-[^/]+\.ts$/u,
];

export function issueIdentifier(headRef: string, title: string): string | null {
	const branch = BRANCH_PATTERN.exec(headRef);
	if (!branch) {
		return null;
	}
	const number = branch[1];
	for (const match of title.matchAll(TITLE_PATTERN)) {
		if (match[1] !== number) {
			return null;
		}
	}
	return `${TEAM_KEY}-${number}`;
}

export function excludedPaths(files: string[]): string[] {
	return files.filter((file) =>
		EXCLUDED_PATHS.some((pattern) => pattern.test(file))
	);
}

export function parseTrailer(text: string): ReviewTrailer | null {
	let payload: unknown;
	try {
		payload = JSON.parse(text);
	} catch {
		return null;
	}
	if (typeof payload !== "object" || payload === null) {
		return null;
	}
	const { verdict, important, unverified } = payload as Record<string, unknown>;
	if (
		typeof verdict !== "string" ||
		!Number.isInteger(important) ||
		!Number.isInteger(unverified)
	) {
		return null;
	}
	return {
		important: important as number,
		unverified: unverified as number,
		verdict,
	};
}

export function hasAutoMergeLevel(issue: LinearIssue): boolean {
	const levels = issue.labels.filter((label) => label.parent === LEVEL_GROUP);
	return levels.length === 1 && levels[0]?.name === AUTO_MERGE_LEVEL;
}

function mergeBlockers(input: OutcomeInput, issue: LinearIssue | null) {
	const blockers: string[] = [];
	if (issue) {
		if (issue.team !== TEAM_KEY) {
			blockers.push(`issue ${issue.identifier} is not in team ${TEAM_KEY}`);
		}
		if (!hasAutoMergeLevel(issue)) {
			blockers.push(`issue ${issue.identifier} does not have level auto-merge`);
		}
		if (CLOSED_STATES.has(issue.state)) {
			blockers.push(`issue ${issue.identifier} is ${issue.state}`);
		}
	} else {
		blockers.push("no Linear issue is linked to the branch");
	}
	if (input.forkPr) {
		blockers.push("the PR comes from a fork");
	}
	if (input.draft) {
		blockers.push("the PR is a draft");
	}
	if (input.baseRef !== "dev") {
		blockers.push(`the base branch is ${input.baseRef}, not dev`);
	}
	if (input.event === REVIEW_LABEL_EVENT || input.round > input.maxAutoRounds) {
		blockers.push("the approve did not come from an automatic round");
	}
	if (input.trailer && input.trailer.unverified > 0) {
		blockers.push(`${input.trailer.unverified} unverified finding(s)`);
	}
	if (input.headSha !== input.prHeadSha) {
		blockers.push("the reviewed commit is not the PR head");
	}
	if (input.unresolvedThreads > 0) {
		blockers.push(`${input.unresolvedThreads} unresolved review thread(s)`);
	}
	const excluded = excludedPaths(input.changedFiles);
	if (excluded.length > 0) {
		blockers.push(`excluded paths changed: ${excluded.slice(0, 5).join(", ")}`);
	}
	return blockers;
}

export function decideOutcome(input: OutcomeInput): OutcomeDecision {
	if (RED_CI_STATES.has(input.ciState)) {
		return { blockers: ["ci is red"], merge: false, status: "In Progress" };
	}
	if (input.ciState !== "success" || input.trailer === null) {
		return { blockers: ["no completed review"], merge: false, status: null };
	}
	const approved =
		input.trailer.verdict === "approve" && input.trailer.important === 0;
	if (!approved) {
		return {
			blockers: ["the review did not approve"],
			merge: false,
			status:
				input.round >= input.maxAutoRounds ? "Needs Input" : "In Progress",
		};
	}
	const blockers = mergeBlockers(input, input.issue);
	return { blockers, merge: blockers.length === 0, status: "Ready to Merge" };
}

export function canMoveFrom(state: string): boolean {
	return MOVABLE_STATES.has(state);
}

const LINEAR_API = "https://api.linear.app/graphql";
const GITHUB_API = "https://api.github.com";

export async function linear<T>(
	apiKey: string,
	query: string,
	variables: Record<string, unknown> = {}
): Promise<T> {
	const response = await fetch(LINEAR_API, {
		body: JSON.stringify({ query, variables }),
		headers: { Authorization: apiKey, "Content-Type": "application/json" },
		method: "POST",
	});
	const payload = (await response.json()) as {
		data?: T;
		errors?: { message: string }[];
	};
	if (!response.ok || payload.errors || !payload.data) {
		const messages = payload.errors?.map((error) => error.message).join("; ");
		throw new Error(
			`Linear API ${response.status}: ${messages ?? "no data returned"}`
		);
	}
	return payload.data;
}

async function github<T>(
	token: string,
	path: string,
	init: { method?: string; body?: unknown } = {}
): Promise<T> {
	const response = await fetch(`${GITHUB_API}${path}`, {
		body: init.body === undefined ? undefined : JSON.stringify(init.body),
		headers: {
			Accept: "application/vnd.github+json",
			Authorization: `Bearer ${token}`,
			"X-GitHub-Api-Version": "2022-11-28",
		},
		method: init.method ?? "GET",
	});
	if (!response.ok) {
		throw new Error(
			`GitHub API ${init.method ?? "GET"} ${path} ${response.status}: ${await response.text()}`
		);
	}
	return (response.status === 204 ? undefined : await response.json()) as T;
}

async function fetchIssue(
	apiKey: string,
	identifier: string
): Promise<LinearIssue | null> {
	const data = await linear<{
		issue: {
			id: string;
			identifier: string;
			state: { name: string };
			team: { key: string };
			labels: { nodes: { name: string; parent: { name: string } | null }[] };
		} | null;
	}>(
		apiKey,
		`query ($id: String!) {
			issue(id: $id) {
				id identifier state { name } team { key }
				labels { nodes { name parent { name } } }
			}
		}`,
		{ id: identifier }
	);
	if (!data.issue) {
		return null;
	}
	return {
		id: data.issue.id,
		identifier: data.issue.identifier,
		labels: data.issue.labels.nodes.map((label) => ({
			name: label.name,
			parent: label.parent?.name ?? null,
		})),
		state: data.issue.state.name,
		team: data.issue.team.key,
	};
}

async function stateId(apiKey: string, name: string): Promise<string> {
	const data = await linear<{ workflowStates: { nodes: { id: string }[] } }>(
		apiKey,
		`query ($team: String!, $name: String!) {
			workflowStates(filter: { team: { key: { eq: $team } }, name: { eq: $name } }) {
				nodes { id }
			}
		}`,
		{ name, team: TEAM_KEY }
	);
	const [state, ...others] = data.workflowStates.nodes;
	if (!state || others.length > 0) {
		throw new Error(
			`expected one "${name}" state, found ${data.workflowStates.nodes.length}`
		);
	}
	return state.id;
}

async function setState(
	apiKey: string,
	issue: LinearIssue,
	name: string
): Promise<void> {
	const data = await linear<{ issueUpdate: { success: boolean } }>(
		apiKey,
		`mutation ($id: String!, $stateId: String!) {
			issueUpdate(id: $id, input: { stateId: $stateId }) { success }
		}`,
		{ id: issue.id, stateId: await stateId(apiKey, name) }
	);
	if (!data.issueUpdate.success) {
		throw new Error(`Linear rejected the update of ${issue.identifier}`);
	}
	console.log(`${issue.identifier}: ${issue.state} -> ${name}`);
}

async function comment(
	apiKey: string,
	issue: LinearIssue,
	body: string
): Promise<void> {
	await linear(
		apiKey,
		`mutation ($issueId: String!, $body: String!) {
			commentCreate(input: { issueId: $issueId, body: $body }) { success }
		}`,
		{ body, issueId: issue.id }
	);
}

async function changedFiles(
	token: string,
	repo: string,
	pr: string
): Promise<string[]> {
	const files: string[] = [];
	for (let page = 1; page <= 30; page += 1) {
		const batch = await github<
			{ filename: string; previous_filename?: string }[]
		>(token, `/repos/${repo}/pulls/${pr}/files?per_page=100&page=${page}`);
		for (const file of batch) {
			files.push(file.filename);
			if (file.previous_filename) {
				files.push(file.previous_filename);
			}
		}
		if (batch.length < 100) {
			return files;
		}
	}
	throw new Error("the PR changes more files than the outcome step can list");
}

async function unresolvedThreads(
	token: string,
	repo: string,
	pr: string
): Promise<number> {
	const [owner, name] = repo.split("/");
	const data = await github<{
		data: {
			repository: {
				pullRequest: {
					reviewThreads: {
						pageInfo: { hasNextPage: boolean };
						nodes: { isResolved: boolean }[];
					};
				};
			};
		};
	}>(token, "/graphql", {
		body: {
			query: `query ($owner: String!, $name: String!, $pr: Int!) {
				repository(owner: $owner, name: $name) { pullRequest(number: $pr) {
					reviewThreads(first: 100) { pageInfo { hasNextPage } nodes { isResolved } }
				} }
			}`,
			variables: { name, owner, pr: Number(pr) },
		},
		method: "POST",
	});
	const threads = data.data.repository.pullRequest.reviewThreads;
	const open = threads.nodes.filter((thread) => !thread.isResolved).length;
	return threads.pageInfo.hasNextPage ? open + 1 : open;
}

function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		console.error(`review-outcome: ${name} is not set`);
		process.exit(1);
	}
	return value;
}

async function main(): Promise<void> {
	const token = requireEnv("GH_TOKEN");
	const repo = requireEnv("REPO");
	const pr = requireEnv("PR_NUMBER");
	const apiKey = process.env.LINEAR_API_KEY;
	if (!apiKey) {
		console.log(
			"::warning::LINEAR_API_KEY is not set; the Linear status stays as is and nothing is auto-merged."
		);
		return;
	}
	const pull = await github<{
		title: string;
		draft: boolean;
		base: { ref: string };
		head: { ref: string; sha: string; repo: { full_name: string } | null };
	}>(token, `/repos/${repo}/pulls/${pr}`);
	const identifier = issueIdentifier(pull.head.ref, pull.title);
	const issue = identifier ? await fetchIssue(apiKey, identifier) : null;
	const trailer =
		process.env.PUBLISHED === "true"
			? parseTrailer(process.env.TRAILER ?? "")
			: null;
	const decision = decideOutcome({
		baseRef: pull.base.ref,
		changedFiles: await changedFiles(token, repo, pr),
		ciState: requireEnv("CI_STATE"),
		draft: pull.draft,
		event: process.env.EVENT_ACTION ?? "",
		forkPr: pull.head.repo?.full_name !== repo,
		headSha: requireEnv("HEAD_SHA"),
		issue,
		maxAutoRounds: Number(requireEnv("MAX_AUTO_ROUNDS")),
		prHeadSha: pull.head.sha,
		round: Number(requireEnv("ROUND")),
		trailer,
		unresolvedThreads: await unresolvedThreads(token, repo, pr),
	});
	console.log(JSON.stringify({ identifier, ...decision }));
	if (!issue) {
		return;
	}
	if (decision.merge) {
		try {
			await github(token, `/repos/${repo}/pulls/${pr}/merge`, {
				body: { merge_method: "merge", sha: pull.head.sha },
				method: "PUT",
			});
			await github(
				token,
				`/repos/${repo}/actions/workflows/dev-deploy.yml/dispatches`,
				{
					body: { ref: "dev" },
					method: "POST",
				}
			);
			await setState(apiKey, issue, "Done");
			return;
		} catch (error) {
			console.log(`::warning::auto-merge failed: ${String(error)}`);
			decision.blockers.push("the merge request was rejected");
		}
	}
	if (decision.status && canMoveFrom(issue.state)) {
		await setState(apiKey, issue, decision.status);
	}
	const wantsMerge = hasAutoMergeLevel(issue);
	if (decision.status === "Needs Input") {
		await comment(
			apiKey,
			issue,
			`自動レビューが ${process.env.MAX_AUTO_ROUNDS} 巡のうちに approve になりませんでした。PR ${pull.title} (#${pr}) を確認してください。`
		);
	} else if (
		decision.status === "Ready to Merge" &&
		wantsMerge &&
		decision.blockers.length > 0
	) {
		await comment(
			apiKey,
			issue,
			`自動マージは行いませんでした（PR #${pr}）: ${decision.blockers.join("; ")}。人がマージしてください。`
		);
	}
}

if (import.meta.main) {
	await main();
}
