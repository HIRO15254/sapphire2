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
const CALL_HEAD = /(?<![\w$.])(?:describe|it|test)\b/gu;
const LEADING_NAME = /^\s*(?<name>[A-Za-z]+)/u;
const RUNNING_MODIFIERS = new Set([
	"concurrent",
	"describe",
	"each",
	"for",
	"parallel",
	"sequential",
	"serial",
	"shuffle",
]);
const DISABLING_MODIFIERS = new Set([
	"fails",
	"fixme",
	"runIf",
	"skip",
	"skipIf",
	"todo",
]);
const ARGUMENT_MODIFIERS = new Set(["each", "for", "runIf", "skipIf"]);
const DISABLING_OPTION = /\b(?:fails|skip|todo)\b/u;
const REGEX_PRECEDER = /(?:^|[!%&(*+,:;<=>?[^{|}~-])$/u;
const REGEX_KEYWORD =
	/\b(?:await|case|delete|do|else|in|instanceof|new|of|return|throw|typeof|void|yield)$/u;
const REGEX_FLAG = /[a-z]/u;
const WHITESPACE = /\s/u;
const QUOTES = new Set(['"', "'", "`"]);
const OPENERS = new Set(["(", "[", "{"]);
const CLOSERS = new Set([")", "]", "}"]);

interface TestCall {
	close: number;
	disabling: boolean;
	open: number;
	titleStart?: number;
}

function lineAt(text: string, index: number): number {
	return text.slice(0, index).split("\n").length;
}

function stringEnd(text: string, start: number): number {
	const quote = text[start];
	let index = start + 1;
	while (index < text.length && text[index] !== quote) {
		if (text[index] === "\n" && quote !== "`") {
			return index;
		}
		index += text[index] === "\\" ? 2 : 1;
	}
	return index + 1;
}

function templateChunkEnd(
	text: string,
	from: number
): { end: number; expression: boolean } {
	let index = from;
	while (index < text.length) {
		if (text[index] === "`") {
			return { end: index + 1, expression: false };
		}
		if (text.startsWith("${", index)) {
			return { end: index + 2, expression: true };
		}
		index += text[index] === "\\" ? 2 : 1;
	}
	return { end: text.length, expression: false };
}

function commentEnd(text: string, index: number): number {
	const lineComment = text.startsWith("//", index);
	if (!(lineComment || text.startsWith("/*", index))) {
		return -1;
	}
	const end = text.indexOf(lineComment ? "\n" : "*/", index + 2);
	if (end === -1) {
		return text.length;
	}
	return lineComment ? end : end + 2;
}

function regexEnd(text: string, index: number): number {
	const before = text.slice(Math.max(0, index - 64), index).trimEnd();
	if (!(REGEX_PRECEDER.test(before) || REGEX_KEYWORD.test(before))) {
		return -1;
	}
	let inClass = false;
	let next = index + 1;
	while (next < text.length && text[next] !== "\n") {
		const char = text[next];
		if (char === "/" && !inClass) {
			next += 1;
			while (REGEX_FLAG.test(text[next] ?? "")) {
				next += 1;
			}
			return next;
		}
		if (char === "[" || char === "]") {
			inClass = char === "[";
		}
		next += char === "\\" ? 2 : 1;
	}
	return -1;
}

function nonCodeEnd(text: string, index: number): number {
	const char = text[index] ?? "";
	if (char === '"' || char === "'") {
		return stringEnd(text, index);
	}
	if (char !== "/") {
		return -1;
	}
	const comment = commentEnd(text, index);
	return comment === -1 ? regexEnd(text, index) : comment;
}

function codeMask(text: string): Uint8Array {
	const code = new Uint8Array(text.length);
	const templates: number[] = [];
	let depth = 0;
	let index = 0;
	while (index < text.length) {
		const char = text[index] ?? "";
		const resumesTemplate = char === "}" && templates.at(-1) === depth;
		if (char === "`" || resumesTemplate) {
			if (resumesTemplate) {
				templates.pop();
			}
			const chunk = templateChunkEnd(text, index + 1);
			if (chunk.expression) {
				templates.push(depth);
			}
			index = chunk.end;
			continue;
		}
		const end = nonCodeEnd(text, index);
		if (end > index) {
			index = end;
			continue;
		}
		code[index] = 1;
		if (char === "{") {
			depth += 1;
		} else if (char === "}") {
			depth -= 1;
		}
		index += 1;
	}
	return code;
}

function closingBracket(text: string, code: Uint8Array, open: number): number {
	let depth = 0;
	for (let index = open; index < text.length; index += 1) {
		const char = text[index] ?? "";
		if (code[index] === 1 && OPENERS.has(char)) {
			depth += 1;
		} else if (code[index] === 1 && CLOSERS.has(char)) {
			depth -= 1;
			if (depth === 0) {
				return index;
			}
		}
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

function callOpen(
	text: string,
	code: Uint8Array,
	from: number
): { modifiers: string[]; open: number } | undefined {
	const modifiers: string[] = [];
	let awaitsArguments = false;
	let index = skipSpace(text, from);
	while (text[index] === "." || (text[index] === "(" && awaitsArguments)) {
		if (text[index] === "(") {
			const close = closingBracket(text, code, index);
			if (close === -1) {
				return;
			}
			awaitsArguments = false;
			index = skipSpace(text, close + 1);
			continue;
		}
		const match = LEADING_NAME.exec(text.slice(index + 1, index + 64));
		const name = match?.groups?.name;
		if (!(match && name)) {
			return;
		}
		modifiers.push(name);
		awaitsArguments = ARGUMENT_MODIFIERS.has(name);
		index = skipSpace(text, index + 1 + match[0].length);
	}
	return text[index] === "(" ? { modifiers, open: index } : undefined;
}

function testCalls(text: string, code: Uint8Array): TestCall[] {
	const calls: TestCall[] = [];
	for (const match of text.matchAll(CALL_HEAD)) {
		const call =
			code[match.index] === 1
				? callOpen(text, code, match.index + match[0].length)
				: undefined;
		const known = call?.modifiers.every(
			(name) => RUNNING_MODIFIERS.has(name) || DISABLING_MODIFIERS.has(name)
		);
		if (!(call && known)) {
			continue;
		}
		const start = skipSpace(text, call.open + 1);
		const close = closingBracket(text, code, call.open);
		calls.push({
			close: close === -1 ? text.length : close,
			disabling: call.modifiers.some((name) => DISABLING_MODIFIERS.has(name)),
			open: call.open,
			titleStart: QUOTES.has(text[start] ?? "") ? start : undefined,
		});
	}
	return calls;
}

function disabledByOptions(
	text: string,
	code: Uint8Array,
	titleStart: number
): boolean {
	const comma = skipSpace(text, stringEnd(text, titleStart));
	const open = skipSpace(text, comma + 1);
	if (text[comma] !== "," || text[open] !== "{") {
		return false;
	}
	const close = closingBracket(text, code, open);
	const keys = [...text.slice(open, close === -1 ? text.length : close)]
		.map((char, offset) => (code[open + offset] === 1 ? char : " "))
		.join("");
	return DISABLING_OPTION.test(keys);
}

function disabledRanges(
	text: string,
	code: Uint8Array,
	calls: TestCall[]
): [number, number][] {
	return calls.flatMap((call): [number, number][] => {
		if (call.titleStart === undefined) {
			if (!call.disabling) {
				return [];
			}
			const enclosing = calls
				.filter(({ close, open }) => open < call.open && call.open < close)
				.at(-1);
			return [
				[call.open, call.close],
				enclosing ? [enclosing.open, enclosing.close] : [0, text.length],
			];
		}
		return call.disabling || disabledByOptions(text, code, call.titleStart)
			? [[call.open, call.close]]
			: [];
	});
}

export function testTitles(
	file: SourceFile
): { line: number; title: string }[] {
	const code = codeMask(file.text);
	const calls = testCalls(file.text, code);
	const disabled = disabledRanges(file.text, code, calls);
	return calls.flatMap(({ open, titleStart }) => {
		if (
			titleStart === undefined ||
			disabled.some(([from, to]) => from <= open && open <= to)
		) {
			return [];
		}
		return [
			{
				line: lineAt(file.text, titleStart),
				title: file.text.slice(
					titleStart + 1,
					stringEnd(file.text, titleStart) - 1
				),
			},
		];
	});
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
