import { Skeleton } from "@/shared/components/ui/skeleton";

/** Loading placeholder approximating the session detail layout. */
export function SessionDetailSkeleton() {
	return (
		<div data-testid="session-detail-skeleton">
			<Skeleton className="mb-4 h-7 w-40" />
			<Skeleton className="mb-6 h-28 w-full rounded-lg" />
			<Skeleton className="mb-4 h-32 w-full rounded-lg" />
			<Skeleton className="h-24 w-full rounded-lg" />
		</div>
	);
}
