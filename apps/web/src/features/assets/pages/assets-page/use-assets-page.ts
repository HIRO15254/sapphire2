import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { LedgerSheetTarget } from "@/features/assets/components/ledger-sheet";
import {
	useWalletAssets,
	useWalletCategories,
	useWalletSetting,
	type WalletAsset,
} from "@/features/assets/hooks/use-wallet-data";
import { activeCurrencies } from "@/features/assets/utils/asset-options";

export function useAssetsPage() {
	const navigate = useNavigate();
	const assetsQuery = useWalletAssets();
	const categoriesQuery = useWalletCategories();
	const settingQuery = useWalletSetting();
	const [isAssetFormOpen, setIsAssetFormOpen] = useState(false);
	const [ledgerTarget, setLedgerTarget] = useState<LedgerSheetTarget | null>(
		null
	);

	const assets = assetsQuery.data ?? [];
	const active = assets.filter((asset) => asset.archivedAt === null);
	const baseAssetId = settingQuery.data?.baseAssetId ?? null;
	const base = assets.find((asset) => asset.id === baseAssetId);

	return {
		archivedCount: assets.length - active.length,
		baseAssetId,
		baseName: base?.name ?? "Not set",
		categoryCount: (categoriesQuery.data ?? []).filter(
			(category) => category.archivedAt === null
		).length,
		currencies: active.filter((asset) => asset.kind === "currency"),
		formCurrencies: activeCurrencies(assets, baseAssetId),
		hasAssets: active.length > 0,
		isAssetFormOpen,
		isError: assetsQuery.isError,
		isLoading: assetsQuery.isPending,
		isRetrying: assetsQuery.isFetching,
		items: active.filter((asset) => asset.kind === "item"),
		ledgerTarget,
		onAdjust: () =>
			setLedgerTarget({ assetId: null, kind: "adjust", lockAsset: false }),
		onAssetFormOpenChange: setIsAssetFormOpen,
		onCloseLedger: () => setLedgerTarget(null),
		onExchange: () => setLedgerTarget({ fromId: null, kind: "exchange" }),
		onNewAsset: () => setIsAssetFormOpen(true),
		onOpenArchived: () => navigate({ to: "/assets/archived" }),
		onOpenAsset: (asset: WalletAsset) => () =>
			navigate({ params: { assetId: asset.id }, to: "/assets/$assetId" }),
		onOpenCategories: () => navigate({ to: "/assets/categories" }),
		onOpenSettings: () => navigate({ to: "/settings" }),
		onRetry: () => {
			assetsQuery.refetch();
		},
	};
}
