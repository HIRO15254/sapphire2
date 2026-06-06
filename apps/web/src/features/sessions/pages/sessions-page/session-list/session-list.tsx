import { IconCards, IconPlus } from "@tabler/icons-react";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import {
	SessionListCard,
	type SessionListCardItem,
	SessionListCardSkeleton,
} from "../session-list-card";

interface SessionListProps {
	/** Initial sessions fetch is in flight (no rows yet). */
	isLoading: boolean;
	/** Open the create sheet — wired to the empty-state CTA. */
	onCreate: () => void;
	sessions: SessionListCardItem[];
}

const SKELETON_COUNT = 6;

/**
 * Owns the list surface's loading / empty / data switch, mirroring
 * `CurrencyList`: the page passes `isLoading` + `sessions` and this component
 * decides what to render. The loading branch stacks the card-bound skeleton.
 */
export function SessionList({
	isLoading,
	onCreate,
	sessions,
}: SessionListProps) {
	if (isLoading) {
		return (
			<div
				aria-hidden
				className="flex flex-col gap-2"
				data-testid="session-list-skeleton"
			>
				{Array.from({ length: SKELETON_COUNT }, (_, i) => i).map((i) => (
					<SessionListCardSkeleton key={i} />
				))}
			</div>
		);
	}

	if (sessions.length === 0) {
		return (
			<EmptyState
				action={
					<Button onClick={onCreate} variant="outline">
						<IconPlus size={16} />
						New session
					</Button>
				}
				description="Record your first poker session to start tracking P&L."
				heading="No sessions yet"
				icon={<IconCards size={48} />}
			/>
		);
	}

	return (
		<div className="flex flex-col gap-2">
			{sessions.map((session) => (
				<SessionListCard key={session.id} session={session} />
			))}
		</div>
	);
}
