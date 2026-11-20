import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { LedgerSheetTarget } from "@/features/assets/components/ledger-sheet";
import {
	useWalletAssets,
	useWalletRates,
	useWalletSetting,
} from "@/features/assets/hooks/use-wallet-data";
import {
	useArchiveAsset,
	useDeleteAsset,
	useRestoreAsset,
	useToggleFavoriteAsset,
} from "@/features/assets/hooks/use-wallet-mutations";
import { formatBalanceNumber } from "@/features/assets/utils/amount";
import { activeCurrencies } from "@/features/assets/utils/asset-options";
import { groupPairs } from "@/features/assets/utils/rate-pairs";

export type AssetTab = "history" | "rates";

export function useAssetDetailPage(assetId: string, tab: AssetTab) {
	const navigate = useNavigate();
	const assetsQuery = useWalletAssets();
	const settingQuery = useWalletSetting();
	const ratesQuery = useWalletRates();
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const [isEditOpen, setIsEditOpen] = useState(false);
	const [isDeleteOpen, setIsDeleteOpen] = useState(false);
	const [isRateFormOpen, setIsRateFormOpen] = useState(false);
	const [ledgerTarget, setLedgerTarget] = useState<LedgerSheetTarget | null>(
		null
	);
	const archiveMutation = useArchiveAsset();
	const restoreMutation = useRestoreAsset();
	const favoriteMutation = useToggleFavoriteAsset();
	const deleteMutation = useDeleteAsset();

	const assets = assetsQuery.data ?? [];
	const asset = assets.find((candidate) => candidate.id === assetId) ?? null;

	const ignoreFailure = async (run: () => Promise<unknown>) => {
		try {
			await run();
			// biome-ignore lint/suspicious/noEmptyBlockStatements: The mutation handles its own error feedback.
		} catch {}
	};

	const onToggleArchive = () => {
		setIsMenuOpen(false);
		if (!asset) {
			return;
		}
		ignoreFailure(() =>
			asset.archivedAt === null
				? archiveMutation.mutateAsync({ id: asset.id })
				: restoreMutation.mutateAsync({ id: asset.id })
		);
	};

	const onDelete = async () => {
		if (!asset || deleteMutation.isPending) {
			return;
		}
		try {
			await deleteMutation.mutateAsync({ id: asset.id });
			setIsDeleteOpen(false);
			navigate({ to: "/assets" });
			// biome-ignore lint/suspicious/noEmptyBlockStatements: The mutation handles its own error feedback.
		} catch {}
	};

	return {
		asset,
		balanceNumber: asset ? formatBalanceNumber(asset.balance, asset) : "",
		currencies: activeCurrencies(
			assets,
			settingQuery.data?.baseAssetId ?? null
		),
		isDeleteOpen,
		isDeletePending: deleteMutation.isPending,
		isEditOpen,
		isError: assetsQuery.isError,
		isFavoritePending: favoriteMutation.isPending,
		isLoading: assetsQuery.isPending,
		isMenuOpen,
		isRateFormOpen,
		isRetrying: assetsQuery.isFetching,
		ledgerTarget,
		onAddRate: () => setIsRateFormOpen(true),
		onAdjust: () =>
			setLedgerTarget({ assetId, kind: "adjust", lockAsset: true }),
		onCloseLedger: () => setLedgerTarget(null),
		onCloseRateForm: () => setIsRateFormOpen(false),
		onDelete,
		onDeleteFromMenu: () => {
			setIsMenuOpen(false);
			setIsDeleteOpen(true);
		},
		onDeleteOpenChange: setIsDeleteOpen,
		onEditFromMenu: () => {
			setIsMenuOpen(false);
			setIsEditOpen(true);
		},
		onEditLine: setLedgerTarget,
		onEditOpenChange: setIsEditOpen,
		onExchange: () => setLedgerTarget({ fromId: assetId, kind: "exchange" }),
		onMenuOpenChange: setIsMenuOpen,
		onOpenMenu: () => setIsMenuOpen(true),
		onRestore: () => {
			if (asset) {
				ignoreFailure(() => restoreMutation.mutateAsync({ id: asset.id }));
			}
		},
		onRetry: () => {
			assetsQuery.refetch();
		},
		onTabChange: (value: string) => {
			navigate({
				params: { assetId },
				replace: true,
				search: { tab: value === "rates" ? "rates" : undefined },
				to: "/assets/$assetId",
			});
		},
		onToggleArchive,
		onToggleFavorite: () => {
			if (asset) {
				ignoreFailure(() =>
					favoriteMutation.mutateAsync(asset.id, asset.isFavorite)
				);
			}
		},
		rateCount: ratesQuery.data
			? groupPairs(
					ratesQuery.data.filter(
						(rate) =>
							rate.baseAssetId === assetId || rate.quoteAssetId === assetId
					)
				).length
			: undefined,
		tab,
	};
}
