import { IconAlertTriangle, IconChevronDown } from "@tabler/icons-react";
import type { ReactNode } from "react";
import {
	type StatsFilterSheet,
	useStatsFilterBar,
} from "@/features/statistics/components/stats-filter-bar/use-stats-filter-bar";
import {
	STATS_NORMALIZATION_LABEL,
	STATS_PERIOD_LABEL,
	STATS_TYPE_LABEL,
} from "@/features/statistics/utils/labels";
import {
	epochSecToDateInput,
	STATS_NORMALIZATIONS,
	STATS_PERIODS,
	STATS_TYPES,
} from "@/features/statistics/utils/stats-filters";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/components/ui/button";
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerTitle,
} from "@/shared/components/ui/drawer";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";

const SHEET_TITLE: Record<StatsFilterSheet, string> = {
	period: "Period",
	norm: "Normalize",
	type: "Type",
	currency: "Currency",
	room: "Room",
};

function FilterChip({
	label,
	value,
	invalid,
	onClick,
}: {
	invalid?: boolean;
	label: string;
	onClick: () => void;
	value: string;
}) {
	return (
		<Button
			className={cn(
				"shrink-0 gap-1.5",
				invalid ? "border-destructive text-destructive" : ""
			)}
			onClick={onClick}
			size="sm"
			type="button"
			variant="outline"
		>
			<span className="text-muted-foreground">{label}:</span>
			<span className="font-medium">{value}</span>
			<IconChevronDown size={14} />
		</Button>
	);
}

function OptionRadioList({
	value,
	onChange,
	options,
}: {
	onChange: (value: string) => void;
	options: { label: string; value: string }[];
	value: string;
}) {
	return (
		<RadioGroup onValueChange={onChange} value={value}>
			{options.map((option) => {
				const id = `stats-filter-option-${option.value}`;
				return (
					<label
						className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted"
						htmlFor={id}
						key={option.value}
					>
						<RadioGroupItem id={id} value={option.value} />
						<span className="font-medium text-sm">{option.label}</span>
					</label>
				);
			})}
		</RadioGroup>
	);
}

function SheetShell({
	open,
	onOpenChange,
	title,
	children,
}: {
	children: ReactNode;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	title: string;
}) {
	return (
		<Drawer onOpenChange={onOpenChange} open={open}>
			<DrawerContent className="rounded-t-xl">
				<div
					aria-hidden
					className="mx-auto mt-2 mb-1 h-1 w-9 shrink-0 rounded-full bg-muted-foreground/35"
				/>
				<DrawerTitle className="t-h4 px-4 pt-1">{title}</DrawerTitle>
				<DrawerDescription className="sr-only">
					Select a {title.toLowerCase()} filter option.
				</DrawerDescription>
				<div className="flex flex-col gap-1 overflow-y-auto px-4 py-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
					{children}
				</div>
			</DrawerContent>
		</Drawer>
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
		<div className="sticky top-0 z-20 border-border border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
			<div className="flex gap-2 overflow-x-auto px-4 py-3">
				<FilterChip
					label="Period"
					onClick={() => openSheet("period")}
					value={STATS_PERIOD_LABEL[filters.period]}
				/>
				<FilterChip
					label="Normalize"
					onClick={() => openSheet("norm")}
					value={STATS_NORMALIZATION_LABEL[filters.norm]}
				/>
				<FilterChip
					label="Type"
					onClick={() => openSheet("type")}
					value={STATS_TYPE_LABEL[filters.type]}
				/>
				<FilterChip
					invalid={!isScopeValid}
					label="Currency"
					onClick={() => openSheet("currency")}
					value={currentCurrencyName ?? "Select"}
				/>
				<FilterChip
					label="Room"
					onClick={() => openSheet("room")}
					value={currentRoomName ?? "All rooms"}
				/>
			</div>

			{isScopeValid ? null : (
				<div className="flex items-center gap-2 border-destructive/30 border-t bg-destructive/10 px-4 py-2 text-destructive text-sm">
					<IconAlertTriangle size={16} />
					<span>
						Select a currency, or turn on BB / BI normalization to combine
						currencies.
					</span>
				</div>
			)}

			<SheetShell
				onOpenChange={handleOpenChange}
				open={activeSheet === "period"}
				title={SHEET_TITLE.period}
			>
				<OptionRadioList
					onChange={onPeriodChange}
					options={STATS_PERIODS.map((p) => ({
						value: p,
						label: STATS_PERIOD_LABEL[p],
					}))}
					value={filters.period}
				/>
				{filters.period === "custom" ? (
					<div className="mt-2 flex flex-col gap-2 border-border border-t pt-3">
						<label className="flex flex-col gap-1">
							<span className="t-meta text-muted-foreground uppercase tracking-wide">
								From
							</span>
							<input
								className="h-9 rounded-md border border-border bg-background px-2 text-sm"
								onChange={(e) => onFromChange(e.target.value)}
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
								onChange={(e) => onToChange(e.target.value)}
								type="date"
								value={epochSecToDateInput(filters.to)}
							/>
						</label>
						<DrawerClose asChild>
							<Button className="mt-1" type="button" variant="default">
								Done
							</Button>
						</DrawerClose>
					</div>
				) : null}
			</SheetShell>

			<SheetShell
				onOpenChange={handleOpenChange}
				open={activeSheet === "norm"}
				title={SHEET_TITLE.norm}
			>
				<OptionRadioList
					onChange={onNormChange}
					options={STATS_NORMALIZATIONS.map((n) => ({
						value: n,
						label: STATS_NORMALIZATION_LABEL[n],
					}))}
					value={filters.norm}
				/>
			</SheetShell>

			<SheetShell
				onOpenChange={handleOpenChange}
				open={activeSheet === "type"}
				title={SHEET_TITLE.type}
			>
				<OptionRadioList
					onChange={onTypeChange}
					options={STATS_TYPES.map((t) => ({
						value: t,
						label: STATS_TYPE_LABEL[t],
					}))}
					value={filters.type}
				/>
			</SheetShell>

			<SheetShell
				onOpenChange={handleOpenChange}
				open={activeSheet === "currency"}
				title={SHEET_TITLE.currency}
			>
				<OptionRadioList
					onChange={onCurrencyChange}
					options={currencies.map((c) => ({
						value: c.id,
						label: c.unit ? `${c.name} (${c.unit})` : c.name,
					}))}
					value={filters.currency ?? ""}
				/>
			</SheetShell>

			<SheetShell
				onOpenChange={handleOpenChange}
				open={activeSheet === "room"}
				title={SHEET_TITLE.room}
			>
				<button
					className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-muted"
					onClick={() => onRoomChange(undefined)}
					type="button"
				>
					<span className="font-medium text-sm">All rooms</span>
				</button>
				<OptionRadioList
					onChange={onRoomChange}
					options={rooms.map((r) => ({ value: r.id, label: r.name }))}
					value={filters.room ?? ""}
				/>
			</SheetShell>
		</div>
	);
}
