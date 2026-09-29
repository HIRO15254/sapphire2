import type { SeatPoint } from "@/features/live-sessions/utils/table-geometry";
import { CRYST_FOCUS_RING } from "../../cryst-controls";

interface DealerButtonProps {
	canEdit: boolean;
	onMoveForward: () => void;
	seat: SeatPoint;
	seatLabel: string;
}

const MARKER_CORNER_X_PX = 18;
const MARKER_CORNER_Y_PX = 8;

export function DealerButton({
	canEdit,
	onMoveForward,
	seat,
	seatLabel,
}: DealerButtonProps) {
	return (
		<button
			aria-label={`Dealer button at ${seatLabel}. Move it to the next player`}
			className={`absolute z-[3] box-border flex size-[18px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-background bg-foreground p-0 font-bold font-mono text-[10px] text-background leading-none shadow-[var(--shadow-sm)] transition-[left,top] duration-[250ms] disabled:cursor-default ${CRYST_FOCUS_RING}`}
			disabled={!canEdit}
			onClick={onMoveForward}
			style={{
				left: `calc(${seat.x}% + ${MARKER_CORNER_X_PX}px)`,
				top: `calc(${seat.y}% + ${MARKER_CORNER_Y_PX}px)`,
			}}
			title="Tap to move the button to the next player"
			type="button"
		>
			D
		</button>
	);
}
