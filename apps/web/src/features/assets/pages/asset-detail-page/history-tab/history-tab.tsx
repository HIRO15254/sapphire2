import {
	IconArrowsExchange,
	IconCards,
	IconHistory,
	IconPencil,
	IconPlusMinus,
	IconTrash,
	IconTrophy,
} from "@tabler/icons-react";
import type { LedgerSheetTarget } from "@/features/assets/components/ledger-sheet";
import {
	EmptyBlock,
	FeedHeading,
	FeedRow,
} from "@/features/assets/components/wallet-list";
import type { WalletAsset } from "@/features/assets/hooks/use-wallet-data";
import type { HistoryIcon } from "@/features/assets/utils/history-rows";
import { ActionSheet } from "@/shared/components/action-sheet";
import { ConfirmDialog } from "@/shared/components/confirm-dialog";
import { LoadErrorState } from "@/shared/components/query-state";
import { TablerIcon } from "@/shared/components/tabler-icon";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Spinner } from "@/shared/components/ui/spinner";
import { useHistoryTab } from "./use-history-tab";

const TONE_CLASSES = {
	default: "",
	destructive: "text-destructive-text",
	success: "text-success-text",
} as const;

function RowIcon({ icon }: { icon: HistoryIcon }) {
	switch (icon.kind) {
		case "category":
			return <TablerIcon fallback="plus-minus" name={icon.name} />;
		case "tournament":
			return <IconTrophy aria-hidden />;
		case "cash":
			return <IconCards aria-hidden />;
		case "exchange":
			return <IconArrowsExchange aria-hidden />;
		default:
			return <IconPlusMinus aria-hidden />;
	}
}

interface HistoryTabProps {
	asset: WalletAsset;
	onEdit: (target: LedgerSheetTarget) => void;
}

export function HistoryTab({ asset, onEdit }: HistoryTabProps) {
	const {
		deleteDescription,
		deleteTarget,
		deleteTitle,
		groups,
		hasNextPage,
		isDeletePending,
		isError,
		isFetchingNextPage,
		isLoading,
		isRetrying,
		menuTarget,
		menuTitle,
		onDelete,
		onDeleteFromMenu,
		onDeleteOpenChange,
		onEditFromMenu,
		onLoadMore,
		onMenuOpenChange,
		onOpenLine,
		onRetry,
	} = useHistoryTab(asset, onEdit);

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
				entity="history"
				isRetrying={isRetrying}
				onRetry={onRetry}
			/>
		);
	}

	return (
		<>
			{groups.length === 0 ? (
				<EmptyBlock
					bordered
					icon={<IconHistory aria-hidden />}
					title="No history yet"
				/>
			) : null}
			{groups.map((group) => (
				<section aria-label={group.label} key={group.key}>
					<FeedHeading>{group.label}</FeedHeading>
					{group.rows.map((row) => {
						const { wallet } = row;
						return (
							<FeedRow
								amount={row.amount}
								amountClassName={TONE_CLASSES[row.tone]}
								badge={
									row.live ? (
										<Badge variant="success">
											<span
												aria-hidden
												className="size-1.5 rounded-full bg-current"
											/>
											Live
										</Badge>
									) : null
								}
								icon={<RowIcon icon={row.icon} />}
								key={row.key}
								meta={row.meta}
								onClick={wallet ? onOpenLine(wallet) : undefined}
								title={row.title}
							/>
						);
					})}
				</section>
			))}
			{hasNextPage ? (
				<div className="border-border border-t px-3.5 pt-3">
					<Button
						aria-busy={isFetchingNextPage}
						className="w-full"
						disabled={isFetchingNextPage}
						onClick={onLoadMore}
						size="xl"
						type="button"
						variant="outline"
					>
						Load more
					</Button>
				</div>
			) : null}
			<ActionSheet
				groups={[
					{
						items: [
							{
								icon: <IconPencil aria-hidden />,
								label: "Edit",
								onSelect: onEditFromMenu,
							},
						],
						label: "Actions",
					},
					{
						items: [
							{
								destructive: true,
								icon: <IconTrash aria-hidden />,
								label: "Delete",
								onSelect: onDeleteFromMenu,
							},
						],
						label: "Danger",
					},
				]}
				onOpenChange={onMenuOpenChange}
				open={menuTarget !== null}
				title={menuTitle}
			/>
			<ConfirmDialog
				description={deleteDescription}
				isPending={isDeletePending}
				onConfirm={onDelete}
				onOpenChange={onDeleteOpenChange}
				open={deleteTarget !== null}
				title={deleteTitle}
			/>
		</>
	);
}
