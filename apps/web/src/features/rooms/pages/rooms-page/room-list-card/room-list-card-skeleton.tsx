import { Skeleton } from "@/shared/components/ui/skeleton";

export function RoomListCardSkeleton() {
	return (
		<div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
			<div className="min-w-0 flex-1 space-y-1.5">
				<Skeleton className="h-4 w-1/2" />
				<Skeleton className="h-3 w-1/3" />
			</div>
			<Skeleton className="h-4 w-8 shrink-0" />
			<Skeleton className="h-4 w-8 shrink-0" />
			<Skeleton className="size-3.5 shrink-0 rounded" />
		</div>
	);
}
