import { IconAlertTriangle } from "@tabler/icons-react";
import {
	type StatsFilterSheet,
	useStatsFilterBar,
} from "@/features/statistics/components/stats-filter-bar/use-stats-filter-bar";
import {
	STATS_NORMALIZATION_LABEL,
	STATS_TYPE_LABEL,
} from "@/features/statistics/utils/labels";
import {
	STATS_NORMALIZATIONS,
	STATS_TYPES,
} from "@/features/statistics/utils/stats-filters";
import {
	FilterAllOption,
	FilterChip,
	FilterChipBar,
	FilterDateRange,
	FilterOptionList,
	FilterSheet,
} from "@/shared/components/filter-chip-bar";
import { Button } from "@/shared/components/ui/button";
import { DrawerClose } from "@/shared/components/ui/drawer";
import {
	epochSecToDateInput,
	PERIOD_LABEL,
	PERIODS,
} from "@/shared/lib/period-filter";

const SHEET_TITLE: Record<StatsFilterSheet, string> = {
	period: "Period",
	norm: "Normalize",
	type: "Type",
	currency: "Currency",
	room: "Room",
};

function ScopeWarning() {
	return (
		<div className="flex items-center gap-2 border-destructive/30 border-t bg-destructive/10 px-4 py-2 text-destructive text-sm">
			<IconAlertTriangle size={16} />
			<span>
				Select a currency, or turn on BB / BI normalization to combine
				currencies.
			</span>
		</div>
	);
}

export function StatsFilterBar() {
	const {
		activeSheet,
		closeSheet,
		openSheet,
		filters,
		currencies,
		rooms,
		isScopeValid,
		currentCurrencyName,
		currentRoomName,
		onPeriodChange,
		onNormChange,
		onTypeChange,
		onCurrencyChange,
		onRoomChange,
		onFromChange,
		onToChange,
	} = useStatsFilterBar();

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			closeSheet();
		}
	};

	return (
		<>
			<FilterChipBar banner={isScopeValid ? null : <ScopeWarning />}>
				<FilterChip
					active={filters.period !== "all"}
					label="Period"
					onClick={() => openSheet("period")}
					value={PERIOD_LABEL[filters.period]}
				/>
				<FilterChip
					active={filters.norm !== "off"}
					label="Normalize"
					onClick={() => openSheet("norm")}
					value={STATS_NORMALIZATION_LABEL[filters.norm]}
				/>
				<FilterChip
					active={filters.type !== "all"}
					label="Type"
					onClick={() => openSheet("type")}
					value={STATS_TYPE_LABEL[filters.type]}
				/>
				<FilterChip
					active={Boolean(filters.currency)}
					invalid={!isScopeValid}
					label="Currency"
					onClick={() => openSheet("currency")}
					value={currentCurrencyName ?? "Select"}
				/>
				<FilterChip
					active={Boolean(filters.room)}
					label="Room"
					onClick={() => openSheet("room")}
					value={currentRoomName ?? "All rooms"}
				/>
			</FilterChipBar>

			<FilterSheet
				onOpenChange={handleOpenChange}
				open={activeSheet === "period"}
				title={SHEET_TITLE.period}
			>
				<FilterOptionList
					onChange={onPeriodChange}
					options={PERIODS.map((p) => ({
						value: p,
						label: PERIOD_LABEL[p],
					}))}
					value={filters.period}
				/>
				{filters.period === "custom" ? (
					<div className="mt-2 flex flex-col gap-3 border-border border-t pt-3">
						<FilterDateRange
							from={epochSecToDateInput(filters.from)}
							onFromChange={onFromChange}
							onToChange={onToChange}
							to={epochSecToDateInput(filters.to)}
						/>
						<DrawerClose asChild>
							<Button className="mt-1" type="button" variant="default">
								Done
							</Button>
						</DrawerClose>
					</div>
				) : null}
			</FilterSheet>

			<FilterSheet
				onOpenChange={handleOpenChange}
				open={activeSheet === "norm"}
				title={SHEET_TITLE.norm}
			>
				<FilterOptionList
					onChange={onNormChange}
					options={STATS_NORMALIZATIONS.map((n) => ({
						value: n,
						label: STATS_NORMALIZATION_LABEL[n],
					}))}
					value={filters.norm}
				/>
			</FilterSheet>

			<FilterSheet
				onOpenChange={handleOpenChange}
				open={activeSheet === "type"}
				title={SHEET_TITLE.type}
			>
				<FilterOptionList
					onChange={onTypeChange}
					options={STATS_TYPES.map((t) => ({
						value: t,
						label: STATS_TYPE_LABEL[t],
					}))}
					value={filters.type}
				/>
			</FilterSheet>

			<FilterSheet
				onOpenChange={handleOpenChange}
				open={activeSheet === "currency"}
				title={SHEET_TITLE.currency}
			>
				<FilterAllOption
					active={!filters.currency}
					label="All currencies"
					onClick={() => onCurrencyChange(undefined)}
				/>
				<FilterOptionList
					onChange={onCurrencyChange}
					options={currencies.map((c) => ({
						value: c.id,
						label: c.unit ? `${c.name} (${c.unit})` : c.name,
					}))}
					value={filters.currency ?? ""}
				/>
			</FilterSheet>

			<FilterSheet
				onOpenChange={handleOpenChange}
				open={activeSheet === "room"}
				title={SHEET_TITLE.room}
			>
				<FilterAllOption
					active={!filters.room}
					label="All rooms"
					onClick={() => onRoomChange(undefined)}
				/>
				<FilterOptionList
					onChange={onRoomChange}
					options={rooms.map((r) => ({ value: r.id, label: r.name }))}
					value={filters.room ?? ""}
				/>
			</FilterSheet>
		</>
	);
}
