import { FilterDialogShell } from "@/shared/components/filter-dialog-shell";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import { useSessionFilters } from "./use-session-filters";

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

export function SessionFilters({
	currencies,
	filters,
	onFiltersChange,
	stores,
}: SessionFiltersProps) {
	const {
		activeCount,
		draft,
		isOpen,
		onApply,
		onOpen,
		onOpenChange,
		onReset,
		updateDraft,
	} = useSessionFilters({ filters, onFiltersChange });

	return (
		<FilterDialogShell
			activeCount={activeCount}
			description="Refine the session list by type, venue, currency, or date."
			onApply={onApply}
			onOpen={onOpen}
			onOpenChange={onOpenChange}
			onReset={onReset}
			open={isOpen}
			title="Filters"
		>
			<Field label="Type">
				<Select
					onValueChange={(value) =>
						updateDraft({
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
						updateDraft({ storeId: value === "all" ? undefined : value })
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
						updateDraft({ currencyId: value === "all" ? undefined : value })
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
							updateDraft({ dateFrom: event.target.value || undefined })
						}
						type="date"
						value={draft.dateFrom ?? ""}
					/>
					<span className="text-muted-foreground text-sm">~</span>
					<Input
						aria-label="Date To"
						className="flex-1"
						onChange={(event) =>
							updateDraft({ dateTo: event.target.value || undefined })
						}
						type="date"
						value={draft.dateTo ?? ""}
					/>
				</div>
			</Field>
		</FilterDialogShell>
	);
}
