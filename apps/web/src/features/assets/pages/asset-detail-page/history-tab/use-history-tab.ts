import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import type {
	LedgerSheetTarget,
	WalletHistoryItem,
} from "@/features/assets/components/ledger-sheet";
import {
	type HistoryItem,
	useWalletAssets,
	useWalletCategories,
	type WalletAsset,
} from "@/features/assets/hooks/use-wallet-data";
import { useDeleteWalletLine } from "@/features/assets/hooks/use-wallet-mutations";
import { buildHistoryGroups } from "@/features/assets/utils/history-rows";
import { trpc } from "@/utils/trpc";

const HISTORY_PAGE_SIZE = 50;

export function useHistoryTab(
	asset: WalletAsset,
	onEdit: (target: LedgerSheetTarget) => void
) {
	const historyQuery = useInfiniteQuery(
		trpc.ledger.listByAsset.infiniteQueryOptions(
			{ assetId: asset.id, limit: HISTORY_PAGE_SIZE },
			{ getNextPageParam: (last) => last.nextCursor ?? undefined }
		)
	);
	const assetsQuery = useWalletAssets();
	const categoriesQuery = useWalletCategories();
	const [menuTarget, setMenuTarget] = useState<WalletHistoryItem | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<WalletHistoryItem | null>(
		null
	);
	const isExchange = (item: WalletHistoryItem | null) =>
		item?.line.role === "exchange";
	const deleteAdjustment = useDeleteWalletLine("Adjustment deleted");
	const deleteExchange = useDeleteWalletLine("Exchange deleted");
	const deleteMutation = isExchange(deleteTarget)
		? deleteExchange
		: deleteAdjustment;

	const onDelete = async () => {
		if (!deleteTarget || deleteMutation.isPending) {
			return;
		}
		try {
			await deleteMutation.mutateAsync({ id: deleteTarget.line.id });
			setDeleteTarget(null);
			// biome-ignore lint/suspicious/noEmptyBlockStatements: The mutation handles its own error feedback.
		} catch {}
	};

	const items: HistoryItem[] =
		// biome-ignore lint/suspicious/noUnnecessaryConditions: Query state changes after the initial render.
		historyQuery.data?.pages.flatMap((page) => page.items) ?? [];

	return {
		deleteDescription: isExchange(deleteTarget)
			? "Both sides of the exchange are removed. This can’t be undone."
			: "The balance changes back. This can’t be undone.",
		deleteTarget,
		deleteTitle: isExchange(deleteTarget)
			? "Delete this exchange?"
			: "Delete this adjustment?",
		groups: buildHistoryGroups(
			items,
			asset,
			assetsQuery.data ?? [],
			categoriesQuery.data ?? [],
			new Date()
		),
		hasNextPage: historyQuery.hasNextPage,
		isDeletePending: deleteMutation.isPending,
		isError: historyQuery.isError,
		isFetchingNextPage: historyQuery.isFetchingNextPage,
		isLoading: historyQuery.isPending,
		isRetrying: historyQuery.isFetching,
		items,
		menuTarget,
		menuTitle: isExchange(menuTarget) ? "Exchange" : "Adjustment",
		onDelete,
		onDeleteFromMenu: () => {
			setDeleteTarget(menuTarget);
			setMenuTarget(null);
		},
		onDeleteOpenChange: (open: boolean) => {
			if (!open) {
				setDeleteTarget(null);
			}
		},
		onEditFromMenu: () => {
			if (!menuTarget) {
				return;
			}
			onEdit(
				menuTarget.line.role === "exchange"
					? {
							counterpart: menuTarget.counterpart,
							kind: "editExchange",
							line: menuTarget.line,
						}
					: { kind: "editAdjust", line: menuTarget.line }
			);
			setMenuTarget(null);
		},
		onLoadMore: () => {
			historyQuery.fetchNextPage();
		},
		onMenuOpenChange: (open: boolean) => {
			if (!open) {
				setMenuTarget(null);
			}
		},
		onOpenLine: (item: WalletHistoryItem) => () => setMenuTarget(item),
		onRetry: () => {
			historyQuery.refetch();
		},
	};
}
