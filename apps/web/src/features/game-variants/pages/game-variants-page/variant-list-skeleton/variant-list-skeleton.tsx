import { Skeleton } from "@/shared/components/ui/skeleton";

const SKELETON_COUNT = 3;

export function VariantListSkeleton() {
	return (
		<div
			aria-hidden
			className="flex flex-col gap-2"
			data-testid="variant-list-skeleton"
		>
			{Array.from({ length: SKELETON_COUNT }, (_, i) => i).map((i) => (
				<div className="flex items-center gap-3 rounded-md border p-3" key={i}>
					<Skeleton className="h-5 w-20 rounded-full" />
					<Skeleton className="h-4 flex-1" />
					<Skeleton className="size-8 shrink-0 rounded-md" />
				</div>
			))}
		</div>
	);
}
