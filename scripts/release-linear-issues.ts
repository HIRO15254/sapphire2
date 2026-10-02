import { readFileSync } from "node:fs";

export interface MergedPullRequest {
	mergeCommit: { oid: string } | null;
	url: string;
}

export interface LinkedIssue {
	id: string;
	identifier: string;
	state: { name: string };
	team: { key: string };
}

const LINEAR_API = "https://api.linear.app/graphql";
const TEAM_KEY = "SA2";
const MERGED_STATE = "Done";
const RELEASED_STATE = "Released";
const WHITESPACE = /\s+/;

export function pullRequestsInRelease(
	pullRequests: MergedPullRequest[],
	releaseCommits: Set<string>
): string[] {
	return pullRequests
		.filter(
			(pr) => pr.mergeCommit !== null && releaseCommits.has(pr.mergeCommit.oid)
		)
		.map((pr) => pr.url);
}

export function issuesToRelease(linked: LinkedIssue[]): LinkedIssue[] {
	const byId = new Map<string, LinkedIssue>();
	for (const issue of linked) {
		if (issue.team.key === TEAM_KEY && issue.state.name === MERGED_STATE) {
			byId.set(issue.id, issue);
		}
	}
	return [...byId.values()].sort((a, b) =>
		a.identifier.localeCompare(b.identifier, "en", { numeric: true })
	);
}

async function linear<T>(
	apiKey: string,
	query: string,
	variables: Record<string, unknown> = {}
): Promise<T> {
	const response = await fetch(LINEAR_API, {
		method: "POST",
		headers: { "Content-Type": "application/json", Authorization: apiKey },
		body: JSON.stringify({ query, variables }),
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

async function linkedIssues(
	apiKey: string,
	url: string
): Promise<LinkedIssue[]> {
	const data = await linear<{
		attachmentsForURL: { nodes: { issue: LinkedIssue }[] };
	}>(
		apiKey,
		`query ($url: String!) {
			attachmentsForURL(url: $url) {
				nodes { issue { id identifier state { name } team { key } } }
			}
		}`,
		{ url }
	);
	return data.attachmentsForURL.nodes.map((node) => node.issue);
}

async function releasedStateId(apiKey: string): Promise<string> {
	const data = await linear<{ workflowStates: { nodes: { id: string }[] } }>(
		apiKey,
		`query ($team: String!, $name: String!) {
			workflowStates(filter: { team: { key: { eq: $team } }, name: { eq: $name } }) {
				nodes { id }
			}
		}`,
		{ team: TEAM_KEY, name: RELEASED_STATE }
	);
	const [state, ...others] = data.workflowStates.nodes;
	if (!state || others.length > 0) {
		throw new Error(
			`expected one "${RELEASED_STATE}" state in team ${TEAM_KEY}, found ${data.workflowStates.nodes.length}`
		);
	}
	return state.id;
}

async function main(args: string[]): Promise<void> {
	const dryRun = args.includes("--dry-run");
	const [commitsFile, pullRequestsFile] = args.filter(
		(arg) => arg !== "--dry-run"
	);
	if (!(commitsFile && pullRequestsFile)) {
		console.error(
			"release-linear-issues: pass the release commit list and the merged PR JSON (gh pr list --json url,mergeCommit)."
		);
		process.exit(2);
	}
	const apiKey = process.env.LINEAR_API_KEY;
	if (!apiKey) {
		console.log(
			"::warning::LINEAR_API_KEY is not set; the release's Linear issues stay in Done."
		);
		return;
	}
	const releaseCommits = new Set(
		readFileSync(commitsFile, "utf8").split(WHITESPACE).filter(Boolean)
	);
	const pullRequests = JSON.parse(
		readFileSync(pullRequestsFile, "utf8")
	) as MergedPullRequest[];
	const urls = pullRequestsInRelease(pullRequests, releaseCommits);
	const linked = (
		await Promise.all(urls.map((url) => linkedIssues(apiKey, url)))
	).flat();
	const targets = issuesToRelease(linked);
	console.log(
		`${urls.length} PRs in the release, ${targets.length} Done issues to move to ${RELEASED_STATE}.`
	);
	if (targets.length === 0) {
		return;
	}
	if (dryRun) {
		for (const issue of targets) {
			console.log(`would move ${issue.identifier}`);
		}
		return;
	}
	const stateId = await releasedStateId(apiKey);
	for (const issue of targets) {
		const data = await linear<{ issueUpdate: { success: boolean } }>(
			apiKey,
			`mutation ($id: String!, $stateId: String!) {
				issueUpdate(id: $id, input: { stateId: $stateId }) { success }
			}`,
			{ id: issue.id, stateId }
		);
		if (!data.issueUpdate.success) {
			throw new Error(`Linear rejected the update of ${issue.identifier}`);
		}
		console.log(`moved ${issue.identifier} to ${RELEASED_STATE}`);
	}
}

if (import.meta.main) {
	await main(process.argv.slice(2));
}
