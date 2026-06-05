import { Skeleton } from "@/shared/components/ui/skeleton";

/**
 * Loading placeholder for a single {@link CurrencyListCard}. Colocated with the
 * card so the skeleton's shape (star · name · balance · chevron) is maintained
 * next to the real layout it mimics — changing the card's row shape and its
 * skeleton happens in one place. The list-level wrapper
 * (`CurrencyListSkeleton`) just stacks N of these.
 */
export function CurrencyListCardSkeleton() {
	return (
		<div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
			<Skeleton className="size-4 shrink-0 rounded" />
			<Skeleton className="h-4 flex-1" />
			<Skeleton className="h-4 w-16 shrink-0" />
			<Skeleton className="size-3.5 shrink-0 rounded" />
		</div>
	);
}
