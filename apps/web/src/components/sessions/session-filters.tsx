import { useState } from "react";
import { FilterDialogShell } from "@/components/filter-dialog-shell";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

export interface SessionFilterValues {
	currencyId?: string;
	dateFrom?: string;
	dateTo?: string;
	storeId?: string;
	type?: "cash_game" | "tournament";
}

interface SessionFiltersProps {
	currencies: Array<{ id: string; name: string }>;
	filters: SessionFilterValues;
	onFiltersChange: (filters: SessionFilterValues) => void;
	stores: Array<{ id: string; name: string }>;
}

function countActiveFilters(filters: SessionFilterValues): number {
	let count = 0;
	if (filters.type) {
		count++;
	}
	if (filters.storeId) {
		count++;
	}
	if (filters.currencyId) {
		count++;
	}
	if (filters.dateFrom) {
		count++;
	}
	if (filters.dateTo) {
		count++;
	}
	return count;
}

export function SessionFilters({
	currencies,
	filters,
	onFiltersChange,
	stores,
}: SessionFiltersProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [draft, setDraft] = useState<SessionFilterValues>(filters);
	const activeCount = countActiveFilters(filters);

	const handleOpen = () => {
		setDraft(filters);
		setIsOpen(true);
	};

	const handleApply = () => {
		onFiltersChange(draft);
		setIsOpen(false);
	};

	const handleReset = () => {
		const empty: SessionFilterValues = {};
		setDraft(empty);
		onFiltersChange(empty);
		setIsOpen(false);
	};

	return (
		<FilterDialogShell
			activeCount={activeCount}
			description="Refine the session list by type, venue, currency, or date."
			onApply={handleApply}
			onOpen={handleOpen}
			onOpenChange={(open) => {
				if (!open) {
					setIsOpen(false);
				}
			}}
			onReset={handleReset}
			open={isOpen}
			title="Filters"
		>
			<Field label="Type">
				<Select
					onValueChange={(value) =>
						setDraft({
							...draft,
							type:
								value === "all"
									? undefined
									: (value as "cash_game" | "tournament"),
						})
					}
					value={draft.type ?? "all"}
				>
					<SelectTrigger aria-label="Type" className="w-full">
						<SelectValue placeholder="All Types" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Types</SelectItem>
						<SelectItem value="cash_game">Cash Game</SelectItem>
						<SelectItem value="tournament">Tournament</SelectItem>
					</SelectContent>
				</Select>
			</Field>

			<Field label="Store">
				<Select
					onValueChange={(value) =>
						setDraft({
							...draft,
							storeId: value === "all" ? undefined : value,
						})
					}
					value={draft.storeId ?? "all"}
				>
					<SelectTrigger aria-label="Store" className="w-full">
						<SelectValue placeholder="All Stores" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Stores</SelectItem>
						{stores.map((store) => (
							<SelectItem key={store.id} value={store.id}>
								{store.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</Field>

			<Field label="Currency">
				<Select
					onValueChange={(value) =>
						setDraft({
							...draft,
							currencyId: value === "all" ? undefined : value,
						})
					}
					value={draft.currencyId ?? "all"}
				>
					<SelectTrigger aria-label="Currency" className="w-full">
						<SelectValue placeholder="All Currencies" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Currencies</SelectItem>
						{currencies.map((currency) => (
							<SelectItem key={currency.id} value={currency.id}>
								{currency.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</Field>

			<Field label="Date Range">
				<div className="flex items-center gap-2">
					<Input
						aria-label="Date From"
						className="flex-1"
						onChange={(event) =>
							setDraft({
								...draft,
								dateFrom: event.target.value || undefined,
							})
						}
						placeholder="From"
						type="date"
						value={draft.dateFrom ?? ""}
					/>
					<span className="text-muted-foreground text-sm">~</span>
					<Input
						aria-label="Date To"
						className="flex-1"
						onChange={(event) =>
							setDraft({
								...draft,
								dateTo: event.target.value || undefined,
							})
						}
						placeholder="To"
						type="date"
						value={draft.dateTo ?? ""}
					/>
				</div>
			</Field>
		</FilterDialogShell>
	);
}
