import { IconArchive } from "@tabler/icons-react";
import {
	EmptyBlock,
	ListCard,
	ListRow,
} from "@/features/assets/components/wallet-list";
import { formatBalance } from "@/features/assets/utils/amount";
import { assetIcon } from "@/features/assets/utils/asset-display";
import { PageHeader } from "@/shared/components/page-header";
import { LoadErrorState } from "@/shared/components/query-state";
import { Spinner } from "@/shared/components/ui/spinner";
import { useArchivedAssetsPage } from "./use-archived-assets-page";

export function ArchivedAssetsPage() {
	const { archived, isError, isLoading, isRetrying, onOpenAsset, onRetry } =
		useArchivedAssetsPage();

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
		if (archived.length === 0) {
			return (
				<EmptyBlock
					icon={<IconArchive aria-hidden />}
					title="No archived assets"
				/>
			);
		}
		return (
			<ListCard>
				{archived.map((asset) => {
					const AssetIcon = assetIcon(asset);
					return (
						<ListRow
							icon={<AssetIcon aria-hidden />}
							key={asset.id}
							onClick={onOpenAsset(asset)}
							title={<span className="truncate">{asset.name}</span>}
							value={formatBalance(asset.balance, asset)}
						/>
					);
				})}
			</ListCard>
		);
	}

	return (
		<div className="bg-background text-foreground min-h-full">
			<PageHeader back={{ fallbackTo: "/assets" }} heading="Archived assets" />
			<main className="flex flex-col gap-3 px-3.5 pt-3 pb-6 text-[length:var(--m-text-secondary)]">
				{renderBody()}
			</main>
		</div>
	);
}
