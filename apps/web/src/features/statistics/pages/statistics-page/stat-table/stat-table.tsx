import { cn } from "@/lib/utils";
import {
	Table,
	TableBody,
	TableCell,
	TableRow,
} from "@/shared/components/ui/table";

/** A single key/value statistic row in a game-type stat table. */
export interface StatRow {
	key: string;
	label: string;
	value: string;
	valueColor: string;
}

/**
 * A compact two-column (metric / value) table used by the cash-game and
 * tournament blocks to list many statistics at a glance.
 */
export function StatTable({ rows }: { rows: StatRow[] }) {
	return (
		<div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
			<Table>
				<TableBody>
					{rows.map((row) => (
						<TableRow key={row.key}>
							<TableCell className="text-muted-foreground">
								{row.label}
							</TableCell>
							<TableCell
								className={cn(
									"text-right font-mono tabular-nums",
									row.valueColor
								)}
							>
								{row.value}
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}
