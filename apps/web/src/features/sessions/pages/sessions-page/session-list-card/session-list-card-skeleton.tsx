import { Skeleton } from "@/shared/components/ui/skeleton";

/**
 * Loading placeholder bound to {@link SessionListCard}'s shape: leading icon,
 * two stacked text lines, and a trailing P&L figure.
 */
export function SessionListCardSkeleton() {
	return (
		<div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
			<Skeleton className="size-5 shrink-0 rounded-full" />
			<div className="flex min-w-0 flex-1 flex-col gap-1.5">
				<Skeleton className="h-4 w-32" />
				<Skeleton className="h-3 w-24" />
			</div>
			<Skeleton className="h-4 w-16 shrink-0" />
		</div>
	);
}
