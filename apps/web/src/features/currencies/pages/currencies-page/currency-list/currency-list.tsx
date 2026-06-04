import { IconCoins, IconPlus } from "@tabler/icons-react";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import {
	CurrencyListCard,
	CurrencyListCardSkeleton,
} from "../currency-list-card";

interface CurrencyListItem {
	balance: number;
	id: string;
	isFavorite: boolean;
	name: string;
	unit?: string | null;
}

interface CurrencyListProps {
	currencies: CurrencyListItem[];
	/** Initial currencies fetch is in flight (no rows yet). */
	isLoading: boolean;
	/** Open the create sheet — wired to the empty-state CTA. */
	onCreate: () => void;
	onToggleFavorite: (id: string) => void;
}

const SKELETON_COUNT = 5;

/**
 * Owns the list surface's loading / empty / data switch, mirroring
 * `TransactionListV2`: the consumer passes `isLoading` + `currencies` and the
 * component decides what to render, instead of the page branching externally.
 * The loading branch stacks the card-bound `CurrencyListCardSkeleton`.
 */
export function CurrencyList({
	currencies,
	isLoading,
	onCreate,
	onToggleFavorite,
}: CurrencyListProps) {
	if (isLoading) {
		return (
			<div
				aria-hidden
				className="flex flex-col gap-2"
				data-testid="currency-list-skeleton"
			>
				{Array.from({ length: SKELETON_COUNT }, (_, i) => i).map((i) => (
					<CurrencyListCardSkeleton key={i} />
				))}
			</div>
		);
	}

	if (currencies.length === 0) {
		return (
			<EmptyState
				action={
					<Button onClick={onCreate} variant="outline">
						<IconPlus size={16} />
						New currency
					</Button>
				}
				description="Create your first currency to start tracking balances."
				heading="No currencies yet"
				icon={<IconCoins size={48} />}
			/>
		);
	}

	return (
		<div className="flex flex-col gap-2">
			{currencies.map((c) => (
				<CurrencyListCard
					currency={c}
					key={c.id}
					onToggleFavorite={() => onToggleFavorite(c.id)}
				/>
			))}
		</div>
	);
}
