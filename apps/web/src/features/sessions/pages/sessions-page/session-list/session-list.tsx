import { IconCards, IconPlus } from "@tabler/icons-react";
import { QueryError } from "@/shared/components/query-error";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import {
	SessionListCard,
	type SessionListCardItem,
	SessionListCardSkeleton,
} from "../session-list-card";

interface SessionListProps {
	bbBiMode: boolean;
	hasNextPage: boolean;
	isFetchingNextPage: boolean;
	isInitialLoadError: boolean;
	isLoading: boolean;
	onCreate: () => void;
	onLoadMore: () => void;
	onRetry: () => void;
	sessions: SessionListCardItem[];
}

const SKELETON_COUNT = 6;

export function SessionList({
	bbBiMode,
	hasNextPage,
	isFetchingNextPage,
	isInitialLoadError,
	isLoading,
	onCreate,
	onLoadMore,
	onRetry,
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

	if (isInitialLoadError) {
		return (
			<QueryError
				message="Unable to load sessions. Please try again."
				onRetry={onRetry}
			/>
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
				<SessionListCard
					bbBiMode={bbBiMode}
					key={session.id}
					session={session}
				/>
			))}
			{hasNextPage ? (
				<Button
					className="mt-1 w-full"
					disabled={isFetchingNextPage}
					onClick={onLoadMore}
					size="sm"
					variant="ghost"
				>
					{isFetchingNextPage ? "Loading..." : "Load more"}
				</Button>
			) : null}
		</div>
	);
}
