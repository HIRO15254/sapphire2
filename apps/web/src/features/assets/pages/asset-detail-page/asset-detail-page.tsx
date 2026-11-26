import {
	IconArchive,
	IconArchiveOff,
	IconArrowsExchange,
	IconDots,
	IconPencil,
	IconPlusMinus,
	IconStar,
	IconStarFilled,
	IconTrash,
	IconWallet,
} from "@tabler/icons-react";
import { AssetFormSheet } from "@/features/assets/components/asset-form-sheet";
import { LedgerSheet } from "@/features/assets/components/ledger-sheet";
import { RateFormSheet } from "@/features/assets/components/rate-form-sheet";
import { ActionSheet } from "@/shared/components/action-sheet";
import { ConfirmDialog } from "@/shared/components/confirm-dialog";
import { PageHeader } from "@/shared/components/page-header";
import { LoadErrorState, NotFoundState } from "@/shared/components/query-state";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { IconButton } from "@/shared/components/ui/icon-button";
import { Spinner } from "@/shared/components/ui/spinner";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@/shared/components/ui/tabs";
import { HistoryTab } from "./history-tab";
import { RatesTab } from "./rates-tab";
import { type AssetTab, useAssetDetailPage } from "./use-asset-detail-page";

interface AssetDetailPageProps {
	assetId: string;
	tab: AssetTab;
}

export function AssetDetailPage({ assetId, tab }: AssetDetailPageProps) {
	const {
		asset,
		balanceNumber,
		currencies,
		isDeleteOpen,
		isDeletePending,
		isEditOpen,
		isError,
		isFavoritePending,
		isLoading,
		isMenuOpen,
		isRateFormOpen,
		isRetrying,
		ledgerTarget,
		onAddRate,
		onAdjust,
		onCloseLedger,
		onCloseRateForm,
		onDelete,
		onDeleteFromMenu,
		onDeleteOpenChange,
		onEditFromMenu,
		onEditLine,
		onEditOpenChange,
		onExchange,
		onMenuOpenChange,
		onOpenMenu,
		onRestore,
		onRetry,
		onTabChange,
		onToggleArchive,
		onToggleFavorite,
		rateCount,
	} = useAssetDetailPage(assetId, tab);

	// biome-ignore lint/suspicious/noUnnecessaryConditions: Query state changes after the initial render.
	if (isLoading || isError || !asset) {
		let body = (
			<div className="text-muted-foreground flex justify-center py-6">
				<Spinner />
			</div>
		);
		if (isError) {
			body = (
				<LoadErrorState
					entity="asset"
					isRetrying={isRetrying}
					onRetry={onRetry}
				/>
			);
			// biome-ignore lint/suspicious/noUnnecessaryConditions: Query state changes after the initial render.
		} else if (!isLoading) {
			body = (
				<NotFoundState
					entity="Asset"
					listHref="/assets"
					listIcon={IconWallet}
					listLabel="Assets"
				/>
			);
		}
		return (
			<div className="bg-background text-foreground flex min-h-full flex-col">
				<PageHeader back={{ fallbackTo: "/assets" }} heading="" />
				{body}
			</div>
		);
	}

	const isArchived = asset.archivedAt !== null;

	return (
		<div className="bg-background text-foreground min-h-full">
			<PageHeader
				actions={
					<>
						<IconButton
							aria-pressed={asset.isFavorite}
							disabled={isFavoritePending}
							label="Favorite"
							onClick={onToggleFavorite}
							size="xl"
							type="button"
						>
							{asset.isFavorite ? (
								<IconStarFilled aria-hidden className="text-foreground" />
							) : (
								<IconStar aria-hidden />
							)}
						</IconButton>
						<IconButton
							label="More actions"
							onClick={onOpenMenu}
							size="xl"
							type="button"
						>
							<IconDots aria-hidden />
						</IconButton>
					</>
				}
				back={{ fallbackTo: "/assets" }}
				className="pr-0.5"
				heading={<span className="block truncate">{asset.name}</span>}
			/>
			<main className="flex flex-col pb-6 text-[length:var(--m-text-secondary)]">
				<section
					aria-label="Balance"
					className="flex flex-col gap-0.5 px-3.5 pt-3.5 pb-3"
				>
					<span className="text-muted-foreground flex items-center gap-1.5 text-[length:var(--m-text-footnote)]">
						Balance · {asset.kind === "item" ? "Item" : "Currency"}
						{isArchived ? (
							<Badge variant="secondary">
								<IconArchive aria-hidden />
								Archived
							</Badge>
						) : null}
					</span>
					<span className="flex items-baseline gap-1.5">
						<span className="font-mono text-[28px] leading-[1.2] font-semibold">
							{balanceNumber}
						</span>
						{asset.unit ? (
							<span className="text-muted-foreground">{asset.unit}</span>
						) : null}
					</span>
				</section>
				{isArchived ? (
					<div className="flex flex-col gap-2 px-3.5 pb-3">
						<Button
							onClick={onRestore}
							size="xl"
							type="button"
							variant="outline"
						>
							<IconArchiveOff aria-hidden />
							Restore
						</Button>
					</div>
				) : (
					<div className="grid grid-cols-2 gap-2 px-3.5 pb-3">
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
				)}
				<Tabs onValueChange={onTabChange} value={tab}>
					<TabsList className="-mb-px">
						<TabsTrigger value="history">History</TabsTrigger>
						<TabsTrigger count={rateCount} value="rates">
							Rates
						</TabsTrigger>
					</TabsList>
					<TabsContent value="history">
						<HistoryTab asset={asset} onEdit={onEditLine} />
					</TabsContent>
					<TabsContent value="rates">
						<RatesTab asset={asset} onAddRate={onAddRate} />
					</TabsContent>
				</Tabs>
			</main>
			<ActionSheet
				groups={[
					{
						items: [
							{
								icon: <IconPencil aria-hidden />,
								label: "Edit",
								onSelect: onEditFromMenu,
							},
							{
								icon: isArchived ? (
									<IconArchiveOff aria-hidden />
								) : (
									<IconArchive aria-hidden />
								),
								label: isArchived ? "Restore" : "Archive",
								onSelect: onToggleArchive,
							},
						],
						label: "Actions",
					},
					{
						items: [
							{
								destructive: true,
								disabled: asset.isReferenced,
								icon: <IconTrash aria-hidden />,
								label: "Delete",
								onSelect: onDeleteFromMenu,
							},
						],
						label: "Danger",
						note: asset.isReferenced ? "In use." : null,
					},
				]}
				onOpenChange={onMenuOpenChange}
				open={isMenuOpen}
				title={asset.name}
			/>
			<ConfirmDialog
				description="This can’t be undone."
				isPending={isDeletePending}
				onConfirm={onDelete}
				onOpenChange={onDeleteOpenChange}
				open={isDeleteOpen}
				title={`Delete ${asset.name}?`}
			/>
			<AssetFormSheet
				asset={asset}
				currencies={currencies}
				onOpenChange={onEditOpenChange}
				open={isEditOpen}
			/>
			<LedgerSheet onClose={onCloseLedger} target={ledgerTarget} />
			<RateFormSheet
				baseAssetId={asset.id}
				defaultEffective="start"
				lockedQuoteId={null}
				onClose={onCloseRateForm}
				open={isRateFormOpen}
			/>
		</div>
	);
}
