import { IconScan } from "@tabler/icons-react";
import type { SeatEntry } from "@/features/live-sessions/hooks/use-session-seats";
import { seatLayout } from "@/features/live-sessions/utils/table-geometry";
import { cn } from "@/lib/utils";
import { plToneClass } from "../cryst-tone";
import { SeatMarker } from "./seat-marker";

interface TableViewProps {
	bbText: string;
	displayPL: number | null;
	displayPLFormatted: string;
	evPLFormatted: string | null;
	seats: SeatEntry[];
	stackFormatted: string;
}

export function TableView({
	bbText,
	displayPL,
	displayPLFormatted,
	evPLFormatted,
	seats,
	stackFormatted,
}: TableViewProps) {
	const points = seatLayout(seats.length);

	return (
		<div className="relative mx-3 h-60 shrink-0">
			<div className="absolute inset-x-[46px] inset-y-[34px] rounded-[48px] border border-border bg-card">
				<div className="absolute inset-0 flex flex-col items-center justify-center gap-px">
					<span className="font-mono font-semibold text-[22px] tabular-nums tracking-[-0.02em]">
						{stackFormatted}
					</span>
					<div className="flex gap-2 font-mono text-[length:var(--text-xs)] tabular-nums">
						<span className={cn(plToneClass(displayPL))}>
							{displayPLFormatted}
						</span>
						<span className="text-muted-foreground">{bbText}</span>
					</div>
					<span className="text-[11px] text-muted-foreground">
						EV result{" "}
						<span className="font-mono tabular-nums">
							{evPLFormatted ?? "—"}
						</span>
					</span>
				</div>
			</div>
			{seats.map((seat, index) => {
				const point = points[index];
				if (!point) {
					return null;
				}
				return <SeatMarker key={seat.seatPosition} point={point} seat={seat} />;
			})}
			<button
				aria-label="Register seats from a photo"
				className="absolute top-3 left-3 z-[2] inline-flex size-[34px] items-center justify-center rounded-full border border-border bg-card text-primary disabled:opacity-50"
				disabled
				title="Register seats from a photo"
				type="button"
			>
				<IconScan size={18} />
			</button>
		</div>
	);
}
