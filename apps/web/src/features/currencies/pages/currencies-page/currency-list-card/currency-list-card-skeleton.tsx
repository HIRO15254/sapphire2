import { Skeleton } from "@/shared/components/ui/skeleton";

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
