import type { BreakdownViewRow } from "@/features/statistics/pages/statistics-page/breakdown-section/use-breakdown-section";
import { cn } from "@/lib/utils";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/shared/components/ui/table";

interface ValueColumn {
	color: (row: BreakdownViewRow) => string;
	header: string;
	text: (row: BreakdownViewRow) => string;
}

interface BreakdownTableProps {
	normalized: boolean;
	rows: BreakdownViewRow[];
	showCashColumn: boolean;
	showTournamentColumn: boolean;
}

/**
 * The value columns shown for the current scope: a single currency "Net" column
 * when normalization is off, otherwise separate "BB" (cash) and "BI"
 * (tournament) columns — never a combined figure.
 */
function valueColumnsFor({
	normalized,
	showCashColumn,
	showTournamentColumn,
}: Omit<BreakdownTableProps, "rows">): ValueColumn[] {
	if (!normalized) {
		return [
			{ header: "Net", text: (r) => r.netText, color: (r) => r.netColor },
		];
	}
	const columns: ValueColumn[] = [];
	if (showCashColumn) {
		columns.push({
			header: "BB",
			text: (r) => r.cashText,
			color: (r) => r.cashColor,
		});
	}
	if (showTournamentColumn) {
		columns.push({
			header: "BI",
			text: (r) => r.tournamentText,
			color: (r) => r.tournamentColor,
		});
	}
	return columns;
}

export function BreakdownTable({
	rows,
	normalized,
	showCashColumn,
	showTournamentColumn,
}: BreakdownTableProps) {
	const valueColumns = valueColumnsFor({
		normalized,
		showCashColumn,
		showTournamentColumn,
	});
	const columnCount = valueColumns.length + 3;

	return (
		<div className="overflow-x-auto">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Group</TableHead>
						<TableHead className="text-right">Sessions</TableHead>
						{valueColumns.map((column) => (
							<TableHead className="text-right" key={column.header}>
								{column.header}
							</TableHead>
						))}
						<TableHead className="text-right">Win rate</TableHead>
						<TableHead className="text-right">Play time</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{rows.length === 0 ? (
						<TableRow>
							<TableCell
								className="text-center text-muted-foreground"
								colSpan={columnCount}
							>
								No data
							</TableCell>
						</TableRow>
					) : (
						rows.map((row) => (
							<TableRow key={row.key}>
								<TableCell className="font-medium">{row.label}</TableCell>
								<TableCell className="text-right tabular-nums">
									{row.sessions}
								</TableCell>
								{valueColumns.map((column) => (
									<TableCell
										className={cn(
											"text-right font-mono tabular-nums",
											column.color(row)
										)}
										key={column.header}
									>
										{column.text(row)}
									</TableCell>
								))}
								<TableCell className="text-right tabular-nums">
									{row.winRateText}
								</TableCell>
								<TableCell className="text-right tabular-nums">
									{row.playTimeText}
								</TableCell>
							</TableRow>
						))
					)}
				</TableBody>
			</Table>
		</div>
	);
}
