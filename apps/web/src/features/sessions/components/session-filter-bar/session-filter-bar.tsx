import {
	SESSION_PERIOD_LABEL,
	SESSION_PERIODS,
	SESSION_TYPE_LABEL,
	SESSION_TYPE_VALUES,
	type SessionFilterValues,
} from "@/features/sessions/utils/session-filters-helpers";
import { epochSecToDateInput } from "@/features/statistics/utils/stats-filters";
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
	period: "Period",
	type: "Type",
	display: "Display",
	room: "Room",
	currency: "Currency",
};

/**
 * The sessions list filter header — the Notion-style chip bar shared with the
 * statistics page (`web-theme.md` hybrid picker pattern). Replaces the old
 * "Filter" drawer button + standalone BB/BI switch: each dimension is a chip
 * that opens a bottom sheet, applied immediately. The Period chip reuses the
 * statistics preset windows + custom range.
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
		onPeriodChange,
		onFromChange,
		onToChange,
		onTypeChange,
		onRoomChange,
		onCurrencyChange,
		onDisplayChange,
	} = useSessionFilterBar(props);

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			closeSheet();
		}
	};

	const period = filters.period ?? "all";

	return (
		<>
			<FilterChipBar>
				<FilterChip
					active={period !== "all"}
					label="Period"
					onClick={() => openSheet("period")}
					value={SESSION_PERIOD_LABEL[period]}
				/>
				<FilterChip
					active={filters.type != null}
					label="Type"
					onClick={() => openSheet("type")}
					value={SESSION_TYPE_LABEL[filters.type ?? "all"]}
				/>
				<FilterChip
					active={bbBiMode}
					label="Display"
					onClick={() => openSheet("display")}
					value={bbBiMode ? "BB · BI" : "Currency"}
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
			</FilterChipBar>

			<FilterSheet
				onOpenChange={handleOpenChange}
				open={activeSheet === "period"}
				title={SHEET_TITLE.period}
			>
				<FilterOptionList
					idPrefix="session-period"
					onChange={onPeriodChange}
					options={SESSION_PERIODS.map((p) => ({
						value: p,
						label: SESSION_PERIOD_LABEL[p],
					}))}
					value={period}
				/>
				{filters.period === "custom" ? (
					<div className="mt-2 flex flex-col gap-2 border-border border-t pt-3">
						<label className="flex flex-col gap-1">
							<span className="t-meta text-muted-foreground uppercase tracking-wide">
								From
							</span>
							<input
								className="h-9 rounded-md border border-border bg-background px-2 text-sm"
								onChange={(event) => onFromChange(event.target.value)}
								type="date"
								value={epochSecToDateInput(filters.from)}
							/>
						</label>
						<label className="flex flex-col gap-1">
							<span className="t-meta text-muted-foreground uppercase tracking-wide">
								To
							</span>
							<input
								className="h-9 rounded-md border border-border bg-background px-2 text-sm"
								onChange={(event) => onToChange(event.target.value)}
								type="date"
								value={epochSecToDateInput(filters.to)}
							/>
						</label>
						<DrawerClose asChild>
							<Button className="mt-1" type="button">
								Done
							</Button>
						</DrawerClose>
					</div>
				) : null}
			</FilterSheet>

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
		</>
	);
}
