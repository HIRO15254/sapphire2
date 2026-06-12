import type { StatRow } from "@/features/sessions/utils/session-display";

interface SessionStatListProps {
	rows: StatRow[];
	title: string;
}

/**
 * Titled label/value table used for both the financial breakdown and the meta
 * (when / where / currency / duration) sections of the detail page. Renders
 * nothing when there are no rows so the page never shows an empty card.
 */
export function SessionStatList({ rows, title }: SessionStatListProps) {
	if (rows.length === 0) {
		return null;
	}
	return (
		<section className="mb-4 rounded-lg border border-border bg-card text-card-foreground">
			<h2 className="t-h4 border-border border-b px-4 py-3">{title}</h2>
			<dl className="divide-y divide-border">
				{rows.map((row) => (
					<div
						className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm"
						key={row.label}
					>
						<dt className="text-muted-foreground">{row.label}</dt>
						<dd className="text-right font-medium tabular-nums">{row.value}</dd>
					</div>
				))}
			</dl>
		</section>
	);
}
