import { IconArrowsRightLeft, IconPlus, IconTrash } from "@tabler/icons-react";
import { RateFormSheet } from "@/features/assets/components/rate-form-sheet";
import { FeedHeading, FeedRow } from "@/features/assets/components/wallet-list";
import { ActionSheet } from "@/shared/components/action-sheet";
import { ConfirmDialog } from "@/shared/components/confirm-dialog";
import { PageHeader } from "@/shared/components/page-header";
import { LoadErrorState, NotFoundState } from "@/shared/components/query-state";
import { Badge } from "@/shared/components/ui/badge";
import { IconButton } from "@/shared/components/ui/icon-button";
import { Spinner } from "@/shared/components/ui/spinner";
import type { RateChart } from "./rate-chart";
import { useRatePairPage } from "./use-rate-pair-page";

function RateChartView({ chart, label }: { chart: RateChart; label: string }) {
	return (
		<div
			aria-label={label}
			className="flex flex-col gap-1 px-3.5 pb-3.5"
			role="img"
		>
			<div className="flex items-stretch gap-2">
				<svg
					aria-hidden
					className="block h-16 min-w-0 flex-1 overflow-visible"
					preserveAspectRatio="none"
					viewBox="0 0 310 64"
				>
					<line
						stroke="var(--border)"
						strokeDasharray="2 4"
						strokeWidth="1"
						x1="0"
						x2="310"
						y1="6"
						y2="6"
					/>
					<line
						stroke="var(--border)"
						strokeDasharray="2 4"
						strokeWidth="1"
						x1="0"
						x2="310"
						y1="58"
						y2="58"
					/>
					<path
						d={chart.path}
						fill="none"
						stroke="var(--primary)"
						strokeLinejoin="round"
						strokeWidth="1.75"
						vectorEffect="non-scaling-stroke"
					/>
				</svg>
				<div className="text-muted-foreground flex w-11 flex-none flex-col justify-between text-right font-mono text-[11px] leading-3">
					<span>{chart.max}</span>
					<span>{chart.min}</span>
				</div>
			</div>
			<div className="text-muted-foreground flex justify-between pr-[52px] text-[length:var(--m-text-footnote)]">
				<span>{chart.from}</span>
				<span>Today</span>
			</div>
		</div>
	);
}

interface RatePairPageProps {
	baseAssetId: string;
	quoteAssetId: string;
}

export function RatePairPage({ baseAssetId, quoteAssetId }: RatePairPageProps) {
	const {
		chart,
		chartLabel,
		currentValue,
		deleteTarget,
		groups,
		isDeletePending,
		isEmpty,
		isError,
		isFormOpen,
		isLoading,
		isRetrying,
		label,
		menuTarget,
		menuTitle,
		onAddRate,
		onCloseForm,
		onDelete,
		onDeleteFromMenu,
		onDeleteOpenChange,
		onMenuOpenChange,
		onOpenRate,
		onRetry,
		quoteUnit,
		title,
	} = useRatePairPage(baseAssetId, quoteAssetId);

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
					entity="rates"
					isRetrying={isRetrying}
					onRetry={onRetry}
				/>
			);
		}
		if (isEmpty) {
			return (
				<NotFoundState
					entity="Rate"
					listHref="/assets"
					listIcon={IconArrowsRightLeft}
					listLabel="Assets"
				/>
			);
		}
		return (
			<main className="flex flex-col pb-6 text-[length:var(--m-text-secondary)]">
				<section
					aria-label="Current rate"
					className="flex flex-col gap-0.5 px-3.5 pt-3.5 pb-3"
				>
					<span className="text-muted-foreground text-[length:var(--m-text-footnote)]">
						{label}
					</span>
					<span className="flex items-baseline gap-1.5">
						<span className="font-mono text-[28px] leading-[1.2] font-semibold">
							{currentValue}
						</span>
						<span className="text-muted-foreground">{quoteUnit}</span>
					</span>
				</section>
				{chart ? <RateChartView chart={chart} label={chartLabel} /> : null}
				{groups.map((group) => (
					<section aria-label={group.label} key={group.key}>
						<FeedHeading>{group.label}</FeedHeading>
						{group.rows.map((row) => (
							<FeedRow
								amount={row.value}
								key={row.id}
								meta={row.memo}
								onClick={onOpenRate(row.rate)}
								title={
									<>
										{row.title}
										{row.current ? (
											<Badge variant="primary">Current</Badge>
										) : null}
									</>
								}
								trailing="dots"
							/>
						))}
					</section>
				))}
			</main>
		);
	}

	return (
		<div className="bg-background text-foreground min-h-full">
			<PageHeader
				actions={
					isEmpty ? null : (
						<IconButton
							label="Add rate"
							onClick={onAddRate}
							size="xl"
							type="button"
						>
							<IconPlus aria-hidden />
						</IconButton>
					)
				}
				back={{ fallbackTo: `/assets/${baseAssetId}` }}
				className="pr-0.5"
				heading={<span className="block truncate">{title}</span>}
			/>
			{renderBody()}
			<ActionSheet
				groups={[
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
				description="Records it valued are recalculated with the remaining rates of the pair. This can’t be undone."
				isPending={isDeletePending}
				onConfirm={onDelete}
				onOpenChange={onDeleteOpenChange}
				open={deleteTarget !== null}
				title="Delete this rate?"
			/>
			<RateFormSheet
				baseAssetId={baseAssetId}
				defaultEffective="date"
				lockedQuoteId={quoteAssetId}
				onClose={onCloseForm}
				open={isFormOpen}
			/>
		</div>
	);
}
