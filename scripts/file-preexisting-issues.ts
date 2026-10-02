import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export interface PreExistingFinding {
	evidence: string;
	file: string;
	line: number;
	title: string;
	type: "bug" | "improvement";
}

export interface IssueInput {
	description: string;
	fingerprint: string;
	title: string;
	type: PreExistingFinding["type"];
}

export const MAX_FILED_PER_REVIEW = 3;

const LINEAR_API = "https://api.linear.app/graphql";
const TEAM_KEY = "SA2";
const TRIAGE_TYPE = "triage";
const SOURCE_LABEL = "review";
const TYPE_LABELS = { bug: "Bug", improvement: "Improvement" } as const;
const PRIORITY_MEDIUM = 3;
const ESTIMATE_S = 2;
const WHITESPACE = /\s+/g;

function isFinding(value: unknown): value is PreExistingFinding {
	if (typeof value !== "object" || value === null) {
		return false;
	}
	const finding = value as Record<string, unknown>;
	return (
		typeof finding.file === "string" &&
		finding.file.length > 0 &&
		Number.isInteger(finding.line) &&
		typeof finding.title === "string" &&
		finding.title.length > 0 &&
		typeof finding.evidence === "string" &&
		finding.evidence.length > 0 &&
		(finding.type === "bug" || finding.type === "improvement")
	);
}

export function parsePreExisting(trailerJson: string): PreExistingFinding[] {
	let parsed: unknown;
	try {
		parsed = JSON.parse(trailerJson);
	} catch {
		return [];
	}
	const list = (parsed as { preExisting?: unknown } | null)?.preExisting;
	if (!Array.isArray(list)) {
		return [];
	}
	return list.filter(isFinding).slice(0, MAX_FILED_PER_REVIEW);
}

export function fingerprint(finding: PreExistingFinding): string {
	const key = `${finding.file}\n${finding.title.toLowerCase().replace(WHITESPACE, " ").trim()}`;
	return `review-${createHash("sha256").update(key).digest("hex").slice(0, 16)}`;
}

export function buildIssue(
	finding: PreExistingFinding,
	pr: { number: number; url: string }
): IssueInput {
	const id = fingerprint(finding);
	return {
		title: finding.title,
		type: finding.type,
		fingerprint: id,
		description: [
			"## Problem",
			finding.title,
			"",
			"## Evidence",
			`- \`${finding.file}:${finding.line}\``,
			finding.evidence,
			"",
			`Found by the automated review of ${pr.url} (#${pr.number}) as a problem that predates that PR.`,
			"",
			`<!-- audit-fingerprint: ${id} -->`,
		].join("\n"),
	};
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

interface TeamSetup {
	labels: Map<string, string>;
	teamId: string;
	triageStateId: string;
}

async function loadTeam(apiKey: string): Promise<TeamSetup> {
	const data = await linear<{
		teams: {
			nodes: {
				id: string;
				labels: { nodes: { id: string; name: string }[] };
				states: { nodes: { id: string; type: string }[] };
			}[];
		};
	}>(
		apiKey,
		`query ($key: String!) {
			teams(filter: { key: { eq: $key } }) {
				nodes {
					id
					states { nodes { id type } }
					labels(first: 100) { nodes { id name } }
				}
			}
		}`,
		{ key: TEAM_KEY }
	);
	const team = data.teams.nodes[0];
	const triage = team?.states.nodes.find((state) => state.type === TRIAGE_TYPE);
	if (!(team && triage)) {
		throw new Error(
			`team ${TEAM_KEY} has no Triage state; enable Triage first`
		);
	}
	return {
		teamId: team.id,
		triageStateId: triage.id,
		labels: new Map(team.labels.nodes.map((label) => [label.name, label.id])),
	};
}

async function alreadyFiled(apiKey: string, id: string): Promise<boolean> {
	const data = await linear<{ issues: { nodes: { id: string }[] } }>(
		apiKey,
		`query ($key: String!, $text: String!) {
			issues(filter: { team: { key: { eq: $key } }, description: { contains: $text } }) {
				nodes { id }
			}
		}`,
		{ key: TEAM_KEY, text: id }
	);
	return data.issues.nodes.length > 0;
}

async function main(args: string[]): Promise<void> {
	const dryRun = args.includes("--dry-run");
	const [trailerFile] = args.filter((arg) => arg !== "--dry-run");
	const prNumber = Number(process.env.PR_NUMBER);
	const prUrl = process.env.PR_URL ?? "";
	if (!(trailerFile && prNumber)) {
		console.error(
			"file-preexisting-issues: pass the trailer JSON file; set PR_NUMBER and PR_URL."
		);
		process.exit(2);
	}
	const findings = parsePreExisting(readFileSync(trailerFile, "utf8"));
	console.log(
		`${findings.length} pre-existing findings in the review trailer.`
	);
	if (findings.length === 0) {
		return;
	}
	const apiKey = process.env.LINEAR_API_KEY;
	if (!apiKey) {
		console.log(
			"::warning::LINEAR_API_KEY is not set; pre-existing findings were not filed."
		);
		return;
	}
	const team = await loadTeam(apiKey);
	const sourceLabel = team.labels.get(SOURCE_LABEL);
	if (!sourceLabel) {
		throw new Error(`label "${SOURCE_LABEL}" (group source) is missing`);
	}
	for (const finding of findings) {
		const issue = buildIssue(finding, { number: prNumber, url: prUrl });
		if (await alreadyFiled(apiKey, issue.fingerprint)) {
			console.log(`already filed: ${finding.file} ${finding.title}`);
			continue;
		}
		const typeLabel = team.labels.get(TYPE_LABELS[issue.type]);
		if (dryRun) {
			console.log(`would file: ${issue.title}`);
			continue;
		}
		const created = await linear<{
			issueCreate: { issue: { identifier: string } | null; success: boolean };
		}>(
			apiKey,
			`mutation ($input: IssueCreateInput!) {
				issueCreate(input: $input) { success issue { identifier } }
			}`,
			{
				input: {
					teamId: team.teamId,
					stateId: team.triageStateId,
					title: issue.title,
					description: issue.description,
					priority: PRIORITY_MEDIUM,
					estimate: ESTIMATE_S,
					labelIds: [sourceLabel, typeLabel].filter(Boolean),
				},
			}
		);
		console.log(
			`filed ${created.issueCreate.issue?.identifier ?? "?"}: ${issue.title}`
		);
	}
}

if (import.meta.main) {
	main(process.argv.slice(2)).catch((error) => {
		console.error(`::warning::file-preexisting-issues failed: ${error}`);
	});
}
