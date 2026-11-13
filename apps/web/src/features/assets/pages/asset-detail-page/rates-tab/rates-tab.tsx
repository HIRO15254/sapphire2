import { IconArrowsRightLeft, IconPlus } from "@tabler/icons-react";
import { EmptyBlock, FeedRow } from "@/features/assets/components/wallet-list";
import type { WalletAsset } from "@/features/assets/hooks/use-wallet-data";
import { LoadErrorState } from "@/shared/components/query-state";
import { Spinner } from "@/shared/components/ui/spinner";
import { useRatesTab } from "./use-rates-tab";

interface RatesTabProps {
	asset: WalletAsset;
	onAddRate: () => void;
}

export function RatesTab({ asset, onAddRate }: RatesTabProps) {
	const { canAdd, isError, isLoading, isRetrying, onRetry, rows } =
		useRatesTab(asset);

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
	return (
		<>
			{rows.map((row) => (
				<FeedRow
					icon={<IconArrowsRightLeft aria-hidden />}
					key={row.key}
					meta={row.meta}
					onClick={row.onOpen}
					title={row.text}
					titleClassName="font-mono text-[13px]"
					trailing="chevron"
				/>
			))}
			{canAdd ? (
				<button
					className="border-border hover:layer-accent active:layer-accent-pressed flex min-h-11 w-full cursor-pointer items-center gap-2.5 border-t px-3.5 text-left font-medium outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--ring)]"
					onClick={onAddRate}
					type="button"
				>
					<IconPlus aria-hidden className="text-muted-foreground size-4" />
					Add rate
				</button>
			) : null}
			{rows.length === 0 && !canAdd ? (
				<EmptyBlock
					bordered
					icon={<IconArrowsRightLeft aria-hidden />}
					title="No rates yet"
				/>
			) : null}
		</>
	);
}
