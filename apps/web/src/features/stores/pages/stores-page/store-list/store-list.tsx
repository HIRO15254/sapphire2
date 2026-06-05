import { IconBuildingStore, IconPlus } from "@tabler/icons-react";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { StoreListCard, StoreListCardSkeleton } from "../store-list-card";

interface StoreListItem {
	id: string;
	memo?: string | null;
	name: string;
	ringGameCount: number;
	tournamentCount: number;
}

interface StoreListProps {
	/** Initial stores fetch is in flight (no rows yet). */
	isLoading: boolean;
	/** Open the create sheet — wired to the empty-state CTA. */
	onCreate: () => void;
	stores: StoreListItem[];
}

const SKELETON_COUNT = 5;

/**
 * Owns the list surface's loading / empty / data switch, mirroring
 * `CurrencyList`: the consumer passes `isLoading` + `stores` and the component
 * decides what to render. The loading branch stacks the card-bound
 * `StoreListCardSkeleton`.
 */
export function StoreList({ stores, isLoading, onCreate }: StoreListProps) {
	if (isLoading) {
		return (
			<div
				aria-hidden
				className="flex flex-col gap-2"
				data-testid="store-list-skeleton"
			>
				{Array.from({ length: SKELETON_COUNT }, (_, i) => i).map((i) => (
					<StoreListCardSkeleton key={i} />
				))}
			</div>
		);
	}

	if (stores.length === 0) {
		return (
			<EmptyState
				action={
					<Button onClick={onCreate} variant="outline">
						<IconPlus size={16} />
						New store
					</Button>
				}
				description="Create your first store to start tracking its games."
				heading="No stores yet"
				icon={<IconBuildingStore size={48} />}
			/>
		);
	}

	return (
		<div className="flex flex-col gap-2">
			{stores.map((store) => (
				<StoreListCard key={store.id} store={store} />
			))}
		</div>
	);
}
