import {
	formatDateRangeLabel,
	SESSION_TYPE_LABEL,
	SESSION_TYPE_VALUES,
	type SessionFilterValues,
} from "@/features/sessions/utils/session-filters-helpers";
import {
	FilterAllOption,
	FilterChip,
	FilterChipBar,
	FilterOptionList,
	FilterSheet,
} from "@/shared/components/filter-chip-bar";
import { Button } from "@/shared/components/ui/button";
import { DrawerClose } from "@/shared/components/ui/drawer";
import {
	type SessionFilterSheet,
	useSessionFilterBar,
} from "./use-session-filter-bar";

interface SessionFilterBarProps {
	bbBiMode: boolean;
	currencies: Array<{ id: string; name: string }>;
	filters: SessionFilterValues;
	onBbBiModeChange: (value: boolean) => void;
	onFiltersChange: (filters: SessionFilterValues) => void;
	rooms: Array<{ id: string; name: string }>;
}

const SHEET_TITLE: Record<SessionFilterSheet, string> = {
	type: "Type",
	room: "Room",
	currency: "Currency",
	date: "Date range",
	display: "Display",
};

/**
 * The sessions list filter header — the Notion-style chip bar shared with the
 * statistics page (`web-theme.md` hybrid picker pattern). Replaces the old
 * "Filter" drawer button + standalone BB/BI switch: each dimension is a chip
 * that opens a bottom sheet, applied immediately.
 */
export function SessionFilterBar(props: SessionFilterBarProps) {
	const {
		activeSheet,
		openSheet,
		closeSheet,
		filters,
		bbBiMode,
		rooms,
		currencies,
		currentRoomName,
		currentCurrencyName,
		onTypeChange,
		onRoomChange,
		onCurrencyChange,
		onDateFromChange,
		onDateToChange,
		onClearDates,
		onDisplayChange,
	} = useSessionFilterBar(props);

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			closeSheet();
		}
	};

	return (
		<>
			<FilterChipBar>
				<FilterChip
					active={filters.type != null}
					label="Type"
					onClick={() => openSheet("type")}
					value={SESSION_TYPE_LABEL[filters.type ?? "all"]}
				/>
				<FilterChip
					active={Boolean(filters.roomId)}
					label="Room"
					onClick={() => openSheet("room")}
					value={currentRoomName ?? "All rooms"}
				/>
				<FilterChip
					active={Boolean(filters.currencyId)}
					label="Currency"
					onClick={() => openSheet("currency")}
					value={currentCurrencyName ?? "All currencies"}
				/>
				<FilterChip
					active={Boolean(filters.dateFrom || filters.dateTo)}
					label="Date"
					onClick={() => openSheet("date")}
					value={formatDateRangeLabel(filters.dateFrom, filters.dateTo)}
				/>
				<FilterChip
					active={bbBiMode}
					label="Display"
					onClick={() => openSheet("display")}
					value={bbBiMode ? "BB · BI" : "Currency"}
				/>
			</FilterChipBar>

			<FilterSheet
				onOpenChange={handleOpenChange}
				open={activeSheet === "type"}
				title={SHEET_TITLE.type}
			>
				<FilterOptionList
					idPrefix="session-type"
					onChange={onTypeChange}
					options={SESSION_TYPE_VALUES.map((t) => ({
						value: t,
						label: SESSION_TYPE_LABEL[t],
					}))}
					value={filters.type ?? "all"}
				/>
			</FilterSheet>

			<FilterSheet
				onOpenChange={handleOpenChange}
				open={activeSheet === "room"}
				title={SHEET_TITLE.room}
			>
				<FilterAllOption
					active={!filters.roomId}
					label="All rooms"
					onClick={() => onRoomChange(undefined)}
				/>
				<FilterOptionList
					idPrefix="session-room"
					onChange={onRoomChange}
					options={rooms.map((r) => ({ value: r.id, label: r.name }))}
					value={filters.roomId ?? ""}
				/>
			</FilterSheet>

			<FilterSheet
				onOpenChange={handleOpenChange}
				open={activeSheet === "currency"}
				title={SHEET_TITLE.currency}
			>
				<FilterAllOption
					active={!filters.currencyId}
					label="All currencies"
					onClick={() => onCurrencyChange(undefined)}
				/>
				<FilterOptionList
					idPrefix="session-currency"
					onChange={onCurrencyChange}
					options={currencies.map((c) => ({ value: c.id, label: c.name }))}
					value={filters.currencyId ?? ""}
				/>
			</FilterSheet>

			<FilterSheet
				onOpenChange={handleOpenChange}
				open={activeSheet === "date"}
				title={SHEET_TITLE.date}
			>
				<div className="flex flex-col gap-3">
					<label className="flex flex-col gap-1">
						<span className="t-meta text-muted-foreground uppercase tracking-wide">
							From
						</span>
						<input
							aria-label="Date from"
							className="h-9 rounded-md border border-border bg-background px-2 text-sm"
							onChange={(event) => onDateFromChange(event.target.value)}
							type="date"
							value={filters.dateFrom ?? ""}
						/>
					</label>
					<label className="flex flex-col gap-1">
						<span className="t-meta text-muted-foreground uppercase tracking-wide">
							To
						</span>
						<input
							aria-label="Date to"
							className="h-9 rounded-md border border-border bg-background px-2 text-sm"
							onChange={(event) => onDateToChange(event.target.value)}
							type="date"
							value={filters.dateTo ?? ""}
						/>
					</label>
					<div className="flex gap-2 pt-1">
						<Button
							className="flex-1"
							onClick={onClearDates}
							type="button"
							variant="outline"
						>
							Clear
						</Button>
						<DrawerClose asChild>
							<Button className="flex-1" type="button">
								Done
							</Button>
						</DrawerClose>
					</div>
				</div>
			</FilterSheet>

			<FilterSheet
				onOpenChange={handleOpenChange}
				open={activeSheet === "display"}
				title={SHEET_TITLE.display}
			>
				<FilterOptionList
					idPrefix="session-display"
					onChange={onDisplayChange}
					options={[
						{ value: "currency", label: "Currency" },
						{ value: "normalized", label: "BB / BI" },
					]}
					value={bbBiMode ? "normalized" : "currency"}
				/>
			</FilterSheet>
		</>
	);
}
