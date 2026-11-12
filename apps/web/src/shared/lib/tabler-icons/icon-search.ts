import { ICON_PICKER_ICONS } from "./suggested-icons";

export interface IconSearchEntry {
	name: string;
	nameTokens: Set<string>;
	tagText: string;
	tagTokens: Set<string>;
}

export interface IconSearchIndex {
	entries: IconSearchEntry[];
	suggestedRank: Map<string, number>;
}

const TOKEN_SPLIT = /[^a-z0-9]+/u;
const STOP_WORDS = new Set([
	"a",
	"an",
	"and",
	"at",
	"by",
	"for",
	"from",
	"in",
	"of",
	"on",
	"or",
	"the",
	"to",
	"with",
]);
const MIN_PARTIAL_LENGTH = 3;
const EXACT_MATCH_SCORE = 40;

function tokens(text: string): string[] {
	return text.toLowerCase().split(TOKEN_SPLIT).filter(Boolean);
}

export function buildIconSearchIndex(
	names: string[],
	tags: string[]
): IconSearchIndex {
	const curated = new Map<string, string>();
	const suggestedRank = new Map<string, number>();
	for (const group of ICON_PICKER_ICONS) {
		for (const [name, keywords] of group.icons) {
			curated.set(name, keywords);
			suggestedRank.set(name, suggestedRank.size);
		}
	}
	const entries = names.map((name, i) => {
		const tagText = `${tags[i] ?? ""} ${curated.get(name) ?? ""}`.trim();
		return {
			name,
			nameTokens: new Set(tokens(name)),
			tagText,
			tagTokens: new Set(tokens(tagText)),
		};
	});
	return { entries, suggestedRank };
}

function wordVariants(word: string): string[] {
	const variants = [word];
	if (word.length > 3 && word.endsWith("ies")) {
		variants.push(`${word.slice(0, -3)}y`);
	}
	if (word.length > 3 && word.endsWith("es")) {
		variants.push(word.slice(0, -2));
	}
	if (word.length > 2 && word.endsWith("s")) {
		variants.push(word.slice(0, -1));
	}
	return variants;
}

function exactScore(entry: IconSearchEntry, word: string): number {
	let best = 0;
	for (const variant of wordVariants(word)) {
		if (entry.name === variant) {
			return 100;
		}
		if (entry.nameTokens.has(variant)) {
			best = Math.max(best, 60);
		} else if (entry.tagTokens.has(variant)) {
			best = Math.max(best, EXACT_MATCH_SCORE);
		}
	}
	return best;
}

function wordScore(entry: IconSearchEntry, word: string): number {
	const exact = exactScore(entry, word);
	if (exact > 0) {
		return exact;
	}
	if (word.length < MIN_PARTIAL_LENGTH) {
		return entry.name.startsWith(word) ? 10 : 0;
	}
	if (entry.name.includes(word)) {
		return 20;
	}
	return entry.tagText.includes(word) ? 5 : 0;
}

function compareRanked(
	index: IconSearchIndex,
	a: { name: string; score: number },
	b: { name: string; score: number }
): number {
	if (a.score !== b.score) {
		return b.score - a.score;
	}
	const rankA = index.suggestedRank.get(a.name) ?? Number.POSITIVE_INFINITY;
	const rankB = index.suggestedRank.get(b.name) ?? Number.POSITIVE_INFINITY;
	if (rankA !== rankB) {
		return rankA < rankB ? -1 : 1;
	}
	if (a.name.length !== b.name.length) {
		return a.name.length - b.name.length;
	}
	return a.name < b.name ? -1 : 1;
}

export function searchIcons(index: IconSearchIndex, query: string): string[] {
	const words = tokens(query);
	if (words.length === 0) {
		return [];
	}
	const ranked: { name: string; score: number }[] = [];
	for (const entry of index.entries) {
		let score = 0;
		for (const word of words) {
			const s = wordScore(entry, word);
			if (s === 0) {
				score = 0;
				break;
			}
			score += s;
		}
		if (score > 0) {
			ranked.push({ name: entry.name, score });
		}
	}
	return ranked
		.sort((a, b) => compareRanked(index, a, b))
		.map((item) => item.name);
}

export function suggestIconFromWords(
	index: IconSearchIndex,
	text: string
): string {
	const words = tokens(text).filter(
		(word) => word.length > 1 && !STOP_WORDS.has(word)
	);
	if (words.length === 0) {
		return "";
	}
	let best: { name: string; score: number } | null = null;
	for (const entry of index.entries) {
		let score = 0;
		for (const word of words) {
			score += exactScore(entry, word);
		}
		if (score < EXACT_MATCH_SCORE) {
			continue;
		}
		const candidate = { name: entry.name, score };
		if (!best || compareRanked(index, candidate, best) < 0) {
			best = candidate;
		}
	}
	return best?.name ?? "";
}
