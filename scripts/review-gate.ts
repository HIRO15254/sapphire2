import {
	appendFileSync,
	existsSync,
	readFileSync,
	writeFileSync,
} from "node:fs";

export type GateEvent =
	| "opened"
	| "synchronize"
	| "reopened"
	| "ready_for_review"
	| "labeled";

export interface ReviewState {
	lastSha: string;
	rounds: number;
}

export interface ReviewResult {
	subtype: string;
	trailer: string | null;
}

export interface GateInput {
	changedSinceLast: string[] | null;
	devTree: string | null;
	draft: boolean;
	event: GateEvent;
	headRef: string;
	headSha: string;
	headTree: string;
	label: string | null;
	maxAutoRounds: number;
	reReviewLabel: string;
	state: ReviewState | null;
}

export type GateDecision =
	| { run: false; reason: string }
	| {
			run: true;
			mode: "full" | "incremental";
			round: number;
			sinceSha: string | null;
			reason: string;
	  };

export const STATE_MARKER = "<!-- pre-merge-review:state";
const MARKER_PATTERN = /<!-- pre-merge-review:state (?<payload>\{.*?\}) -->/u;
const SHA_PATTERN = /^[0-9a-f]{40}$/u;
const DOC_FILE = /\.md$/u;
const TRAILER_PATTERN = /<!-- pr-review: (?<payload>\{.*?\}) -->/gu;
const SUMMARY_HEADING_PATTERN = /^#{1,6}\s*レビュー結果/mu;

function nextRound(state: ReviewState | null, reason: string): GateDecision {
	return {
		mode: state ? "incremental" : "full",
		reason,
		round: (state?.rounds ?? 0) + 1,
		run: true,
		sinceSha: state?.lastSha ?? null,
	};
}

export function decideReview(input: GateInput): GateDecision {
	if (input.event === "labeled") {
		if (input.label !== input.reReviewLabel) {
			return {
				reason: `label ${input.label ?? ""} is not ${input.reReviewLabel}`,
				run: false,
			};
		}
		return nextRound(input.state, `label ${input.reReviewLabel}`);
	}
	if (input.draft) {
		return { reason: "draft", run: false };
	}
	if (
		input.headRef.startsWith("release/") &&
		input.devTree !== null &&
		input.headTree === input.devTree
	) {
		return { reason: "release branch tree identical to dev", run: false };
	}
	if (input.state?.lastSha === input.headSha) {
		return { reason: "head already reviewed", run: false };
	}
	const rounds = input.state?.rounds ?? 0;
	if (rounds >= input.maxAutoRounds) {
		return {
			reason: `automatic round cap (${input.maxAutoRounds}) reached; add the ${input.reReviewLabel} label`,
			run: false,
		};
	}
	if (input.state === null) {
		return nextRound(null, "first review");
	}
	const changed = input.changedSinceLast;
	if (
		changed !== null &&
		changed.length > 0 &&
		changed.every((path) => DOC_FILE.test(path))
	) {
		return { reason: "docs-only push", run: false };
	}
	return nextRound(
		input.state,
		`automatic round ${rounds + 1} of ${input.maxAutoRounds}`
	);
}

export function parseReviewState(commentBodies: string[]): ReviewState | null {
	for (let i = commentBodies.length - 1; i >= 0; i -= 1) {
		const match = MARKER_PATTERN.exec(commentBodies[i] ?? "");
		if (!match) {
			continue;
		}
		let payload: unknown;
		try {
			payload = JSON.parse(match.groups?.payload ?? "");
		} catch {
			return null;
		}
		if (typeof payload !== "object" || payload === null) {
			return null;
		}
		const { rounds, lastSha } = payload as Record<string, unknown>;
		if (!(Number.isInteger(rounds) && (rounds as number) >= 0)) {
			return null;
		}
		if (typeof lastSha !== "string" || !SHA_PATTERN.test(lastSha)) {
			return null;
		}
		return { lastSha, rounds: rounds as number };
	}
	return null;
}

export function renderStateComment(
	state: ReviewState,
	maxAutoRounds: number,
	reReviewLabel: string
): string {
	const payload = JSON.stringify({
		lastSha: state.lastSha,
		rounds: state.rounds,
	});
	const capReached = state.rounds >= maxAutoRounds;
	const status = capReached
		? `自動レビューは上限に達しました。次のレビューが必要な場合は \`${reReviewLabel}\` ラベルを付けてください（コード変更を含む push が対象です）。`
		: `次のコード変更を含む push（CI green 後）でもう 1 巡だけ自動レビューが走ります。それ以降は \`${reReviewLabel}\` ラベルで要求してください。`;
	return [
		`${STATE_MARKER} ${payload} -->`,
		`🔁 自動レビュー ${state.rounds} / ${maxAutoRounds} 巡（最終レビュー: \`${state.lastSha.slice(0, 8)}\`）`,
		"",
		status,
	].join("\n");
}

interface ResultEvent {
	result: string;
	subtype: string;
}

function collectResultEvents(node: unknown, found: ResultEvent[]): void {
	if (Array.isArray(node)) {
		for (const item of node) {
			collectResultEvents(item, found);
		}
		return;
	}
	if (typeof node !== "object" || node === null) {
		return;
	}
	const record = node as Record<string, unknown>;
	if (record.type === "result") {
		found.push({
			result: typeof record.result === "string" ? record.result : "",
			subtype: typeof record.subtype === "string" ? record.subtype : "",
		});
	}
	for (const value of Object.values(record)) {
		collectResultEvents(value, found);
	}
}

function parseJson(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		return undefined;
	}
}

export function extractReviewTrailer(finalMessage: string): string | null {
	let payload: string | null = null;
	for (const match of finalMessage.matchAll(TRAILER_PATTERN)) {
		const candidate = match.groups?.payload ?? "";
		const parsed = parseJson(candidate);
		if (
			typeof parsed === "object" &&
			parsed !== null &&
			!Array.isArray(parsed)
		) {
			payload = candidate;
		}
	}
	return payload;
}

export function hasPublishedSummary(trackingComment: string): boolean {
	return (
		SUMMARY_HEADING_PATTERN.test(trackingComment) ||
		extractReviewTrailer(trackingComment) !== null
	);
}

export function formatPublishedOutputs(trackingComment: string): string {
	return `is_published=${hasPublishedSummary(trackingComment)}\n`;
}

export function parseReviewResult(log: string): ReviewResult {
	const found: ResultEvent[] = [];
	const whole = parseJson(log);
	if (whole === undefined) {
		for (const line of log.split("\n")) {
			const value = parseJson(line.trim());
			if (value !== undefined) {
				collectResultEvents(value, found);
			}
		}
	} else {
		collectResultEvents(whole, found);
	}
	const last = found.at(-1);
	if (!last) {
		return { subtype: "", trailer: null };
	}
	return { subtype: last.subtype, trailer: extractReviewTrailer(last.result) };
}

export function formatSummaryOutputs(
	hasLog: boolean,
	result: ReviewResult
): string {
	return [
		`has_log=${hasLog}`,
		`has_summary=${result.trailer !== null}`,
		`subtype=${result.subtype.replace(/\s+/gu, " ")}`,
		"",
	].join("\n");
}

export function formatGithubOutputs(decision: GateDecision): string {
	const oneLine = (value: string) => value.replace(/\s*\n\s*/gu, " ");
	const lines = decision.run
		? [
				"run=true",
				`mode=${decision.mode}`,
				`round=${decision.round}`,
				`since_sha=${decision.sinceSha ?? ""}`,
				`reason=${oneLine(decision.reason)}`,
			]
		: [
				"run=false",
				"mode=",
				"round=0",
				"since_sha=",
				`reason=${oneLine(decision.reason)}`,
			];
	return `${lines.join("\n")}\n`;
}

function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		console.error(`review-gate: ${name} is not set`);
		process.exit(1);
	}
	return value;
}

function emitOutputs(outputs: string): void {
	const target = process.env.GITHUB_OUTPUT;
	if (target) {
		appendFileSync(target, outputs);
	}
	console.log(outputs.trimEnd());
}

function decideCommand(): void {
	const parsed = JSON.parse(requireEnv("GATE_INPUT")) as Omit<
		GateInput,
		"state"
	> & {
		stateComments: string[];
	};
	const decision = decideReview({
		...parsed,
		state: parseReviewState(parsed.stateComments),
	});
	const outputs = formatGithubOutputs(decision);
	emitOutputs(outputs);
}

function renderStateCommand(): void {
	console.log(
		renderStateComment(
			{ lastSha: requireEnv("LAST_SHA"), rounds: Number(requireEnv("ROUNDS")) },
			Number(requireEnv("MAX_AUTO_ROUNDS")),
			requireEnv("RE_REVIEW_LABEL")
		)
	);
}

function summaryCommand(): void {
	const runnerTemp = process.env.RUNNER_TEMP ?? ".";
	const candidates = [
		process.env.EXECUTION_FILE ?? "",
		`${runnerTemp}/claude-execution-output.json`,
	];
	const logPath = candidates.find((path) => path !== "" && existsSync(path));
	const result = logPath
		? parseReviewResult(readFileSync(logPath, "utf8"))
		: { subtype: "", trailer: null };
	if (result.trailer !== null) {
		writeFileSync(`${runnerTemp}/pr-review-trailer.json`, result.trailer);
	}
	emitOutputs(formatSummaryOutputs(logPath !== undefined, result));
}

function publishedCommand(): void {
	const path = process.env.TRACKING_COMMENT_FILE ?? "";
	const body =
		path !== "" && existsSync(path) ? readFileSync(path, "utf8") : "";
	emitOutputs(formatPublishedOutputs(body));
}

if (import.meta.main) {
	const command = process.argv[2] ?? "decide";
	if (command === "decide") {
		decideCommand();
	} else if (command === "render-state") {
		renderStateCommand();
	} else if (command === "summary") {
		summaryCommand();
	} else if (command === "published") {
		publishedCommand();
	} else if (command === "last-sha") {
		const comments = JSON.parse(requireEnv("STATE_COMMENTS")) as string[];
		console.log(parseReviewState(comments)?.lastSha ?? "");
	} else {
		console.error(`review-gate: unknown command ${command}`);
		process.exit(1);
	}
}
