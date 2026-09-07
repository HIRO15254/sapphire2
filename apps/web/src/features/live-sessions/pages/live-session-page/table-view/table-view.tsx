import { IconPhotoScan, IconUsersMinus } from "@tabler/icons-react";
import type { ReactNode } from "react";
import type { SeatEntry } from "@/features/live-sessions/hooks/use-session-seats";
import { seatLayout } from "@/features/live-sessions/utils/table-geometry";
import { SeatMarker } from "./seat-marker";

interface TableViewProps {
	canResetSeats: boolean;
	center: ReactNode;
	onResetSeats: () => void;
	onScan: () => void;
	onSelectSeat: (seatPosition: number) => void;
	seats: SeatEntry[];
	selectedSeatPosition: number | null;
}

export function TableView({
	canResetSeats,
	center,
	onResetSeats,
	onScan,
	onSelectSeat,
	seats,
	selectedSeatPosition,
}: TableViewProps) {
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
				return (
					<SeatMarker
						isSelected={seat.seatPosition === selectedSeatPosition}
						key={seat.seatPosition}
						onSelect={onSelectSeat}
						point={point}
						seat={seat}
					/>
				);
			})}
			<button
				aria-label="Register seats from a photo"
				className="absolute top-3 left-3 z-[2] inline-flex size-[34px] items-center justify-center rounded-full border border-border bg-card text-primary"
				onClick={onScan}
				title="Register seats from a photo"
				type="button"
			>
				<IconPhotoScan size={18} />
			</button>
			{canResetSeats ? (
				<button
					aria-label="Clear every seat"
					className="absolute top-3 right-3 z-[2] inline-flex size-[34px] items-center justify-center rounded-full border border-border bg-card text-muted-foreground"
					onClick={onResetSeats}
					title="Clear every seat"
					type="button"
				>
					<IconUsersMinus size={18} />
				</button>
			) : null}
		</div>
	);
}
