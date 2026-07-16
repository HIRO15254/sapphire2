import { IconPlus, IconTicket } from "@tabler/icons-react";
import { QueryError } from "@/shared/components/query-error";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { ItemListCard, ItemListCardSkeleton } from "../item-list-card";

interface ItemListItem {
	currencyName?: string | null;
	currencyUnit?: string | null;
	holdings: number;
	id: string;
	name: string;
	unitValue: number;
}

interface ItemListProps {
	isError?: boolean;
	/** Initial items fetch is in flight (no rows yet). */
	isLoading: boolean;
	items: ItemListItem[];
	/** Open the create sheet — wired to the empty-state CTA. */
	onCreate: () => void;
	onRetry?: () => void;
}

const SKELETON_COUNT = 5;

/**
 * Owns the list surface's loading / empty / data switch, mirroring
 * `CurrencyList`: the consumer passes `isLoading` + `items` and the component
 * decides what to render, instead of the page branching externally. The
 * loading branch stacks the card-bound `ItemListCardSkeleton`.
 */
export function ItemList({
	isError,
	isLoading,
	items,
	onCreate,
	onRetry,
}: ItemListProps) {
	if (isError) {
		return (
			<QueryError
				message="Unable to load items. Please try again."
				onRetry={onRetry ?? (() => undefined)}
			/>
		);
	}

	if (isLoading) {
		return (
			<div
				aria-hidden
				className="flex flex-col gap-2"
				data-testid="item-list-skeleton"
			>
				{Array.from({ length: SKELETON_COUNT }, (_, i) => i).map((i) => (
					<ItemListCardSkeleton key={i} />
				))}
			</div>
		);
	}

	if (items.length === 0) {
		return (
			<EmptyState
				action={
					<Button onClick={onCreate} variant="outline">
						<IconPlus size={16} />
						New item
					</Button>
				}
				description="Create your first item to track tickets and other assets."
				heading="No items yet"
				icon={<IconTicket size={48} />}
			/>
		);
	}

	return (
		<div className="flex flex-col gap-2">
			{items.map((item) => (
				<ItemListCard item={item} key={item.id} />
			))}
		</div>
	);
}
