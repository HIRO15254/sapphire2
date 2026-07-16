import { IconBuildingStore, IconPlus } from "@tabler/icons-react";
import { QueryError } from "@/shared/components/query-error";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { RoomListCard, RoomListCardSkeleton } from "../room-list-card";

interface RoomListItem {
	id: string;
	isFavorite: boolean;
	memo?: string | null;
	name: string;
	ringGameCount: number;
	tournamentCount: number;
}

interface RoomListProps {
	/** Rooms fetch failed. */
	isError?: boolean;
	/** Initial rooms fetch is in flight (no rows yet). */
	isLoading: boolean;
	/** Open the create sheet — wired to the empty-state CTA. */
	onCreate: () => void;
	/** Retry the rooms query. */
	onRetry?: () => void;
	onToggleFavorite: (id: string) => void;
	rooms: RoomListItem[];
}

const SKELETON_COUNT = 5;

/**
 * Owns the list surface's loading / empty / data switch, mirroring
 * `CurrencyList`: the consumer passes `isLoading` + `rooms` and the component
 * decides what to render. The loading branch stacks the card-bound
 * `RoomListCardSkeleton`.
 */
export function RoomList({
	rooms,
	isLoading,
	isError = false,
	onRetry = () => undefined,
	onCreate,
	onToggleFavorite,
}: RoomListProps) {
	if (isLoading) {
		return (
			<div
				aria-hidden
				className="flex flex-col gap-2"
				data-testid="room-list-skeleton"
			>
				{Array.from({ length: SKELETON_COUNT }, (_, i) => i).map((i) => (
					<RoomListCardSkeleton key={i} />
				))}
			</div>
		);
	}

	if (isError) {
		return <QueryError message="Unable to load rooms" onRetry={onRetry} />;
	}

	if (rooms.length === 0) {
		return (
			<EmptyState
				action={
					<Button onClick={onCreate} variant="outline">
						<IconPlus size={16} />
						New room
					</Button>
				}
				description="Create your first room to start tracking its games."
				heading="No rooms yet"
				icon={<IconBuildingStore size={48} />}
			/>
		);
	}

	return (
		<div className="flex flex-col gap-2">
			{rooms.map((room) => (
				<RoomListCard
					key={room.id}
					onToggleFavorite={() => onToggleFavorite(room.id)}
					room={room}
				/>
			))}
		</div>
	);
}
