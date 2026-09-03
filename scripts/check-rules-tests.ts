export interface SmokeOnlyHit {
	line: number;
	name: string;
}

export const SMOKE_MATCHERS: readonly string[] = ["toBeDefined", "toBeTruthy"];

const BLOCK_START = /(?<![\w.$])(?:it|test)(?:\s*\.\s*each)?\s*\(/g;
const EXPECT_CALL = /(?<![\w.$])expect\s*\(/g;
const CHAIN_STEP = /^\s*\.\s*([A-Za-z_$][\w$]*)/;
const NAME_LITERAL = /^\s*(["'`])((?:\\.|(?!\1).)*)\1/;
const REGEX_PRECEDER = /[(,=:[!&|?{};+\-*%<>~^]/;
const WHITESPACE = /\s/;

interface Scan {
	input: string;
	output: string[];
	position: number;
}

function blank(scan: Scan, count: number): void {
	for (let i = 0; i < count; i += 1) {
		const char = scan.input[scan.position + i] ?? "";
		scan.output.push(char === "\n" ? "\n" : " ");
	}
	scan.position += count;
}

function keep(scan: Scan, count: number): void {
	for (let i = 0; i < count; i += 1) {
		scan.output.push(scan.input[scan.position + i] ?? "");
	}
	scan.position += count;
}

function skipQuoted(scan: Scan, quote: string): void {
	keep(scan, 1);
	while (scan.position < scan.input.length) {
		const char = scan.input[scan.position];
		if (char === "\\") {
			blank(scan, 2);
			continue;
		}
		if (char === quote) {
			keep(scan, 1);
			return;
		}
		if (char === "\n" && quote !== "`") {
			return;
		}
		blank(scan, 1);
	}
}

function skipLineComment(scan: Scan): void {
	while (
		scan.position < scan.input.length &&
		scan.input[scan.position] !== "\n"
	) {
		blank(scan, 1);
	}
}

function skipBlockComment(scan: Scan): void {
	blank(scan, 2);
	while (scan.position < scan.input.length) {
		if (scan.input.startsWith("*/", scan.position)) {
			blank(scan, 2);
			return;
		}
		blank(scan, 1);
	}
}

function skipRegex(scan: Scan): void {
	keep(scan, 1);
	let inClass = false;
	while (scan.position < scan.input.length) {
		const char = scan.input[scan.position];
		if (char === "\\") {
			blank(scan, 2);
			continue;
		}
		if (char === "\n") {
			return;
		}
		if (inClass) {
			inClass = char !== "]";
			blank(scan, 1);
			continue;
		}
		if (char === "[") {
			inClass = true;
			blank(scan, 1);
			continue;
		}
		if (char === "/") {
			keep(scan, 1);
			return;
		}
		blank(scan, 1);
	}
}

function startsRegex(output: string[]): boolean {
	for (let i = output.length - 1; i >= 0; i -= 1) {
		const char = output[i] ?? "";
		if (WHITESPACE.test(char)) {
			continue;
		}
		return REGEX_PRECEDER.test(char);
	}
	return true;
}

function skipSlash(scan: Scan): void {
	const next = scan.input[scan.position + 1];
	if (next === "/") {
		skipLineComment(scan);
	} else if (next === "*") {
		skipBlockComment(scan);
	} else if (startsRegex(scan.output)) {
		skipRegex(scan);
	} else {
		keep(scan, 1);
	}
}

export function maskNonCode(text: string): string {
	const scan: Scan = { input: text, output: [], position: 0 };
	while (scan.position < text.length) {
		const char = text[scan.position] ?? "";
		if (char === '"' || char === "'" || char === "`") {
			skipQuoted(scan, char);
		} else if (char === "/") {
			skipSlash(scan);
		} else {
			keep(scan, 1);
		}
	}
	return scan.output.join("");
}

function balancedEnd(masked: string, openIndex: number): number {
	let depth = 0;
	for (let i = openIndex; i < masked.length; i += 1) {
		const char = masked[i];
		if (char === "(") {
			depth += 1;
		} else if (char === ")") {
			depth -= 1;
			if (depth === 0) {
				return i;
			}
		}
	}
	return masked.length - 1;
}

function skipWhitespace(masked: string, from: number): number {
	let index = from;
	while (index < masked.length && WHITESPACE.test(masked[index] ?? "")) {
		index += 1;
	}
	return index;
}

function callRange(
	masked: string,
	match: RegExpExecArray
): [number, number] | null {
	const openIndex = match.index + match[0].length - 1;
	if (!match[0].includes("each")) {
		return [openIndex, balancedEnd(masked, openIndex)];
	}
	const argsEnd = balancedEnd(masked, openIndex);
	const callOpen = skipWhitespace(masked, argsEnd + 1);
	if (masked[callOpen] !== "(") {
		return null;
	}
	return [callOpen, balancedEnd(masked, callOpen)];
}

function terminalMatcher(masked: string, closeIndex: number): string | null {
	let position = closeIndex + 1;
	let terminal: string | null = null;
	for (;;) {
		const step = CHAIN_STEP.exec(masked.slice(position));
		if (step === null) {
			return terminal;
		}
		position += step[0].length;
		const next = skipWhitespace(masked, position);
		if (masked[next] !== "(") {
			continue;
		}
		terminal = step[1] ?? null;
		position = balancedEnd(masked, next) + 1;
	}
}

function isSmokeOnly(
	masked: string,
	bodyStart: number,
	bodyEnd: number
): boolean {
	const body = masked.slice(bodyStart, bodyEnd);
	let expects = 0;
	for (const call of body.matchAll(EXPECT_CALL)) {
		expects += 1;
		const openIndex = bodyStart + call.index + call[0].length - 1;
		const terminal = terminalMatcher(masked, balancedEnd(masked, openIndex));
		if (terminal === null || !SMOKE_MATCHERS.includes(terminal)) {
			return false;
		}
	}
	return expects > 0;
}

function lineOf(text: string, index: number): number {
	let line = 1;
	for (let i = 0; i < index; i += 1) {
		if (text[i] === "\n") {
			line += 1;
		}
	}
	return line;
}

function nameAt(text: string, callOpen: number): string {
	const literal = NAME_LITERAL.exec(text.slice(callOpen + 1, callOpen + 400));
	return literal?.[2] ?? "?";
}

export function findSmokeOnlyTests(text: string): SmokeOnlyHit[] {
	const masked = maskNonCode(text);
	const hits: SmokeOnlyHit[] = [];
	for (const match of masked.matchAll(BLOCK_START)) {
		const range = callRange(masked, match);
		if (range === null) {
			continue;
		}
		const [callOpen, callClose] = range;
		if (isSmokeOnly(masked, callOpen + 1, callClose)) {
			hits.push({
				line: lineOf(masked, match.index),
				name: nameAt(text, callOpen),
			});
		}
	}
	return hits;
}
