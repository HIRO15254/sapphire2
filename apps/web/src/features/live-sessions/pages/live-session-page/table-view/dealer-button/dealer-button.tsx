import type { SeatPoint } from "@/features/live-sessions/utils/table-geometry";

interface DealerButtonProps {
	seat: SeatPoint;
	seatLabel: string;
}

const MARKER_CORNER_X_PX = 18;
const MARKER_CORNER_Y_PX = 8;

export function DealerButton({ seat, seatLabel }: DealerButtonProps) {
	return (
		<span
			aria-label={`Dealer button at ${seatLabel}`}
			className="pointer-events-none absolute z-[3] box-border flex size-[18px] -translate-x-1/2 -translate-y-1/2 select-none items-center justify-center rounded-full border-2 border-background bg-foreground font-bold font-mono text-[10px] text-background leading-none shadow-[var(--shadow-sm)] transition-[left,top] duration-[250ms]"
			role="img"
			style={{
				left: `calc(${seat.x}% + ${MARKER_CORNER_X_PX}px)`,
				top: `calc(${seat.y}% + ${MARKER_CORNER_Y_PX}px)`,
			}}
		>
			D
		</span>
	);
}
