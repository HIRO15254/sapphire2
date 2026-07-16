import { Skeleton } from "@/shared/components/ui/skeleton";

const ROW_COUNT = 4;

export function ItemDetailSkeleton() {
	return (
		<div aria-hidden data-testid="item-detail-skeleton">
			{/* Top bar: back button + actions */}
			<div className="mb-2 flex items-center justify-between">
				<Skeleton className="h-8 w-16" />
				<Skeleton className="size-10 rounded-md" />
			</div>

			{/* Page title */}
			<Skeleton className="mb-6 h-7 w-40" />

			{/* Holdings hero: label + value + unit-value line */}
			<div className="mb-6 rounded-xl border border-border bg-card px-5 py-6">
				<Skeleton className="h-3 w-16" />
				<Skeleton className="mt-2 h-9 w-44" />
				<Skeleton className="mt-3 h-4 w-32" />
			</div>

			{/* Add transaction button */}
			<Skeleton className="mb-6 h-11 w-full" />

			{/* Transactions card */}
			<div className="rounded-lg border border-border bg-card">
				<div className="border-border border-b px-4 py-3">
					<Skeleton className="h-4 w-28" />
				</div>
				<div className="flex flex-col gap-3 p-4">
					{Array.from({ length: ROW_COUNT }, (_, i) => i).map((i) => (
						<div className="flex items-center gap-3" key={i}>
							<Skeleton className="h-4 w-16 shrink-0" />
							<Skeleton className="h-4 flex-1" />
							<Skeleton className="h-4 w-16 shrink-0" />
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
