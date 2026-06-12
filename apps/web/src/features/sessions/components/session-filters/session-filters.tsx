import { IconFilter } from "@tabler/icons-react";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerTitle,
} from "@/shared/components/ui/drawer";
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

/**
 * Session filter sheet. A trigger button (with an active-count badge) opens
 * a bottom `Drawer` holding the type / room / currency / date draft fields
 * and a Reset / Apply row.
 */
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
		<>
			<Button
				aria-label={activeCount > 0 ? `Filter ${activeCount}` : "Filter"}
				className="relative"
				onClick={onOpen}
				size="sm"
				variant="outline"
			>
				<IconFilter size={16} />
				Filter
				{activeCount > 0 ? (
					<Badge className="ml-1 h-4 min-w-4 px-1 text-[10px]">
						{activeCount}
					</Badge>
				) : null}
			</Button>

			<Drawer onOpenChange={onOpenChange} open={isOpen}>
				<DrawerContent className="rounded-t-xl">
					<div
						aria-hidden
						className="mx-auto mt-2 mb-1 h-1 w-9 shrink-0 rounded-full bg-muted-foreground/35"
					/>
					<div className="px-4">
						<DrawerTitle className="t-h4">Filters</DrawerTitle>
						<DrawerDescription className="mt-0.5 text-muted-foreground text-sm">
							Refine the session list by type, venue, currency, or date.
						</DrawerDescription>
					</div>

					<div className="flex flex-col gap-4 overflow-y-auto px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
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
									<SelectItem value="cash_game">Cash game</SelectItem>
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

						<div className="flex justify-end gap-2 pt-1">
							<Button onClick={onReset} variant="outline">
								Reset
							</Button>
							<Button onClick={onApply}>Apply</Button>
						</div>
					</div>
				</DrawerContent>
			</Drawer>
		</>
	);
}
