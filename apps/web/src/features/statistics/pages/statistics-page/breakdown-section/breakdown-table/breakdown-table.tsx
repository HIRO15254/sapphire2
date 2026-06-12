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

const COLUMN_COUNT = 5;

export function BreakdownTable({ rows }: { rows: BreakdownViewRow[] }) {
	return (
		<div className="overflow-x-auto">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Group</TableHead>
						<TableHead className="text-right">Sessions</TableHead>
						<TableHead className="text-right">Net</TableHead>
						<TableHead className="text-right">Win rate</TableHead>
						<TableHead className="text-right">Play time</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{rows.length === 0 ? (
						<TableRow>
							<TableCell
								className="text-center text-muted-foreground"
								colSpan={COLUMN_COUNT}
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
								<TableCell
									className={cn(
										"text-right font-mono tabular-nums",
										row.netColor
									)}
								>
									{row.netText}
								</TableCell>
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
