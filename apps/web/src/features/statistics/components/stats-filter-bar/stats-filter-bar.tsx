import { IconAlertTriangle } from "@tabler/icons-react";
import { useStatsFilterBar } from "@/features/statistics/components/stats-filter-bar/use-stats-filter-bar";
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
import {
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	SelectWithClear,
} from "@/shared/components/ui/select";
import {
	ToggleGroup,
	ToggleGroupItem,
} from "@/shared/components/ui/toggle-group";

function FilterField({
	label,
	children,
}: {
	children: React.ReactNode;
	label: string;
}) {
	return (
		<div className="flex shrink-0 flex-col gap-1">
			<span className="t-meta text-muted-foreground uppercase tracking-wide">
				{label}
			</span>
			{children}
		</div>
	);
}

export function StatsFilterBar() {
	const {
		filters,
		currencies,
		rooms,
		isScopeValid,
		onPeriodChange,
		onNormChange,
		onTypeChange,
		onCurrencyChange,
		onRoomChange,
		onFromChange,
		onToChange,
	} = useStatsFilterBar();

	return (
		<div className="sticky top-0 z-20 border-border border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
			<div className="flex gap-4 overflow-x-auto px-4 py-3">
				<FilterField label="Period">
					<ToggleGroup
						onValueChange={onPeriodChange}
						type="single"
						value={filters.period}
					>
						{STATS_PERIODS.map((p) => (
							<ToggleGroupItem key={p} size="sm" value={p}>
								{STATS_PERIOD_LABEL[p]}
							</ToggleGroupItem>
						))}
					</ToggleGroup>
				</FilterField>

				{filters.period === "custom" ? (
					<FilterField label="Range">
						<div className="flex items-center gap-2">
							<input
								className="h-7 rounded-md border border-border bg-background px-2 text-sm"
								onChange={(e) => onFromChange(e.target.value)}
								type="date"
								value={epochSecToDateInput(filters.from)}
							/>
							<span className="text-muted-foreground text-sm">–</span>
							<input
								className="h-7 rounded-md border border-border bg-background px-2 text-sm"
								onChange={(e) => onToChange(e.target.value)}
								type="date"
								value={epochSecToDateInput(filters.to)}
							/>
						</div>
					</FilterField>
				) : null}

				<FilterField label="Normalize">
					<ToggleGroup
						onValueChange={onNormChange}
						type="single"
						value={filters.norm}
					>
						{STATS_NORMALIZATIONS.map((n) => (
							<ToggleGroupItem key={n} size="sm" value={n}>
								{STATS_NORMALIZATION_LABEL[n]}
							</ToggleGroupItem>
						))}
					</ToggleGroup>
				</FilterField>

				<FilterField label="Type">
					<ToggleGroup
						onValueChange={onTypeChange}
						type="single"
						value={filters.type}
					>
						{STATS_TYPES.map((t) => (
							<ToggleGroupItem key={t} size="sm" value={t}>
								{STATS_TYPE_LABEL[t]}
							</ToggleGroupItem>
						))}
					</ToggleGroup>
				</FilterField>

				<FilterField label="Currency">
					<SelectWithClear
						onValueChange={onCurrencyChange}
						value={filters.currency}
					>
						<SelectTrigger
							aria-invalid={!isScopeValid}
							className={cn(
								"h-7 w-40",
								isScopeValid ? "" : "border-destructive text-destructive"
							)}
							size="sm"
						>
							<SelectValue placeholder="Select currency" />
						</SelectTrigger>
						<SelectContent>
							{currencies.map((c) => (
								<SelectItem key={c.id} value={c.id}>
									{c.name}
									{c.unit ? ` (${c.unit})` : ""}
								</SelectItem>
							))}
						</SelectContent>
					</SelectWithClear>
				</FilterField>

				<FilterField label="Room">
					<SelectWithClear onValueChange={onRoomChange} value={filters.room}>
						<SelectTrigger className="h-7 w-40" size="sm">
							<SelectValue placeholder="All rooms" />
						</SelectTrigger>
						<SelectContent>
							{rooms.map((r) => (
								<SelectItem key={r.id} value={r.id}>
									{r.name}
								</SelectItem>
							))}
						</SelectContent>
					</SelectWithClear>
				</FilterField>
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
		</div>
	);
}
