import { Skeleton } from "@/shared/components/ui/skeleton";

const ROW_COUNT = 3;

export function StoreDetailSkeleton() {
	return (
		<div aria-hidden data-testid="store-detail-skeleton">
			{/* Top bar: back button + actions */}
			<div className="mb-2 flex items-center justify-between">
				<Skeleton className="h-8 w-16" />
				<Skeleton className="size-10 rounded-md" />
			</div>

			{/* Page title + memo */}
			<div className="mb-6 space-y-2">
				<Skeleton className="h-7 w-40" />
				<Skeleton className="h-4 w-56" />
			</div>

			{/* Tab strip */}
			<Skeleton className="mb-3 h-9 w-full" />

			{/* Game rows */}
			<div className="flex flex-col gap-2">
				{Array.from({ length: ROW_COUNT }, (_, i) => i).map((i) => (
					<div
						className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
						key={i}
					>
						<div className="min-w-0 flex-1 space-y-1.5">
							<Skeleton className="h-4 w-1/3" />
							<Skeleton className="h-3 w-1/2" />
						</div>
						<Skeleton className="size-8 shrink-0 rounded-md" />
					</div>
				))}
			</div>
		</div>
	);
}
