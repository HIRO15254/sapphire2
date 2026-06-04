import { CurrencyListCardSkeleton } from "../currency-list-card";

interface CurrencyListSkeletonProps {
	count?: number;
}

const DEFAULT_COUNT = 5;

/**
 * Page-level loading composition for the currencies list: stacks N card-shaped
 * skeletons. The per-card shape lives with the card it mirrors
 * (`CurrencyListCardSkeleton`), so this wrapper carries no card layout of its
 * own — only the list container (count, spacing, aria-hidden).
 */
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
				<CurrencyListCardSkeleton key={i} />
			))}
		</div>
	);
}
