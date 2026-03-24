import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

export interface SessionFilterValues {
	dateFrom?: string;
	dateTo?: string;
	storeId?: string;
	type?: "cash_game" | "tournament";
}

interface SessionFiltersProps {
	filters: SessionFilterValues;
	onFiltersChange: (filters: SessionFilterValues) => void;
	stores: Array<{ id: string; name: string }>;
}

export function SessionFilters({
	filters,
	onFiltersChange,
	stores,
}: SessionFiltersProps) {
	return (
		<div className="mb-4 flex flex-wrap gap-2">
			<Select
				onValueChange={(value) =>
					onFiltersChange({
						...filters,
						type:
							value === "all"
								? undefined
								: (value as "cash_game" | "tournament"),
					})
				}
				value={filters.type ?? "all"}
			>
				<SelectTrigger className="w-[140px]">
					<SelectValue placeholder="All Types" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">All Types</SelectItem>
					<SelectItem value="cash_game">Cash Game</SelectItem>
					<SelectItem value="tournament">Tournament</SelectItem>
				</SelectContent>
			</Select>

			<Select
				onValueChange={(value) =>
					onFiltersChange({
						...filters,
						storeId: value === "all" ? undefined : value,
					})
				}
				value={filters.storeId ?? "all"}
			>
				<SelectTrigger className="w-[140px]">
					<SelectValue placeholder="All Stores" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">All Stores</SelectItem>
					{stores.map((s) => (
						<SelectItem key={s.id} value={s.id}>
							{s.name}
						</SelectItem>
					))}
				</SelectContent>
			</Select>

			<Input
				className="w-[140px]"
				onChange={(e) =>
					onFiltersChange({
						...filters,
						dateFrom: e.target.value || undefined,
					})
				}
				placeholder="From"
				type="date"
				value={filters.dateFrom ?? ""}
			/>
			<Input
				className="w-[140px]"
				onChange={(e) =>
					onFiltersChange({
						...filters,
						dateTo: e.target.value || undefined,
					})
				}
				placeholder="To"
				type="date"
				value={filters.dateTo ?? ""}
			/>
		</div>
	);
}
