import { IconScan } from "@tabler/icons-react";
import type { ReactNode } from "react";
import type { SeatEntry } from "@/features/live-sessions/hooks/use-session-seats";
import { seatLayout } from "@/features/live-sessions/utils/table-geometry";
import { SeatMarker } from "./seat-marker";

interface TableViewProps {
	center: ReactNode;
	seats: SeatEntry[];
}

export function TableView({ center, seats }: TableViewProps) {
	const points = seatLayout(seats.length);

	return (
		<div className="relative mx-3 h-60 shrink-0">
			<div className="absolute inset-x-[46px] inset-y-[34px] rounded-[48px] border border-border bg-card">
				<div className="absolute inset-0 flex flex-col items-center justify-center gap-px">
					{center}
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
