import { randomUUID } from "node:crypto";
import { appendFileSync } from "node:fs";
import { issueIdentifier, linear } from "./review-outcome";

interface IssueComment {
	author: string;
	body: string;
	createdAt: string;
}

interface IssueContext {
	comments: IssueComment[];
	description: string;
	identifier: string;
	project: string | null;
	state: string;
	title: string;
	url: string;
}

const MAX_CONTEXT_CHARS = 40_000;
const MAX_DESCRIPTION_CHARS = 20_000;
const TRUNCATED = "\n\n[truncated]";

function renderIssueContext(issue: IssueContext): string {
	const description = issue.description.trim() || "(empty)";
	const head = [
		`### ${issue.identifier}: ${issue.title}`,
		"",
		`State: ${issue.state} · Project: ${issue.project ?? "none"} · ${issue.url}`,
		"",
		"#### Description",
		"",
		description.length <= MAX_DESCRIPTION_CHARS
			? description
			: `${description.slice(0, MAX_DESCRIPTION_CHARS - TRUNCATED.length)}${TRUNCATED}`,
		"",
		"#### Comments (oldest first)",
		"",
	].join("\n");
	const sorted = [...issue.comments].sort((a, b) =>
		a.createdAt.localeCompare(b.createdAt)
	);
	const kept: string[] = [];
	let budget = MAX_CONTEXT_CHARS - head.length;
	for (let i = sorted.length - 1; i >= 0; i -= 1) {
		const comment = sorted[i] as IssueComment;
		const rendered = `##### ${comment.createdAt} — ${comment.author}\n\n${comment.body.trim()}\n`;
		if (rendered.length > budget) {
			break;
		}
		kept.unshift(rendered);
		budget -= rendered.length;
	}
	const omitted = sorted.length - kept.length;
	const notice =
		omitted > 0 ? [`(${omitted} older comments omitted for length)\n`] : [];
	const body = sorted.length === 0 ? ["(none)\n"] : [...notice, ...kept];
	return `${head}${body.join("\n")}`;
}

async function fetchIssueContext(
	apiKey: string,
	identifier: string
): Promise<IssueContext | null> {
	const data = await linear<{
		issue: {
			identifier: string;
			title: string;
			url: string;
			description: string | null;
			state: { name: string };
			project: { name: string } | null;
			comments: {
				nodes: {
					body: string;
					createdAt: string;
					user: { name: string } | null;
				}[];
			};
		} | null;
	}>(
		apiKey,
		`query ($id: String!) {
			issue(id: $id) {
				identifier title url description
				state { name }
				project { name }
				comments(first: 100) { nodes { body createdAt user { name } } }
			}
		}`,
		{ id: identifier }
	);
	if (!data.issue) {
		return null;
	}
	return {
		identifier: data.issue.identifier,
		title: data.issue.title,
		url: data.issue.url,
		description: data.issue.description ?? "",
		state: data.issue.state.name,
		project: data.issue.project?.name ?? null,
		comments: data.issue.comments.nodes
			.filter((comment) => comment.user !== null)
			.map((comment) => ({
				author: comment.user?.name ?? "",
				body: comment.body,
				createdAt: comment.createdAt,
			})),
	};
}

async function resolveContext(): Promise<string> {
	const headRef = process.env.HEAD_REF ?? "";
	const identifier = issueIdentifier(headRef, process.env.PR_TITLE ?? "");
	if (!identifier) {
		return `No Linear issue is linked: the branch \`${headRef}\` is not \`feature/sa2-<n>\`, or the PR title names a different SA2 issue.`;
	}
	const apiKey = process.env.LINEAR_API_KEY;
	if (!apiKey) {
		console.log(
			"::warning::LINEAR_API_KEY is not set; the issue was not fetched."
		);
		return `${identifier} was not fetched: LINEAR_API_KEY is not set.`;
	}
	try {
		const issue = await fetchIssueContext(apiKey, identifier);
		return issue
			? renderIssueContext(issue)
			: `${identifier} does not exist in Linear.`;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.log(`::warning::${identifier} could not be fetched: ${message}`);
		return `${identifier} could not be fetched: ${message}`;
	}
}

async function main(): Promise<void> {
	const context = await resolveContext();
	const output = process.env.GITHUB_OUTPUT;
	if (!output) {
		console.log(context);
		return;
	}
	const delimiter = `ISSUE_CONTEXT_${randomUUID()}`;
	appendFileSync(output, `context<<${delimiter}\n${context}\n${delimiter}\n`);
	console.log(context.split("\n", 1)[0]);
}

if (import.meta.main) {
	await main();
}
