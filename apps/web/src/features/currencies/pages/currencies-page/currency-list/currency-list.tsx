import { IconCoins, IconPlus } from "@tabler/icons-react";
import { QueryError } from "@/shared/components/query-error";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import {
	CurrencyListCard,
	CurrencyListCardSkeleton,
} from "../currency-list-card";

interface CurrencyListItem {
	balance: number;
	id: string;
	isFavorite: boolean;
	name: string;
	unit?: string | null;
}

interface CurrencyListProps {
	currencies: CurrencyListItem[];
	isError: boolean;
	isLoading: boolean;
	onCreate: () => void;
	onRetry: () => void;
	onToggleFavorite: (id: string) => void;
}

const SKELETON_COUNT = 5;

export function CurrencyList({
	currencies,
	isError,
	isLoading,
	onCreate,
	onRetry,
	onToggleFavorite,
}: CurrencyListProps) {
	if (isError) {
		return (
			<QueryError
				message="Unable to load currencies. Please try again."
				onRetry={onRetry}
			/>
		);
	}

	if (isLoading) {
		return (
			<div
				aria-hidden
				className="flex flex-col gap-2"
				data-testid="currency-list-skeleton"
			>
				{Array.from({ length: SKELETON_COUNT }, (_, i) => i).map((i) => (
					<CurrencyListCardSkeleton key={i} />
				))}
			</div>
		);
	}

	if (currencies.length === 0) {
		return (
			<EmptyState
				action={
					<Button onClick={onCreate} variant="outline">
						<IconPlus size={16} />
						New currency
					</Button>
				}
				description="Create your first currency to start tracking balances."
				heading="No currencies yet"
				icon={<IconCoins size={48} />}
			/>
		);
	}

	return (
		<div className="flex flex-col gap-2">
			{currencies.map((c) => (
				<CurrencyListCard
					currency={c}
					key={c.id}
					onToggleFavorite={() => onToggleFavorite(c.id)}
				/>
			))}
		</div>
	);
}
