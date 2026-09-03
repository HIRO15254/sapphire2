import { Skeleton } from "@/shared/components/ui/skeleton";

export function PlayerDetailSkeleton() {
	return (
		<div aria-hidden data-testid="player-detail-skeleton">
			<div className="mb-2 flex items-center justify-between">
				<Skeleton className="h-8 w-16" />
				<Skeleton className="size-10 rounded-md" />
			</div>

			<Skeleton className="mb-3 h-7 w-40" />

			<div className="mb-6 flex gap-2">
				<Skeleton className="h-5 w-14 rounded-full" />
				<Skeleton className="h-5 w-16 rounded-full" />
			</div>

			<div className="space-y-2">
				<Skeleton className="h-4 w-full" />
				<Skeleton className="h-4 w-5/6" />
				<Skeleton className="h-4 w-2/3" />
			</div>
		</div>
	);
}
