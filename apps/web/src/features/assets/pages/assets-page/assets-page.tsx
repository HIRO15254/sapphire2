import {
	IconArchive,
	IconArrowsExchange,
	IconCategory,
	IconPlus,
	IconPlusMinus,
	IconScale,
	IconStarFilled,
	IconWallet,
} from "@tabler/icons-react";
import { AssetFormSheet } from "@/features/assets/components/asset-form-sheet";
import { LedgerSheet } from "@/features/assets/components/ledger-sheet";
import {
	EmptyBlock,
	ListCard,
	ListRow,
	ListSection,
} from "@/features/assets/components/wallet-list";
import type { WalletAsset } from "@/features/assets/hooks/use-wallet-data";
import { formatBalance } from "@/features/assets/utils/amount";
import { assetIcon } from "@/features/assets/utils/asset-display";
import { PageHeader } from "@/shared/components/page-header";
import { LoadErrorState } from "@/shared/components/query-state";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { IconButton } from "@/shared/components/ui/icon-button";
import { Spinner } from "@/shared/components/ui/spinner";
import { useAssetsPage } from "./use-assets-page";

function AssetRows({
	assets,
	baseAssetId,
	onOpen,
}: {
	assets: WalletAsset[];
	baseAssetId: string | null;
	onOpen: (asset: WalletAsset) => () => void;
}) {
	return (
		<ListCard>
			{assets.map((asset) => {
				const AssetIcon = assetIcon(asset);
				return (
					<ListRow
						icon={<AssetIcon aria-hidden />}
						key={asset.id}
						onClick={onOpen(asset)}
						title={
							<>
								<span className="truncate">{asset.name}</span>
								{asset.isFavorite ? (
									<IconStarFilled
										aria-label="Favorite"
										className="text-muted-foreground size-3 flex-none"
									/>
								) : null}
								{asset.id === baseAssetId ? (
									<Badge variant="secondary">Base</Badge>
								) : null}
							</>
						}
						value={formatBalance(asset.balance, asset)}
					/>
				);
			})}
		</ListCard>
	);
}

export function AssetsPage() {
	const {
		archivedCount,
		baseAssetId,
		baseName,
		categoryCount,
		currencies,
		formCurrencies,
		hasAssets,
		isAssetFormOpen,
		isError,
		isLoading,
		isRetrying,
		items,
		ledgerTarget,
		onAdjust,
		onAssetFormOpenChange,
		onCloseLedger,
		onExchange,
		onNewAsset,
		onOpenArchived,
		onOpenAsset,
		onOpenCategories,
		onOpenSettings,
		onRetry,
	} = useAssetsPage();

	function renderBody() {
		// biome-ignore lint/suspicious/noUnnecessaryConditions: Query state changes after the initial render.
		if (isLoading) {
			return (
				<div className="text-muted-foreground flex justify-center py-6">
					<Spinner />
				</div>
			);
		}
		if (isError) {
			return (
				<LoadErrorState
					entity="asset list"
					isRetrying={isRetrying}
					onRetry={onRetry}
				/>
			);
		}
		return (
			<>
				{hasAssets ? (
					<div className="grid grid-cols-2 gap-2">
						<Button
							onClick={onAdjust}
							size="xl"
							type="button"
							variant="outline"
						>
							<IconPlusMinus aria-hidden />
							Adjust
						</Button>
						<Button
							onClick={onExchange}
							size="xl"
							type="button"
							variant="outline"
						>
							<IconArrowsExchange aria-hidden />
							Exchange
						</Button>
					</div>
				) : (
					<div className="flex flex-col items-center gap-1 pt-8 pb-2">
						<EmptyBlock
							icon={<IconWallet aria-hidden />}
							title="No assets yet"
						/>
						<Button onClick={onNewAsset} size="xl" type="button">
							<IconPlus aria-hidden />
							Add asset
						</Button>
					</div>
				)}
				{currencies.length > 0 ? (
					<ListSection heading="Currencies">
						<AssetRows
							assets={currencies}
							baseAssetId={baseAssetId}
							onOpen={onOpenAsset}
						/>
					</ListSection>
				) : null}
				{items.length > 0 ? (
					<ListSection heading="Items">
						<AssetRows assets={items} baseAssetId={null} onOpen={onOpenAsset} />
					</ListSection>
				) : null}
				<ListSection heading="Setup">
					<ListCard>
						<ListRow
							icon={<IconScale aria-hidden />}
							meta={baseName}
							onClick={onOpenSettings}
							title="Base currency"
						/>
						<ListRow
							icon={<IconCategory aria-hidden />}
							meta={categoryCount}
							onClick={onOpenCategories}
							title="Categories"
						/>
						<ListRow
							icon={<IconArchive aria-hidden />}
							meta={archivedCount}
							onClick={onOpenArchived}
							title="Archived assets"
						/>
					</ListCard>
				</ListSection>
			</>
		);
	}

	return (
		<div className="bg-background text-foreground min-h-full">
			<PageHeader
				actions={
					<IconButton
						label="Add asset"
						onClick={onNewAsset}
						size="xl"
						type="button"
					>
						<IconPlus aria-hidden />
					</IconButton>
				}
				className="pr-0.5"
				heading="Assets"
			/>
			<main className="flex flex-col gap-4 px-3.5 pt-3 pb-6 text-[length:var(--m-text-secondary)]">
				{renderBody()}
			</main>
			<AssetFormSheet
				asset={null}
				currencies={formCurrencies}
				onOpenChange={onAssetFormOpenChange}
				open={isAssetFormOpen}
			/>
			<LedgerSheet onClose={onCloseLedger} target={ledgerTarget} />
		</div>
	);
}
