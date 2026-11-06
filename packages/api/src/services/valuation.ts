import type { AssetKind } from "@sapphire2/db/constants/asset";
import type { asset } from "@sapphire2/db/schema/asset";
import type { assetRate, ledgerLine } from "@sapphire2/db/schema/ledger";
import { safeInteger } from "../lib/safe-integer";

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
	missingRates: { real: MissingRate[]; virtual: MissingRate[] };
	real: ValuationAmounts | null;
	virtual: ValuationAmounts | null;
}

export interface MissingRate {
	assetId: string;
	earliestOccurredAt: Date;
}

export interface ValuationResult {
	entries: Map<string, EntryValuation>;
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

type RateIndex = Map<string, Map<string, ValuationRate[]>>;

const IDENTITY_PATH: ConversionPath = { den: 1n, key: "", num: 1n };

export function isPayment(quantity: number): boolean {
	return quantity < 0;
}

export function isRealCurrencyLine(
	line: { effect: string; assetId: string },
	kinds: ReadonlyMap<string, AssetKind>
): boolean {
	return line.effect === "real" && kinds.get(line.assetId) === "currency";
}

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
			den: BigInt(direct.rateDen),
			key: direct.id,
			num: BigInt(direct.rateNum),
		};
	}
	const inverse = latestRate(index.get(to)?.get(from), at);
	if (inverse) {
		return {
			den: BigInt(inverse.rateNum),
			key: inverse.id,
			num: BigInt(inverse.rateDen),
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
				den: BigInt(first.rateDen) * second.den,
				key: `${first.id}>${second.key}`,
				num: BigInt(first.rateNum) * second.num,
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

function recordMissing(missing: Map<string, Date>, line: ValuationLine) {
	const earliest = missing.get(line.assetId);
	if (!earliest || line.occurredAt < earliest) {
		missing.set(line.assetId, line.occurredAt);
	}
}

function sortedMissing(missing: Map<string, Date>): MissingRate[] {
	return [...missing]
		.map(([assetId, earliestOccurredAt]) => ({ assetId, earliestOccurredAt }))
		.sort((a, b) => a.assetId.localeCompare(b.assetId));
}

function valueEntryLines(
	lines: ValuationLine[],
	resolve: (line: ValuationLine) => ConversionPath | null
): { amounts: ValuationAmounts | null; missingRates: MissingRate[] } {
	const all = new Map<string, Bucket>();
	const payments = new Map<string, Bucket>();
	const receipts = new Map<string, Bucket>();
	const missing = new Map<string, Date>();
	for (const line of lines) {
		const path = resolve(line);
		if (!path) {
			recordMissing(missing, line);
			continue;
		}
		addToBucket(all, line.assetId, path, line.quantity);
		addToBucket(
			isPayment(line.quantity) ? payments : receipts,
			line.assetId,
			path,
			line.quantity
		);
	}
	if (missing.size > 0) {
		return { amounts: null, missingRates: sortedMissing(missing) };
	}
	const profitLoss = sumBuckets(all);
	const buyIn = -sumBuckets(payments);
	const cashOut = sumBuckets(receipts);
	return {
		amounts: {
			buyIn: safeInteger(buyIn),
			cashOut: safeInteger(cashOut),
			profitLoss: safeInteger(profitLoss),
		},
		missingRates: [],
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

	const entries = new Map<string, EntryValuation>();
	for (const [entryId, lines] of linesByEntry) {
		const realLines = lines.filter((line) => isRealCurrencyLine(line, kinds));
		const realValue = valueEntryLines(realLines, resolve);
		const virtualValue = valueEntryLines(lines, resolve);
		entries.set(entryId, {
			missingRates: {
				real: realValue.missingRates,
				virtual: virtualValue.missingRates,
			},
			real: realValue.amounts,
			virtual: virtualValue.amounts,
		});
	}
	return { entries };
}
