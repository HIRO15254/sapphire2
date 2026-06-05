import { Skeleton } from "@/shared/components/ui/skeleton";

/**
 * Loading placeholder for a single {@link PlayerListCard}. Colocated with the
 * card so the skeleton's shape (name · tags · chevron) is maintained next to
 * the real layout it mimics — changing the card's row shape and its skeleton
 * happens in one place. The list-level wrapper just stacks N of these.
 */
export function PlayerListCardSkeleton() {
	return (
		<div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
			<div className="min-w-0 flex-1 space-y-1.5">
				<Skeleton className="h-4 w-1/2" />
				<Skeleton className="h-3 w-1/3" />
			</div>
			<Skeleton className="size-3.5 shrink-0 rounded" />
		</div>
	);
}
