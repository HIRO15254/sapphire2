export const UNTESTED_CONTRACTS: Readonly<Record<string, string>> = {
	"C-AI-OUTPUT-BUDGET": "SA2-686",
	"C-API-NO-STACK": "SA2-686",
	"C-ASSET-IN-USE": "SA2-685",
	"C-AUDIT-DIFF-MODE": "SA2-687",
	"C-AUDIT-STALE-FIRST": "SA2-687",
	"C-ENTRY-PLAYED-ON": "SA2-686",
	"C-LINEUP-LIVE-SEATS": "SA2-686",
	"C-MONEY-ASSET-EFFECT": "SA2-686",
	"C-OAUTH-CONNECTED-CLIENTS": "SA2-686",
	"C-OAUTH-REVOKE": "SA2-686",
	"C-OPTIMISTIC-BASELINE": "SA2-687",
	"C-OPTIMISTIC-REPLACE-SETTLED": "SA2-687",
	"C-OPTIMISTIC-ROLLBACK": "SA2-687",
	"C-OWNERSHIP-UNIFORM": "SA2-686",
	"C-PLAYER-SEARCH-CASE": "SA2-686",
	"C-PR-WATCH-RESUME": "SA2-687",
	"C-PR-WATCH-UNTRUSTED-TEXT": "SA2-687",
	"C-PRESET-STATS-MODE": "SA2-685",
	"C-STATS-BB-PER-HOUR": "SA2-685",
	"C-STATS-BB-UNIT": "SA2-685",
	"C-STATS-STAKES-KEY": "SA2-685",
	"C-STATS-VARIANT-KEY": "SA2-685",
	"C-UPDATE-NOTES-AUTO-OPEN": "SA2-687",
	"C-VALUATION-CANDIDATE-ORDER": "SA2-685",
	"C-VALUATION-ITEM-HOP": "SA2-685",
	"C-VALUATION-RATE-PATH-GROUPS": "SA2-685",
	"C-VALUATION-ROUNDING": "SA2-685",
};

export interface SourceFile {
	path: string;
	text: string;
}

export interface ContractLocation {
	id: string;
	where: string;
}

export type ContractProblemKind =
	| "duplicate"
	| "listed-but-cited"
	| "listed-but-undeclared"
	| "uncited"
	| "unknown-citation";

export interface ContractProblem {
	id: string;
	kind: ContractProblemKind;
	where: string;
}

const CONTRACT_ID = "C-[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+";
const DECLARATION = new RegExp(`\`(${CONTRACT_ID})\``, "gu");
const CITATION = new RegExp(String.raw`\b${CONTRACT_ID}\b`, "gu");
const TEST_CALL =
	/(?<![\w$.'"`])(?:describe|it|test)(?<modifiers>(?:\s*\.\s*(?:concurrent|describe|each|for|parallel|sequential|serial)\b)*)\s*\(/gu;
const TABLE_MODIFIER = /\b(?:each|for)\b/u;
const WHITESPACE = /\s/u;
const QUOTES = new Set(['"', "'", "`"]);
const OPENERS = new Set(["(", "[", "{"]);
const CLOSERS = new Set([")", "]", "}"]);

function lineAt(text: string, index: number): number {
	return text.slice(0, index).split("\n").length;
}

function stringEnd(text: string, start: number): number {
	const quote = text[start];
	let index = start + 1;
	while (index < text.length && text[index] !== quote) {
		index += text[index] === "\\" ? 2 : 1;
	}
	return index + 1;
}

function closingBracket(text: string, open: number): number {
	let depth = 0;
	let index = open;
	while (index < text.length) {
		const char = text[index] ?? "";
		if (QUOTES.has(char)) {
			index = stringEnd(text, index);
			continue;
		}
		if (OPENERS.has(char)) {
			depth += 1;
		} else if (CLOSERS.has(char)) {
			depth -= 1;
			if (depth === 0) {
				return index;
			}
		}
		index += 1;
	}
	return -1;
}

function skipSpace(text: string, index: number): number {
	let next = index;
	while (next < text.length && WHITESPACE.test(text[next] ?? "")) {
		next += 1;
	}
	return next;
}

function titleStart(text: string, match: RegExpExecArray): number {
	const afterCall = match.index + match[0].length;
	if (!TABLE_MODIFIER.test(match.groups?.modifiers ?? "")) {
		return skipSpace(text, afterCall);
	}
	const close = closingBracket(text, afterCall - 1);
	if (close === -1) {
		return -1;
	}
	const call = skipSpace(text, close + 1);
	return text[call] === "(" ? skipSpace(text, call + 1) : -1;
}

export function testTitles(
	file: SourceFile
): { line: number; title: string }[] {
	const titles: { line: number; title: string }[] = [];
	for (const match of file.text.matchAll(TEST_CALL)) {
		const start = titleStart(file.text, match);
		if (start === -1 || !QUOTES.has(file.text[start] ?? "")) {
			continue;
		}
		const end = stringEnd(file.text, start);
		titles.push({
			line: lineAt(file.text, start),
			title: file.text.slice(start + 1, end - 1),
		});
	}
	return titles;
}

export function contractDeclarations(docs: SourceFile[]): ContractLocation[] {
	return docs.flatMap((doc) =>
		[...doc.text.matchAll(DECLARATION)].map((match) => ({
			id: match[1] ?? "",
			where: `${doc.path}:${lineAt(doc.text, match.index)}`,
		}))
	);
}

export function contractCitations(tests: SourceFile[]): ContractLocation[] {
	return tests.flatMap((file) =>
		testTitles(file).flatMap(({ line, title }) =>
			[...title.matchAll(CITATION)].map((match) => ({
				id: match[0],
				where: `${file.path}:${line}`,
			}))
		)
	);
}

function byId(locations: ContractLocation[]): Map<string, string[]> {
	const grouped = new Map<string, string[]>();
	for (const { id, where } of locations) {
		grouped.set(id, [...(grouped.get(id) ?? []), where]);
	}
	return grouped;
}

export function contractProblems(
	declarations: ContractLocation[],
	citations: ContractLocation[],
	untested: Readonly<Record<string, string>>
): ContractProblem[] {
	const declared = byId(declarations);
	const cited = byId(citations);
	const problems: ContractProblem[] = [];
	for (const [id, places] of declared) {
		const where = places.join(", ");
		const citedAt = cited.get(id);
		if (places.length > 1) {
			problems.push({ id, kind: "duplicate", where });
		}
		if (citedAt && id in untested) {
			problems.push({
				id,
				kind: "listed-but-cited",
				where: citedAt.join(", "),
			});
		} else if (!(citedAt || id in untested)) {
			problems.push({ id, kind: "uncited", where });
		}
	}
	for (const id of Object.keys(untested)) {
		if (!declared.has(id)) {
			problems.push({
				id,
				kind: "listed-but-undeclared",
				where: "scripts/contract-ids.ts",
			});
		}
	}
	for (const [id, places] of cited) {
		if (!declared.has(id)) {
			problems.push({ id, kind: "unknown-citation", where: places.join(", ") });
		}
	}
	return problems;
}

const PROBLEM_TEXT: Record<ContractProblemKind, string> = {
	duplicate: "is declared more than once; give each contract one ID",
	"listed-but-cited":
		"is now cited by a test title; delete it from UNTESTED_CONTRACTS in scripts/contract-ids.ts",
	"listed-but-undeclared":
		"is listed in UNTESTED_CONTRACTS but no docs/design file declares it",
	uncited:
		"has no running test whose title cites it; add the test with the ID in its title",
	"unknown-citation":
		"is cited by a test title but no docs/design file declares it",
};

export function describeContractProblem(problem: ContractProblem): string {
	return `${problem.where}: ${problem.id} ${PROBLEM_TEXT[problem.kind]}`;
}
