import { useNavigate } from "@tanstack/react-router";
import {
	useWalletAssets,
	type WalletAsset,
} from "@/features/assets/hooks/use-wallet-data";

export function useArchivedAssetsPage() {
	const navigate = useNavigate();
	const assetsQuery = useWalletAssets();
	return {
		archived: (assetsQuery.data ?? []).filter(
			(asset) => asset.archivedAt !== null
		),
		isError: assetsQuery.isError,
		isLoading: assetsQuery.isPending,
		isRetrying: assetsQuery.isFetching,
		onOpenAsset: (asset: WalletAsset) => () =>
			navigate({ params: { assetId: asset.id }, to: "/assets/$assetId" }),
		onRetry: () => {
			assetsQuery.refetch();
		},
	};
}
