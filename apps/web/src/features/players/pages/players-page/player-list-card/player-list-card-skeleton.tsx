import { Skeleton } from "@/shared/components/ui/skeleton";

export function PlayerListCardSkeleton() {
	return (
		<div className="flex h-12 items-center gap-2 rounded-lg border border-border bg-card px-4">
			<Skeleton className="h-4 w-32" />
			<Skeleton className="h-5 w-10 shrink-0 rounded-full" />
			<Skeleton className="ml-auto size-3.5 shrink-0 rounded" />
		</div>
	);
}
