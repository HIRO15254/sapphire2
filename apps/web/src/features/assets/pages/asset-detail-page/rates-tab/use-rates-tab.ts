import { useNavigate } from "@tanstack/react-router";
import {
	useWalletAssets,
	useWalletRates,
	useWalletSetting,
	type WalletAsset,
} from "@/features/assets/hooks/use-wallet-data";
import { unitOrName } from "@/features/assets/utils/asset-display";
import {
	activeCurrencies,
	hasPair,
} from "@/features/assets/utils/asset-options";
import { longDateLabel } from "@/features/assets/utils/dates";
import { formatRate, rateValue } from "@/features/assets/utils/rate";
import {
	currentRate,
	groupPairs,
	isFromStart,
} from "@/features/assets/utils/rate-pairs";

export function useRatesTab(asset: WalletAsset) {
	const navigate = useNavigate();
	const ratesQuery = useWalletRates();
	const assetsQuery = useWalletAssets();
	const settingQuery = useWalletSetting();
	const assets = assetsQuery.data ?? [];
	const rates = ratesQuery.data ?? [];
	const byId = new Map(assets.map((candidate) => [candidate.id, candidate]));
	const now = new Date();

	const rows = groupPairs(
		rates.filter(
			(rate) => rate.baseAssetId === asset.id || rate.quoteAssetId === asset.id
		)
	).flatMap((pair) => {
		const rate = currentRate(pair, now);
		if (!rate) {
			return [];
		}
		const base = byId.get(rate.baseAssetId);
		const quote = byId.get(rate.quoteAssetId);
		const other = rate.baseAssetId === asset.id ? quote : base;
		const value = rateValue(rate, base?.decimals ?? 0, quote?.decimals ?? 0);
		return [
			{
				key: `${rate.baseAssetId}>${rate.quoteAssetId}`,
				meta: `${other?.name ?? "?"} · ${
					isFromStart(rate)
						? "from the start"
						: `since ${longDateLabel(new Date(rate.effectiveFrom))}`
				}`,
				onOpen: () =>
					navigate({
						params: {
							baseAssetId: rate.baseAssetId,
							quoteAssetId: rate.quoteAssetId,
						},
						to: "/assets/rates/$baseAssetId/$quoteAssetId",
					}),
				text: `1 ${unitOrName(base)} = ${formatRate(value)} ${unitOrName(quote)}`,
			},
		];
	});

	const canAdd =
		asset.archivedAt === null &&
		activeCurrencies(assets, settingQuery.data?.baseAssetId ?? null).some(
			(currency) =>
				currency.id !== asset.id && !hasPair(rates, asset.id, currency.id)
		);

	return {
		canAdd,
		isError: ratesQuery.isError,
		isLoading: ratesQuery.isPending,
		isRetrying: ratesQuery.isFetching,
		onRetry: () => {
			ratesQuery.refetch();
		},
		rows,
	};
}
