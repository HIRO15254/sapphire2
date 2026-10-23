import type { AssetKind } from "@sapphire2/db/constants/asset";
import type { asset } from "@sapphire2/db/schema/asset";
import type { assetRate, ledgerLine } from "@sapphire2/db/schema/ledger";

export type ValuationAsset = Pick<typeof asset.$inferSelect, "id" | "kind">;

export type ValuationRate = Pick<
	typeof assetRate.$inferSelect,
	| "id"
	| "baseAssetId"
	| "quoteAssetId"
	| "rateNum"
	| "rateDen"
	| "effectiveFrom"
>;

export type ValuationLine = Pick<
	typeof ledgerLine.$inferSelect,
	"assetId" | "quantity" | "effect" | "occurredAt"
> & { entryId: string };

export interface ValuationInput {
	assets: ValuationAsset[];
	baseAssetId: string;
	lines: ValuationLine[];
	rates: ValuationRate[];
}

export interface ValuationAmounts {
	buyIn: number;
	cashOut: number;
	profitLoss: number;
}

export interface EntryValuation {
	real: ValuationAmounts | null;
	virtual: ValuationAmounts | null;
}

export interface MissingRate {
	assetId: string;
	earliestOccurredAt: Date;
}

export interface ValuationTotals extends ValuationAmounts {
	excludedEntryCount: number;
	missingRates: MissingRate[];
	roi: number | null;
}

export interface ValuationResult {
	entries: Map<string, EntryValuation>;
	real: ValuationTotals;
	virtual: ValuationTotals;
}

interface ConversionPath {
	den: bigint;
	key: string;
	num: bigint;
}

interface Bucket {
	path: ConversionPath;
	quantity: bigint;
}

interface ModeAccumulator {
	buyIn: bigint;
	cashOut: bigint;
	excludedEntryCount: number;
	missing: Map<string, Date>;
	profitLoss: bigint;
}

type RateIndex = Map<string, Map<string, ValuationRate[]>>;

const IDENTITY_PATH: ConversionPath = { key: "", num: 1n, den: 1n };

function indexRates(rates: ValuationRate[]): RateIndex {
	const index: RateIndex = new Map();
	for (const rate of rates) {
		let byQuote = index.get(rate.baseAssetId);
		if (!byQuote) {
			byQuote = new Map();
			index.set(rate.baseAssetId, byQuote);
		}
		const history = byQuote.get(rate.quoteAssetId);
		if (history) {
			history.push(rate);
		} else {
			byQuote.set(rate.quoteAssetId, [rate]);
		}
	}
	for (const byQuote of index.values()) {
		for (const history of byQuote.values()) {
			history.sort(
				(a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime()
			);
		}
	}
	return index;
}

function latestRate(
	history: ValuationRate[] | undefined,
	at: number
): ValuationRate | null {
	if (!history) {
		return null;
	}
	let low = 0;
	let high = history.length - 1;
	let found: ValuationRate | null = null;
	while (low <= high) {
		const mid = Math.floor((low + high) / 2);
		const rate = history[mid] as ValuationRate;
		if (rate.effectiveFrom.getTime() <= at) {
			found = rate;
			low = mid + 1;
		} else {
			high = mid - 1;
		}
	}
	return found;
}

function singleStep(
	index: RateIndex,
	from: string,
	to: string,
	at: number
): ConversionPath | null {
	const direct = latestRate(index.get(from)?.get(to), at);
	if (direct) {
		return {
			key: direct.id,
			num: BigInt(direct.rateNum),
			den: BigInt(direct.rateDen),
		};
	}
	const inverse = latestRate(index.get(to)?.get(from), at);
	if (inverse) {
		return {
			key: inverse.id,
			num: BigInt(inverse.rateDen),
			den: BigInt(inverse.rateNum),
		};
	}
	return null;
}

function resolvePath(
	index: RateIndex,
	kinds: Map<string, AssetKind>,
	baseAssetId: string,
	assetId: string,
	at: number
): ConversionPath | null {
	if (assetId === baseAssetId) {
		return IDENTITY_PATH;
	}
	const oneStep = singleStep(index, assetId, baseAssetId, at);
	if (oneStep || kinds.get(assetId) !== "item") {
		return oneStep;
	}
	const firstSteps: ValuationRate[] = [];
	for (const [quoteAssetId, history] of index.get(assetId) ?? []) {
		if (kinds.get(quoteAssetId) !== "currency") {
			continue;
		}
		const rate = latestRate(history, at);
		if (rate) {
			firstSteps.push(rate);
		}
	}
	firstSteps.sort(
		(a, b) =>
			b.effectiveFrom.getTime() - a.effectiveFrom.getTime() ||
			a.quoteAssetId.localeCompare(b.quoteAssetId)
	);
	for (const first of firstSteps) {
		const second = singleStep(index, first.quoteAssetId, baseAssetId, at);
		if (second) {
			return {
				key: `${first.id}>${second.key}`,
				num: BigInt(first.rateNum) * second.num,
				den: BigInt(first.rateDen) * second.den,
			};
		}
	}
	return null;
}

function roundHalfAwayFromZero(numerator: bigint, denominator: bigint): bigint {
	const negative = numerator < 0n;
	const magnitude = negative ? -numerator : numerator;
	const rounded = (2n * magnitude + denominator) / (2n * denominator);
	return negative ? -rounded : rounded;
}

function addToBucket(
	buckets: Map<string, Bucket>,
	assetId: string,
	path: ConversionPath,
	quantity: number
) {
	const key = `${assetId}|${path.key}`;
	const bucket = buckets.get(key);
	if (bucket) {
		bucket.quantity += BigInt(quantity);
	} else {
		buckets.set(key, { path, quantity: BigInt(quantity) });
	}
}

function sumBuckets(buckets: Map<string, Bucket>): bigint {
	let total = 0n;
	for (const { path, quantity } of buckets.values()) {
		total += roundHalfAwayFromZero(quantity * path.num, path.den);
	}
	return total;
}

function valueEntryLines(
	lines: ValuationLine[],
	resolve: (line: ValuationLine) => ConversionPath | null,
	accumulator: ModeAccumulator
): ValuationAmounts | null {
	const all = new Map<string, Bucket>();
	const payments = new Map<string, Bucket>();
	const receipts = new Map<string, Bucket>();
	let convertible = true;
	for (const line of lines) {
		const path = resolve(line);
		if (!path) {
			convertible = false;
			const earliest = accumulator.missing.get(line.assetId);
			if (!earliest || line.occurredAt < earliest) {
				accumulator.missing.set(line.assetId, line.occurredAt);
			}
			continue;
		}
		addToBucket(all, line.assetId, path, line.quantity);
		addToBucket(
			line.quantity < 0 ? payments : receipts,
			line.assetId,
			path,
			line.quantity
		);
	}
	if (!convertible) {
		accumulator.excludedEntryCount += 1;
		return null;
	}
	const profitLoss = sumBuckets(all);
	const buyIn = -sumBuckets(payments);
	const cashOut = sumBuckets(receipts);
	accumulator.profitLoss += profitLoss;
	accumulator.buyIn += buyIn;
	accumulator.cashOut += cashOut;
	return {
		profitLoss: Number(profitLoss),
		buyIn: Number(buyIn),
		cashOut: Number(cashOut),
	};
}

function toTotals(accumulator: ModeAccumulator): ValuationTotals {
	const profitLoss = Number(accumulator.profitLoss);
	const buyIn = Number(accumulator.buyIn);
	return {
		profitLoss,
		buyIn,
		cashOut: Number(accumulator.cashOut),
		roi: buyIn === 0 ? null : (profitLoss / buyIn) * 100,
		excludedEntryCount: accumulator.excludedEntryCount,
		missingRates: [...accumulator.missing]
			.map(([assetId, earliestOccurredAt]) => ({ assetId, earliestOccurredAt }))
			.sort((a, b) => a.assetId.localeCompare(b.assetId)),
	};
}

export function valueEntries(input: ValuationInput): ValuationResult {
	const kinds = new Map(input.assets.map((asset) => [asset.id, asset.kind]));
	const index = indexRates(input.rates);
	const pathCache = new Map<string, ConversionPath | null>();
	const resolve = (line: ValuationLine) => {
		const at = line.occurredAt.getTime();
		const cacheKey = `${line.assetId}|${at}`;
		if (pathCache.has(cacheKey)) {
			return pathCache.get(cacheKey) ?? null;
		}
		const path = resolvePath(index, kinds, input.baseAssetId, line.assetId, at);
		pathCache.set(cacheKey, path);
		return path;
	};

	const linesByEntry = new Map<string, ValuationLine[]>();
	for (const line of input.lines) {
		if (!kinds.has(line.assetId)) {
			throw new Error(`Unknown asset ${line.assetId} in ledger line`);
		}
		const entryLines = linesByEntry.get(line.entryId);
		if (entryLines) {
			entryLines.push(line);
		} else {
			linesByEntry.set(line.entryId, [line]);
		}
	}

	const real: ModeAccumulator = {
		buyIn: 0n,
		cashOut: 0n,
		excludedEntryCount: 0,
		missing: new Map(),
		profitLoss: 0n,
	};
	const virtual: ModeAccumulator = {
		buyIn: 0n,
		cashOut: 0n,
		excludedEntryCount: 0,
		missing: new Map(),
		profitLoss: 0n,
	};
	const entries = new Map<string, EntryValuation>();
	for (const [entryId, lines] of linesByEntry) {
		const realLines = lines.filter(
			(line) => line.effect === "real" && kinds.get(line.assetId) === "currency"
		);
		entries.set(entryId, {
			real: valueEntryLines(realLines, resolve, real),
			virtual: valueEntryLines(lines, resolve, virtual),
		});
	}
	return { entries, real: toTotals(real), virtual: toTotals(virtual) };
}
