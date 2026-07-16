import { Skeleton } from "@/shared/components/ui/skeleton";

/**
 * Loading placeholder for a single {@link ItemListCard}. Colocated with the
 * card so the skeleton's shape (name/meta stack · holdings · chevron) is
 * maintained next to the real layout it mimics — changing the card's row
 * shape and its skeleton happens in one place. The list-level wrapper just
 * stacks N of these.
 */
export function ItemListCardSkeleton() {
	return (
		<div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
			<div className="flex min-w-0 flex-1 flex-col gap-1.5">
				<Skeleton className="h-4 w-2/5" />
				<Skeleton className="h-3 w-3/5" />
			</div>
			<Skeleton className="h-4 w-16 shrink-0" />
			<Skeleton className="size-3.5 shrink-0 rounded" />
		</div>
	);
}
