import { Skeleton } from "@/shared/components/ui/skeleton";

/**
 * Loading placeholder bound to {@link SessionListCard}'s shape: leading icon,
 * a name line over two subtext rows (date + duration, room), and a trailing
 * two-line result column (P&L over its secondary figure).
 */
export function SessionListCardSkeleton() {
	return (
		<div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
			<Skeleton className="size-5 shrink-0 rounded-full" />
			<div className="flex min-w-0 flex-1 flex-col gap-1.5">
				<Skeleton className="h-4 w-32" />
				<Skeleton className="h-3 w-28" />
				<Skeleton className="h-3 w-20" />
			</div>
			<div className="flex shrink-0 flex-col items-end gap-1">
				<Skeleton className="h-4 w-16" />
				<Skeleton className="h-3 w-10" />
			</div>
		</div>
	);
}
