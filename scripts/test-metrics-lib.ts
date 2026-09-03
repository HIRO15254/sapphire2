import { normalizeRulePath } from "./check-rules-path";
import {
	type Metrics,
	type MutationReport,
	metricsOf,
} from "./mutate-projects";

const IT_CALL = /(?:^|[^\w.$])(?:it|test)(?:\.each\([^)]*\))?\s*\(/g;
const AS_NEVER = /\bas never\b/g;
const REACT_QUERY_MOCK = /vi\.mock\(\s*["']@tanstack\/react-query["']/;
const SPEC_IN_DIR = /^(.*)\/__tests__\/([^/]+)\.test\.tsx?$/;
const SPEC_SIBLING = /^(.*)\/([^/]+)\.test\.tsx?$/;
const SOURCE_EXTENSION = /\.tsx?$/;
const REGEX_SPECIAL = /[.*+?^${}()|[\]\\]/g;
const COMPONENT_SPEC =
	/^apps\/web\/src\/(?:.*\/(?:components|pages)\/.*\.test\.tsx|__tests__\/[^/]+\.test\.tsx)$/;

export interface SpecStats {
	asNever: number;
	its: number;
	lines: number;
	mocksReactQuery: boolean;
	path: string;
}

export interface FileScoreDelta {
	after: Metrics;
	before: Metrics;
	file: string;
	noCoverageDelta: number;
	real: boolean;
	scoreDelta: number | null;
	survivedDelta: number;
}

export function countMatches(text: string, pattern: RegExp): number {
	return [...text.matchAll(pattern)].length;
}

export function countIts(text: string): number {
	return countMatches(text, IT_CALL);
}

export function isComponentSpec(path: string): boolean {
	return COMPONENT_SPEC.test(normalizeRulePath(path));
}

export function specStats(path: string, text: string): SpecStats {
	const normalized = normalizeRulePath(path);
	return {
		asNever: countMatches(text, AS_NEVER),
		its: countIts(text),
		lines: text.split("\n").length,
		mocksReactQuery: isComponentSpec(normalized) && REACT_QUERY_MOCK.test(text),
		path: normalized,
	};
}

export function sourceForSpec(specPath: string): string[] {
	const normalized = normalizeRulePath(specPath);
	const inDir = normalized.match(SPEC_IN_DIR);
	if (inDir) {
		return [`${inDir[1]}/${inDir[2]}.ts`, `${inDir[1]}/${inDir[2]}.tsx`];
	}
	const sibling = normalized.match(SPEC_SIBLING);
	if (sibling) {
		return [
			`${sibling[1]}/${sibling[2]}.ts`,
			`${sibling[1]}/${sibling[2]}.tsx`,
		];
	}
	return [];
}

export function siblingSpecCandidates(sourcePath: string): string[] {
	const normalized = normalizeRulePath(sourcePath);
	const slash = normalized.lastIndexOf("/");
	const dir = normalized.slice(0, slash);
	const base = normalized.slice(slash + 1).replace(SOURCE_EXTENSION, "");
	return [
		`${dir}/__tests__/${base}.test.ts`,
		`${dir}/__tests__/${base}.test.tsx`,
		`${dir}/${base}.test.ts`,
		`${dir}/${base}.test.tsx`,
	];
}

export function importPattern(sourcePath: string): RegExp {
	const base = normalizeRulePath(sourcePath)
		.split("/")
		.at(-1)
		?.replace(SOURCE_EXTENSION, "");
	const escaped = (base ?? "").replaceAll(REGEX_SPECIAL, "\\$&");
	return new RegExp(`from\\s+["'][^"']*\\/${escaped}(?:\\.tsx?)?["']`);
}

export function isImportedBy(specText: string, sourcePath: string): boolean {
	return importPattern(sourcePath).test(specText);
}

export function untestedSources(
	sources: string[],
	specs: { path: string; text: string }[]
): string[] {
	const specPaths = new Set(specs.map((spec) => normalizeRulePath(spec.path)));
	const untested: string[] = [];
	for (const source of sources) {
		const normalized = normalizeRulePath(source);
		if (siblingSpecCandidates(normalized).some((c) => specPaths.has(c))) {
			continue;
		}
		if (specs.some((spec) => isImportedBy(spec.text, normalized))) {
			continue;
		}
		untested.push(normalized);
	}
	return untested.sort();
}

export function fileScores(
	report: MutationReport
): { file: string; metrics: Metrics }[] {
	return Object.keys(report.files)
		.map((file) => ({
			file: normalizeRulePath(file),
			metrics: metricsOf(report, (name) => name === file),
		}))
		.sort((a, b) => (a.metrics.score ?? 101) - (b.metrics.score ?? 101));
}

export function compareFileScores(
	before: MutationReport,
	after: MutationReport
): FileScoreDelta[] {
	const files = new Set([
		...Object.keys(before.files).map(normalizeRulePath),
		...Object.keys(after.files).map(normalizeRulePath),
	]);
	const deltas: FileScoreDelta[] = [];
	for (const file of files) {
		const include = (name: string) => normalizeRulePath(name) === file;
		const b = metricsOf(before, include);
		const a = metricsOf(after, include);
		const scoreDelta =
			a.score === null || b.score === null ? null : a.score - b.score;
		const survivedDelta = a.survived - b.survived;
		const noCoverageDelta = a.noCoverage - b.noCoverage;
		deltas.push({
			after: a,
			before: b,
			file,
			noCoverageDelta,
			real:
				scoreDelta !== null &&
				scoreDelta < 0 &&
				(survivedDelta > 0 || noCoverageDelta > 0),
			scoreDelta,
			survivedDelta,
		});
	}
	return deltas.sort((a, b) => (a.scoreDelta ?? 0) - (b.scoreDelta ?? 0));
}

export function largeSpecs(
	stats: SpecStats[],
	limits: { its: number; lines: number } = { its: 30, lines: 600 }
): { byIts: SpecStats[]; byLines: SpecStats[] } {
	return {
		byIts: stats
			.filter((s) => s.its > limits.its)
			.sort((a, b) => b.its - a.its),
		byLines: stats
			.filter((s) => s.lines > limits.lines)
			.sort((a, b) => b.lines - a.lines),
	};
}
