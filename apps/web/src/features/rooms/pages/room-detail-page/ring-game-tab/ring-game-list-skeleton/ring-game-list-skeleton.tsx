import { Skeleton } from "@/shared/components/ui/skeleton";

export function RingGameListSkeleton() {
	return (
		<div aria-hidden className="flex flex-col gap-2">
			{Array.from({ length: 3 }, (_, i) => i).map((i) => (
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
	);
}
