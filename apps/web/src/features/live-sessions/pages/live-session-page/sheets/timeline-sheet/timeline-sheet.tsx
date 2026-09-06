import type { TimelineRow as TimelineRowModel } from "@/features/live-sessions/utils/timeline-view";
import { CrystSheet } from "../cryst-sheet";
import { TimelineRow } from "./timeline-row";

interface TimelineSheetProps {
	onOpenChange: (open: boolean) => void;
	onSelect: (id: string) => void;
	open: boolean;
	rows: TimelineRowModel[];
}

export function TimelineSheet({
	onOpenChange,
	onSelect,
	open,
	rows,
}: TimelineSheetProps) {
	return (
		<CrystSheet
			className="h-[calc(100svh-2rem)] max-h-[calc(100svh-2rem)]"
			onOpenChange={onOpenChange}
			open={open}
			title="Event timeline"
		>
			{rows.length === 0 ? (
				<p className="py-6 text-center text-[length:var(--text-xs)] text-muted-foreground">
					No events recorded yet.
				</p>
			) : (
				<ul className="flex flex-col">
					{rows.map((row) => (
						<li key={row.id}>
							<TimelineRow onSelect={onSelect} row={row} />
						</li>
					))}
				</ul>
			)}
		</CrystSheet>
	);
}
