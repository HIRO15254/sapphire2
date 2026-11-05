import type { StatsValuation } from "@sapphire2/db/schemas/stats-filter";
import { playMinutes } from "./entry-reads";
import type { StatsBucket, StatsEntry } from "./stats-data";
import {
	type MissingRate,
	type ValuationAmounts,
	type ValuationAsset,
	type ValuationLine,
	type ValuationRate,
	valueEntries,
} from "./valuation";

export type StatsMode =
	| { assetId: string; kind: "asset"; userBaseAssetId: string | null }
	| { baseAssetId: string; kind: "valuation"; valuation: StatsValuation }
	| { kind: "normalized"; userBaseAssetId: string | null };

export interface ValuationTables {
	assets: ValuationAsset[];
	rates: ValuationRate[];
}

export interface StatsCoverage {
	entryCount: number;
	excludedEntryCount: number;
	missingRates: MissingRate[];
	multiAssetEntryCount: number;
	otherAssetIds: string[];
	unavailableNormalizationEntryCount: number;
}

export interface StatsMetrics {
	averagePlacement: number | null;
	bb100: number | null;
	bbPerHour: number | null;
	cashEntryCount: number;
	evDiff: number | null;
	evProfitLoss: number | null;
	evRecordedEntryCount: number;
	handCount: number;
	handsPerHour: number | null;
	itmCount: number;
	itmRate: number | null;
	lossCount: number;
	playMinutes: number;
	roi: number | null;
	tournamentEntryCount: number;
	winCount: number;
	winRate: number | null;
}

export interface NormalizedBranch<Unit extends "bb" | "bi"> {
	entryCount: number;
	profitLoss: number;
	unavailableEntryCount: number;
	unit: Unit;
}

export interface StatsNormalized {
	cash: (NormalizedBranch<"bb"> & { evProfitLoss: number | null }) | null;
	tournament: NormalizedBranch<"bi"> | null;
}

export type StatsFigures = StatsCoverage &
	StatsMetrics & {
		amounts: ValuationAmounts | null;
		normalized: StatsNormalized | null;
	};

export const STATS_GROUP_BY = [
	"room",
	"stakes",
	"kind",
	"dayOfWeek",
	"length",
	"month",
	"year",
	"variant",
] as const;
export type StatsGroupBy = (typeof STATS_GROUP_BY)[number];

export interface StatsPoint {
	bigBlind: number | null;
	buyInTotal: number | null;
	evProfitLoss: number | null;
	evRecorded: boolean;
	id: string;
	kind: StatsEntry["kind"];
	playedOn: string;
	playMinutes: number | null;
	profitLoss: number | null;
	unit: "asset" | "bb" | "bi";
}

interface EntryFacts {
	amounts: ValuationAmounts | null;
	buyInTotal: number | null;
	entry: StatsEntry;
	evDiff: number | null;
	evNormalized: number | null;
	itm: boolean;
	missingRates: MissingRate[];
	normalized: number | null;
	otherAssetIds: string[];
	playMinutes: number | null;
	timed: boolean;
	value: number | null;
}

const ZERO_AMOUNTS: ValuationAmounts = { buyIn: 0, cashOut: 0, profitLoss: 0 };

function nativeAmounts(
	lines: { quantity: number }[]
): ValuationAmounts & { buyIn: number } {
	let buyIn = 0;
	let cashOut = 0;
	for (const line of lines) {
		if (line.quantity < 0) {
			buyIn -= line.quantity;
		} else {
			cashOut += line.quantity;
		}
	}
	return { buyIn, cashOut, profitLoss: cashOut - buyIn };
}

function toValuationLine(
	entryId: string,
	line: StatsEntry["lines"][number]
): ValuationLine {
	return {
		entryId,
		assetId: line.assetId,
		quantity: line.quantity,
		effect: line.effect,
		occurredAt: line.occurredAt,
	};
}

function compareLines(
	a: StatsEntry["lines"][number],
	b: StatsEntry["lines"][number]
): number {
	return (
		a.occurredAt.getTime() - b.occurredAt.getTime() || (a.id < b.id ? -1 : 1)
	);
}

export function initialPaymentLines(
	lines: StatsEntry["lines"]
): StatsEntry["lines"] {
	const first = lines
		.filter((line) => line.role === "buy_in")
		.sort(compareLines)[0];
	if (!first) {
		return [];
	}
	if (first.eventId !== null) {
		return lines.filter(
			(line) =>
				line.eventId === first.eventId &&
				(line.role === "buy_in" || line.role === "fee")
		);
	}
	if (first.priceId !== null) {
		return lines.filter(
			(line) =>
				line.priceId === first.priceId &&
				line.playSessionId === first.playSessionId &&
				(line.role === "buy_in" || line.role === "fee")
		);
	}
	const fee = lines
		.filter(
			(line) =>
				line.role === "fee" &&
				line.eventId === null &&
				line.priceId === null &&
				line.playSessionId === first.playSessionId
		)
		.sort(compareLines)[0];
	return fee ? [first, fee] : [first];
}

class NormalizationContext {
	readonly kinds: Map<string, ValuationAsset["kind"]>;
	readonly tables: ValuationTables;
	readonly baseAssetId: string | null;

	constructor(tables: ValuationTables, baseAssetId: string | null) {
		this.tables = tables;
		this.baseAssetId = baseAssetId;
		this.kinds = new Map(tables.assets.map((asset) => [asset.id, asset.kind]));
	}

	realCurrencyLines(entry: StatsEntry) {
		return entry.lines.filter(
			(line) =>
				line.effect === "real" && this.kinds.get(line.assetId) === "currency"
		);
	}

	cashNativeProfitLoss(entry: StatsEntry): number | null {
		const real = this.realCurrencyLines(entry);
		if (
			entry.assetId === null ||
			real.some((line) => line.assetId !== entry.assetId)
		) {
			return null;
		}
		return nativeAmounts(real).profitLoss;
	}

	entryUnits(entry: StatsEntry): {
		buyInTotal: number | null;
		evNormalized: number | null;
		normalized: number | null;
	} {
		if (entry.kind === "cash") {
			const profitLoss = this.cashNativeProfitLoss(entry);
			if (profitLoss === null || entry.bigBlind === null) {
				return { buyInTotal: null, evNormalized: null, normalized: null };
			}
			return {
				buyInTotal: null,
				normalized: profitLoss / entry.bigBlind,
				evNormalized:
					entry.evDiff === null
						? null
						: (profitLoss + entry.evDiff) / entry.bigBlind,
			};
		}
		const unit = this.tournamentUnit(entry);
		return unit
			? {
					buyInTotal: unit.buyInTotal,
					normalized: unit.profitLoss / unit.buyInTotal,
					evNormalized: null,
				}
			: { buyInTotal: null, evNormalized: null, normalized: null };
	}

	tournamentUnit(
		entry: StatsEntry
	): { buyInTotal: number; profitLoss: number } | null {
		const initial = initialPaymentLines(entry.lines);
		if (initial.length === 0) {
			return null;
		}
		const real = this.realCurrencyLines(entry);
		const assets = new Set([...real, ...initial].map((line) => line.assetId));
		if (assets.size === 1) {
			const buyInTotal = nativeAmounts(initial).buyIn;
			return buyInTotal > 0
				? { buyInTotal, profitLoss: nativeAmounts(real).profitLoss }
				: null;
		}
		if (this.baseAssetId === null) {
			return null;
		}
		const valued = valueEntries({
			...this.tables,
			baseAssetId: this.baseAssetId,
			lines: [
				...entry.lines.map((line) => toValuationLine("all", line)),
				...initial.map((line) => toValuationLine("initial", line)),
			],
		});
		const profitLoss = valued.entries.get("all")?.real?.profitLoss;
		const buyInTotal = valued.entries.get("initial")?.virtual?.buyIn;
		if (profitLoss === undefined || buyInTotal === undefined) {
			return null;
		}
		return buyInTotal > 0 ? { buyInTotal, profitLoss } : null;
	}
}

function lastOccurredAt(entry: StatsEntry): Date | null {
	let last: Date | null = null;
	for (const line of entry.lines) {
		if (last === null || line.occurredAt > last) {
			last = line.occurredAt;
		}
	}
	return last;
}

function valuedEvDiffs(
	entries: StatsEntry[],
	tables: ValuationTables,
	kinds: Map<string, ValuationAsset["kind"]>,
	mode: Extract<StatsMode, { kind: "valuation" }>
): Map<string, number> {
	const lines: ValuationLine[] = [];
	for (const entry of entries) {
		const occurredAt = lastOccurredAt(entry);
		if (
			entry.evDiff === null ||
			entry.assetId === null ||
			occurredAt === null ||
			(mode.valuation === "real" && kinds.get(entry.assetId) !== "currency")
		) {
			continue;
		}
		lines.push({
			entryId: entry.id,
			assetId: entry.assetId,
			quantity: entry.evDiff,
			effect: "real",
			occurredAt,
		});
	}
	const valued = valueEntries({
		...tables,
		baseAssetId: mode.baseAssetId,
		lines,
	});
	const result = new Map<string, number>();
	for (const [entryId, value] of valued.entries) {
		const amounts = value[mode.valuation];
		if (amounts) {
			result.set(entryId, amounts.profitLoss);
		}
	}
	return result;
}

function timing(entry: StatsEntry): {
	playMinutes: number | null;
	timed: boolean;
} {
	const complete = entry.plays.filter(
		(play) => play.startedAt !== null && play.endedAt !== null
	);
	return {
		playMinutes: complete.length > 0 ? playMinutes(complete) : null,
		timed: entry.plays.length > 0 && complete.length === entry.plays.length,
	};
}

export function computeEntryFacts(
	entries: StatsEntry[],
	mode: StatsMode,
	tables: ValuationTables
): EntryFacts[] {
	const normalization = new NormalizationContext(
		tables,
		mode.kind === "valuation" ? mode.baseAssetId : mode.userBaseAssetId
	);
	const valuation =
		mode.kind === "valuation"
			? valueEntries({
					...tables,
					baseAssetId: mode.baseAssetId,
					lines: entries.flatMap((entry) =>
						entry.lines.map((line) => toValuationLine(entry.id, line))
					),
				})
			: null;
	const valuedEv =
		mode.kind === "valuation"
			? valuedEvDiffs(entries, tables, normalization.kinds, mode)
			: null;
	return entries.map((entry) => {
		let amounts: ValuationAmounts | null = null;
		let missingRates: MissingRate[] = [];
		let otherAssetIds: string[] = [];
		let evDiff: number | null = null;
		if (mode.kind === "asset") {
			amounts = nativeAmounts(
				entry.lines.filter(
					(line) => line.assetId === mode.assetId && line.effect === "real"
				)
			);
			otherAssetIds = [
				...new Set(
					entry.lines
						.map((line) => line.assetId)
						.filter((assetId) => assetId !== mode.assetId)
				),
			];
			evDiff =
				entry.evDiff !== null && entry.assetId === mode.assetId
					? entry.evDiff
					: null;
		} else if (mode.kind === "valuation" && valuation) {
			const valued = valuation.entries.get(entry.id);
			amounts = valued ? valued[mode.valuation] : ZERO_AMOUNTS;
			missingRates = valued ? valued.missingRates[mode.valuation] : [];
			evDiff = valuedEv?.get(entry.id) ?? null;
		}

		const normalizedFacts = normalization.entryUnits(entry);

		return {
			entry,
			amounts,
			missingRates,
			otherAssetIds,
			evDiff,
			...normalizedFacts,
			itm: entry.lines.some((line) => line.role === "prize"),
			...timing(entry),
			value:
				mode.kind === "normalized"
					? normalizedFacts.normalized
					: (amounts?.profitLoss ?? null),
		};
	});
}

function mergeMissing(facts: EntryFacts[]): MissingRate[] {
	const earliest = new Map<string, Date>();
	for (const fact of facts) {
		for (const missing of fact.missingRates) {
			const current = earliest.get(missing.assetId);
			if (!current || missing.earliestOccurredAt < current) {
				earliest.set(missing.assetId, missing.earliestOccurredAt);
			}
		}
	}
	return [...earliest]
		.map(([assetId, earliestOccurredAt]) => ({ assetId, earliestOccurredAt }))
		.sort((a, b) => a.assetId.localeCompare(b.assetId));
}

export function statsCoverage(
	facts: EntryFacts[],
	mode: StatsMode
): StatsCoverage {
	const otherAssetIds = new Set(facts.flatMap((fact) => fact.otherAssetIds));
	return {
		entryCount: facts.length,
		excludedEntryCount:
			mode.kind === "valuation"
				? facts.filter((fact) => fact.amounts === null).length
				: 0,
		missingRates: mergeMissing(facts),
		multiAssetEntryCount: facts.filter((fact) => fact.otherAssetIds.length > 0)
			.length,
		otherAssetIds: [...otherAssetIds].sort(),
		unavailableNormalizationEntryCount:
			mode.kind === "normalized"
				? facts.filter((fact) => fact.normalized === null).length
				: 0,
	};
}

function ratio(numerator: number, denominator: number): number | null {
	return denominator === 0 ? null : numerator / denominator;
}

function percent(numerator: number, denominator: number): number | null {
	const value = ratio(numerator, denominator);
	return value === null ? null : value * 100;
}

function sum(values: number[]): number {
	return values.reduce((total, value) => total + value, 0);
}

function bbPerHour(facts: EntryFacts[]): number | null {
	const timed = facts.filter(
		(fact) =>
			fact.entry.kind === "cash" &&
			fact.normalized !== null &&
			fact.timed &&
			fact.playMinutes !== null
	);
	return ratio(
		sum(timed.map((fact) => fact.normalized ?? 0)),
		sum(timed.map((fact) => fact.playMinutes ?? 0)) / 60
	);
}

function bb100(facts: EntryFacts[]): number | null {
	const counted = facts.filter(
		(fact) =>
			fact.entry.kind === "cash" &&
			fact.normalized !== null &&
			fact.entry.handCount > 0
	);
	const value = ratio(
		sum(counted.map((fact) => fact.normalized ?? 0)),
		sum(counted.map((fact) => fact.entry.handCount))
	);
	return value === null ? null : value * 100;
}

function handsPerHour(facts: EntryFacts[]): number | null {
	const plays = facts.flatMap((fact) =>
		fact.entry.plays.filter(
			(play) =>
				play.handCount > 0 && play.startedAt !== null && play.endedAt !== null
		)
	);
	return ratio(
		sum(plays.map((play) => play.handCount)),
		playMinutes(plays) / 60
	);
}

function evMetrics(
	counted: EntryFacts[],
	mode: StatsMode
): Pick<StatsMetrics, "evDiff" | "evProfitLoss" | "evRecordedEntryCount"> {
	const cash = counted.filter((fact) => fact.entry.kind === "cash");
	if (mode.kind === "normalized") {
		return {
			evRecordedEntryCount: cash.filter((fact) => fact.evNormalized !== null)
				.length,
			evDiff: null,
			evProfitLoss: null,
		};
	}
	const recorded = cash.filter((fact) => fact.evDiff !== null);
	if (recorded.length === 0) {
		return { evRecordedEntryCount: 0, evDiff: null, evProfitLoss: null };
	}
	return {
		evRecordedEntryCount: recorded.length,
		evDiff: sum(recorded.map((fact) => fact.evDiff ?? 0)),
		evProfitLoss: sum(
			cash.map((fact) => (fact.value ?? 0) + (fact.evDiff ?? 0))
		),
	};
}

function sumAmounts(facts: EntryFacts[]): ValuationAmounts {
	const total = { buyIn: 0, cashOut: 0, profitLoss: 0 };
	for (const fact of facts) {
		if (fact.amounts) {
			total.buyIn += fact.amounts.buyIn;
			total.cashOut += fact.amounts.cashOut;
			total.profitLoss += fact.amounts.profitLoss;
		}
	}
	return total;
}

function normalizedBranches(facts: EntryFacts[]): StatsNormalized {
	const cash = facts.filter((fact) => fact.entry.kind === "cash");
	const tournaments = facts.filter((fact) => fact.entry.kind === "tournament");
	const cashCounted = cash.filter((fact) => fact.normalized !== null);
	const tournamentCounted = tournaments.filter(
		(fact) => fact.normalized !== null
	);
	const evRecorded = cashCounted.some((fact) => fact.evNormalized !== null);
	return {
		cash:
			cash.length === 0
				? null
				: {
						unit: "bb",
						entryCount: cashCounted.length,
						unavailableEntryCount: cash.length - cashCounted.length,
						profitLoss: sum(cashCounted.map((fact) => fact.normalized ?? 0)),
						evProfitLoss: evRecorded
							? sum(
									cashCounted.map(
										(fact) => fact.evNormalized ?? fact.normalized ?? 0
									)
								)
							: null,
					},
		tournament:
			tournaments.length === 0
				? null
				: {
						unit: "bi",
						entryCount: tournamentCounted.length,
						unavailableEntryCount:
							tournaments.length - tournamentCounted.length,
						profitLoss: sum(
							tournamentCounted.map((fact) => fact.normalized ?? 0)
						),
					},
	};
}

export function summarizeFacts(
	facts: EntryFacts[],
	mode: StatsMode
): StatsFigures {
	const counted = facts.filter((fact) => fact.value !== null);
	const tournaments = counted.filter(
		(fact) => fact.entry.kind === "tournament"
	);
	const placements = tournaments.flatMap((fact) =>
		fact.entry.placement === null ? [] : [fact.entry.placement]
	);
	const winCount = counted.filter((fact) => (fact.value ?? 0) > 0).length;
	const itmCount = tournaments.filter((fact) => fact.itm).length;
	const monetary = mode.kind !== "normalized";
	const tournamentAmounts = sumAmounts(tournaments);
	const roi = percent(tournamentAmounts.profitLoss, tournamentAmounts.buyIn);
	return {
		...statsCoverage(facts, mode),
		winCount,
		lossCount: counted.filter((fact) => (fact.value ?? 0) < 0).length,
		winRate: percent(winCount, counted.length),
		playMinutes: sum(counted.map((fact) => fact.playMinutes ?? 0)),
		handCount: sum(counted.map((fact) => fact.entry.handCount)),
		cashEntryCount: counted.length - tournaments.length,
		tournamentEntryCount: tournaments.length,
		itmCount,
		itmRate: percent(itmCount, tournaments.length),
		averagePlacement: ratio(sum(placements), placements.length),
		roi: monetary ? roi : null,
		bbPerHour: bbPerHour(facts),
		bb100: bb100(facts),
		handsPerHour: handsPerHour(counted),
		...evMetrics(counted, mode),
		amounts: monetary ? sumAmounts(counted) : null,
		normalized: monetary ? null : normalizedBranches(facts),
	};
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const LENGTH_BUCKETS = [
	{ key: "<1h", below: 60 },
	{ key: "1-2h", below: 120 },
	{ key: "2-4h", below: 240 },
	{ key: "4-8h", below: 480 },
	{ key: "8h+", below: Number.POSITIVE_INFINITY },
] as const;

const LENGTH_ORDER = [...LENGTH_BUCKETS.map((bucket) => bucket.key), "unknown"];

const KIND_LABELS = { cash: "Cash game", tournament: "Tournament" } as const;

function lengthBucket(fact: EntryFacts): StatsBucket {
	if (!fact.timed || fact.playMinutes === null) {
		return { key: "unknown", label: "Unknown" };
	}
	const minutes = fact.playMinutes;
	const bucket = LENGTH_BUCKETS.find((candidate) => minutes < candidate.below);
	const key = bucket?.key ?? "8h+";
	return { key, label: key };
}

export function groupBucket(
	fact: EntryFacts,
	groupBy: StatsGroupBy
): StatsBucket {
	const { entry } = fact;
	switch (groupBy) {
		case "room":
			return {
				key: entry.roomId ?? "none",
				label: entry.roomName ?? "No room",
			};
		case "kind":
			return { key: entry.kind, label: KIND_LABELS[entry.kind] };
		case "stakes":
			return entry.stakes;
		case "variant":
			return entry.variant;
		case "length":
			return lengthBucket(fact);
		case "dayOfWeek": {
			const day = new Date(`${entry.playedOn}T00:00:00.000Z`).getUTCDay();
			return { key: String(day), label: DAY_LABELS[day] ?? String(day) };
		}
		case "month":
			return {
				key: entry.playedOn.slice(0, 7),
				label: entry.playedOn.slice(0, 7),
			};
		default:
			return {
				key: entry.playedOn.slice(0, 4),
				label: entry.playedOn.slice(0, 4),
			};
	}
}

function compareGroups(groupBy: StatsGroupBy) {
	return (
		a: StatsBucket & { entryCount: number },
		b: StatsBucket & { entryCount: number }
	): number => {
		switch (groupBy) {
			case "dayOfWeek":
				return Number(a.key) - Number(b.key);
			case "length":
				return LENGTH_ORDER.indexOf(a.key) - LENGTH_ORDER.indexOf(b.key);
			case "month":
			case "year":
				return a.key.localeCompare(b.key);
			default:
				return (
					b.entryCount - a.entryCount ||
					a.label.localeCompare(b.label) ||
					a.key.localeCompare(b.key)
				);
		}
	};
}

export function breakdownFacts(
	facts: EntryFacts[],
	mode: StatsMode,
	groupBy: StatsGroupBy
): (StatsBucket & StatsFigures)[] {
	const groups = new Map<
		string,
		{ bucket: StatsBucket; facts: EntryFacts[] }
	>();
	for (const fact of facts) {
		const bucket = groupBucket(fact, groupBy);
		const group = groups.get(bucket.key);
		if (group) {
			group.facts.push(fact);
		} else {
			groups.set(bucket.key, { bucket, facts: [fact] });
		}
	}
	return [...groups.values()]
		.map(({ bucket, facts: members }) => ({
			key: bucket.key,
			label: bucket.label,
			...summarizeFacts(members, mode),
		}))
		.sort(compareGroups(groupBy));
}

export function seriesPoints(
	facts: EntryFacts[],
	mode: StatsMode
): StatsPoint[] {
	return [...facts]
		.sort(
			(a, b) =>
				a.entry.playedOn.localeCompare(b.entry.playedOn) ||
				(a.entry.id < b.entry.id ? -1 : 1)
		)
		.map((fact) => {
			const normalized = mode.kind === "normalized";
			let evProfitLoss: number | null = null;
			if (normalized) {
				evProfitLoss = fact.evNormalized;
			} else if (fact.value !== null && fact.evDiff !== null) {
				evProfitLoss = fact.value + fact.evDiff;
			}
			let unit: StatsPoint["unit"] = "asset";
			if (normalized) {
				unit = fact.entry.kind === "cash" ? "bb" : "bi";
			}
			return {
				id: fact.entry.id,
				kind: fact.entry.kind,
				playedOn: fact.entry.playedOn,
				profitLoss: fact.value,
				evProfitLoss,
				evRecorded: fact.entry.evDiff !== null,
				playMinutes: fact.playMinutes,
				bigBlind: fact.entry.bigBlind,
				buyInTotal: fact.buyInTotal,
				unit,
			};
		});
}
