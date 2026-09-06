import type { SeatEntry } from "@/features/live-sessions/hooks/use-session-seats";
import { seatLayout } from "@/features/live-sessions/utils/table-geometry";
import { cn } from "@/lib/utils";
import { plToneClass } from "../cryst-tone";
import { SeatMarker } from "./seat-marker";

interface TableViewProps {
	bigBlinds: number | null;
	displayPL: number | null;
	displayPLFormatted: string;
	evPLFormatted: string | null;
	seats: SeatEntry[];
	stackFormatted: string;
}

export function TableView({
	bigBlinds,
	displayPL,
	displayPLFormatted,
	evPLFormatted,
	seats,
	stackFormatted,
}: TableViewProps) {
	const points = seatLayout(seats.length);

	return (
		<div className="relative h-60 shrink-0">
			<div className="absolute inset-x-[14.5%] inset-y-[14.2%] rounded-[50%] border border-border bg-card" />
			<div className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1">
				<span className="font-mono font-semibold text-[22px] tabular-nums tracking-[-0.02em]">
					{stackFormatted}
				</span>
				<span className="flex items-center gap-2 font-mono text-[length:var(--text-xs)] tabular-nums">
					<span className={cn(plToneClass(displayPL))}>
						{displayPLFormatted}
					</span>
					<span className="text-muted-foreground">
						{bigBlinds === null ? "— BB" : `${bigBlinds} BB`}
					</span>
				</span>
				<span className="text-[11px] text-muted-foreground">
					EV result{" "}
					<span className="font-mono tabular-nums">{evPLFormatted ?? "—"}</span>
				</span>
			</div>
			{seats.map((seat, index) => {
				const point = points[index];
				if (!point) {
					return null;
				}
				return <SeatMarker key={seat.seatPosition} point={point} seat={seat} />;
			})}
		</div>
	);
}
