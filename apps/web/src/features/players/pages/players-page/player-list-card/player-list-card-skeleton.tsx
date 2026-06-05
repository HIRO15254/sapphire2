import { Skeleton } from "@/shared/components/ui/skeleton";

/**
 * Loading placeholder for a single {@link PlayerListCard}. Colocated with the
 * card so the skeleton's shape (name · tag · chevron on one row) and its fixed
 * height are maintained next to the real layout it mimics — changing the card's
 * row shape and its skeleton happens in one place. The list-level wrapper just
 * stacks N of these.
 */
export function PlayerListCardSkeleton() {
	return (
		<div className="flex h-12 items-center gap-2 rounded-lg border border-border bg-card px-4">
			<Skeleton className="h-4 w-32" />
			<Skeleton className="h-5 w-10 shrink-0 rounded-full" />
			<Skeleton className="ml-auto size-3.5 shrink-0 rounded" />
		</div>
	);
}
