interface OptionAsset {
	archivedAt: Date | string | null;
	id: string;
	kind: "currency" | "item";
}

export function activeCurrencies<T extends OptionAsset>(
	assets: readonly T[],
	baseAssetId: string | null
): T[] {
	const currencies = assets.filter(
		(asset) => asset.kind === "currency" && asset.archivedAt === null
	);
	const base = currencies.find((asset) => asset.id === baseAssetId);
	return base
		? [base, ...currencies.filter((asset) => asset.id !== base.id)]
		: currencies;
}

export function hasPair(
	rates: readonly { baseAssetId: string; quoteAssetId: string }[],
	a: string,
	b: string
): boolean {
	return rates.some(
		(rate) =>
			(rate.baseAssetId === a && rate.quoteAssetId === b) ||
			(rate.baseAssetId === b && rate.quoteAssetId === a)
	);
}
