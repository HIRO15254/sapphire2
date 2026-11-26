interface PairRate {
	baseAssetId: string;
	effectiveFrom: Date | string;
	id: string;
	quoteAssetId: string;
}

export function effectiveTime(rate: PairRate): number {
	return new Date(rate.effectiveFrom).getTime();
}

export function groupPairs<T extends PairRate>(rates: readonly T[]): T[][] {
	const pairs = new Map<string, T[]>();
	for (const rate of rates) {
		const key = `${rate.baseAssetId}>${rate.quoteAssetId}`;
		const list = pairs.get(key);
		if (list) {
			list.push(rate);
		} else {
			pairs.set(key, [rate]);
		}
	}
	return [...pairs.values()].map((list) =>
		[...list].sort((a, b) => effectiveTime(a) - effectiveTime(b))
	);
}

export function currentRate<T extends PairRate>(
	ascending: readonly T[],
	now: Date
): T | undefined {
	const started = ascending.filter(
		(rate) => effectiveTime(rate) <= now.getTime()
	);
	return started.at(-1) ?? ascending[0];
}

export function isFromStart(rate: PairRate): boolean {
	return effectiveTime(rate) === 0;
}
