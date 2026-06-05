import { FilterDialogShell } from "@/shared/components/filter-dialog-shell";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import {
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	SelectWithClear,
} from "@/shared/components/ui/select";
import { useSessionFilters } from "./use-session-filters";

export interface SessionFilterValues {
	currencyId?: string;
	dateFrom?: string;
	dateTo?: string;
	roomId?: string;
	type?: "cash_game" | "tournament";
}

interface SessionFiltersProps {
	currencies: Array<{ id: string; name: string }>;
	filters: SessionFilterValues;
	onFiltersChange: (filters: SessionFilterValues) => void;
	rooms: Array<{ id: string; name: string }>;
}

export function SessionFilters({
	currencies,
	filters,
	onFiltersChange,
	rooms,
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
				<SelectWithClear
					onValueChange={(value) =>
						updateDraft({
							type: value as "cash_game" | "tournament" | undefined,
						})
					}
					value={draft.type}
				>
					<SelectTrigger aria-label="Type" className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="cash_game">Cash Game</SelectItem>
						<SelectItem value="tournament">Tournament</SelectItem>
					</SelectContent>
				</SelectWithClear>
			</Field>

			<Field label="Room">
				<SelectWithClear
					onValueChange={(value) => updateDraft({ roomId: value })}
					value={draft.roomId}
				>
					<SelectTrigger aria-label="Room" className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{rooms.map((room) => (
							<SelectItem key={room.id} value={room.id}>
								{room.name}
							</SelectItem>
						))}
					</SelectContent>
				</SelectWithClear>
			</Field>

			<Field label="Currency">
				<SelectWithClear
					onValueChange={(value) => updateDraft({ currencyId: value })}
					value={draft.currencyId}
				>
					<SelectTrigger aria-label="Currency" className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{currencies.map((currency) => (
							<SelectItem key={currency.id} value={currency.id}>
								{currency.name}
							</SelectItem>
						))}
					</SelectContent>
				</SelectWithClear>
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
