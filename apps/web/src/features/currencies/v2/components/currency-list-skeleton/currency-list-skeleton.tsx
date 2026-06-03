import { Skeleton } from "@/shared/components/ui/skeleton";

interface CurrencyListSkeletonProps {
	count?: number;
}

const DEFAULT_COUNT = 5;

export function CurrencyListSkeleton({
	count = DEFAULT_COUNT,
}: CurrencyListSkeletonProps) {
	return (
		<div
			aria-hidden
			className="flex flex-col gap-2"
			data-testid="currency-list-skeleton"
		>
			{Array.from({ length: count }, (_, i) => i).map((i) => (
				<div
					className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
					key={i}
				>
					<Skeleton className="size-4 shrink-0 rounded" />
					<Skeleton className="h-4 flex-1" />
					<Skeleton className="h-4 w-16 shrink-0" />
					<Skeleton className="size-3.5 shrink-0 rounded" />
				</div>
			))}
		</div>
	);
}
